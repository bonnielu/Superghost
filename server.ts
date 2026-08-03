import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

import next from "next";
import { Server } from "socket.io";

import type {
  ChallengeResult,
  ClientToServerEvents,
  Player,
  Room,
  ServerToClientEvents,
  SocketData,
  LogEntry
} from "./lib/game";

import { MAX_PLAYERS, MAX_STRIKES, TURN_DURATION } from "./lib/game-config";

import { isWord } from "./lib/game-config"

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "localhost";
const port = Number(process.env.PORT ?? 3000);

const nextApp = next({
  dev,
  hostname,
  port,
});

const nextHandler = nextApp.getRequestHandler();

/**
 * This stores rooms in the current Node process.
 *
 * This is appropriate for development and an initial single-server version.
 * Rooms disappear when the server restarts.
 */
const rooms = new Map<string, Room>();
const turnTimers = new Map<
  string,
  ReturnType<typeof setTimeout>
>()

const ROOM_CODE_LENGTH = 4;

/**
 * Excludes visually ambiguous characters such as:
 * I, O, 0 and 1.
 */
const ROOM_CODE_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function createRoomCode(): string {
  let code = "";

  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    const randomIndex = Math.floor(
      Math.random() * ROOM_CODE_CHARACTERS.length,
    );

    code += ROOM_CODE_CHARACTERS[randomIndex];
  }

  return code;
}

function createUniqueRoomCode(): string {
  let code = createRoomCode();

  while (rooms.has(code)) {
    code = createRoomCode();
  }

  return code;
}

function normalizeName(name: string): string {
  return name.trim().slice(0, 16);
}

function normalizeCode(code: string): string {
  return code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, ROOM_CODE_LENGTH);
}

async function startServer(): Promise<void> {
  await nextApp.prepare();

  const httpServer = createServer((request, response) => {
    nextHandler(request, response);
  });

  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(httpServer);

  function removePlayerFromRoom(
    code: string | undefined,
    playerId: string | undefined,
  ): void {
    if (!code || !playerId) {
      return
    }

    const room = rooms.get(code)

    if (!room) {
      return
    }

    const removedPlayerIndex = room.players.findIndex(
      (player) => player.id === playerId,
    )

    if (removedPlayerIndex === -1) {
      return
    }

    room.players.splice(removedPlayerIndex, 1)

    if (room.players.length === 0) {
      clearTurnTimer(code)
      rooms.delete(code)
      return
    }

    if (room.hostId === playerId) {
      room.hostId = room.players[0].id
    }

    // Keep turnIndex valid after removing a player.
    if (removedPlayerIndex < room.turnIndex) {
      room.turnIndex -= 1
    } else if (room.turnIndex >= room.players.length) {
      room.turnIndex = 0
    }

    // If the current player left, move to the next available active player and restart the timer.
    const currentPlayer =
      room.players[room.turnIndex] ?? null

    if (
      room.status === "playing" &&
      (!currentPlayer || !isActivePlayer(currentPlayer))
    ) {
      const nextTurnIndex = getNextTurnIndex(
        room,
        Math.max(room.turnIndex - 1, 0),
      )

      if (nextTurnIndex !== null) {
        room.turnIndex = nextTurnIndex
      }
    }

    // End the game if only one active player remains.
    if (
      room.status === "playing" &&
      checkForWinner(room)
    ) {
      clearTurnTimer(code)
      room.turnStartedAt = null
    } else if (room.status === "playing") {
      startTurnTimer(room)
    }

    updateRoom(room)
  }

  function updateRoom(room: Room): void {
    room.updatedAt = new Date().toISOString()
    io.to(room.code).emit("room-updated", room)
  }

  function addLog(room: Room, entry: Omit<LogEntry, "id" | "at">,): void {
    room.log.push({
      id: randomUUID(),
      at: Date.now(),
      ...entry,
    })
  }

  function getPlayer(
    room: Room,
    playerId: string,
  ): Player | undefined {
    return room.players.find(
      (player) => player.id === playerId,
    )
  }

  function isActivePlayer(player: Player): boolean {
    return (
      player.connected &&
      !player.eliminated &&
      player.strikes < MAX_STRIKES
    )
  }

  function getCurrentPlayer(room: Room): Player | null {
    return room.players[room.turnIndex] ?? null
  }

  function getNextTurnIndex(
    room: Room,
    startingIndex: number,
  ): number | null {
    if (room.players.length === 0) {
      return null
    }

    for (
      let offset = 1;
      offset <= room.players.length;
      offset += 1
    ) {
      const index =
        (startingIndex + offset) % room.players.length

      if (isActivePlayer(room.players[index])) {
        return index
      }
    }

    return null
  }

  function giveStrike(
    room: Room,
    playerId: string,
  ): Player | null {
    const player = getPlayer(room, playerId)

    if (!player) {
      return null
    }

    player.strikes = Math.min(
      player.strikes + 1,
      MAX_STRIKES,
    )

    if (player.strikes >= MAX_STRIKES) {
      player.eliminated = true

      addLog(room, {
        kind: "loss",
        message: `${player.name} lost their final life and was eliminated.`,
      })
    }

    return player
  }

  function getActivePlayers(room: Room): Player[] {
    return room.players.filter(isActivePlayer)
  }

  function checkForWinner(room: Room): boolean {
    const activePlayers = getActivePlayers(room)

    if (activePlayers.length !== 1) {
      return false
    }

    const winner = activePlayers[0]

    winner.roundsWon += 1
    room.status = "finished"
    room.winnerId = winner.id

    addLog(room, {
      kind: "win",
      message: `${winner.name} won the game!`,
    })

    return true
  }

  function startNewRound(
    room: Room,
    preferredPlayerId: string,
  ): void {
    room.fragment = ""
    room.lastMoverId = null
    room.status = "playing"
    room.round += 1
    room.challenge = null

    const preferredIndex = room.players.findIndex(
      (player) =>
        player.id === preferredPlayerId &&
        isActivePlayer(player),
    )

    if (preferredIndex !== -1) {
      room.turnIndex = preferredIndex
      return
    }

    const fallbackIndex = getNextTurnIndex(
      room,
      Math.max(preferredIndex, 0),
    )

    if (fallbackIndex !== null) {
      room.turnIndex = fallbackIndex
    }
  }

  function normalizeLetter(letter: string): string | null {
    const normalized = letter.trim().toUpperCase()

    if (!/^[A-Z]$/.test(normalized)) {
      return null
    }

    return normalized
  }

  function normalizeWord(word: string): string {
    return word
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
  }

  function clearTurnTimer(code: string): void {
    const timer = turnTimers.get(code)

    if (timer) {
      clearTimeout(timer)
      turnTimers.delete(code)
    }
  }

  function startTurnTimer(room: Room): void {
    clearTurnTimer(room.code)

    if (room.status !== "playing") {
      room.turnStartedAt = null
      return
    }

    const timedPlayerId =
      room.players[room.turnIndex]?.id

    if (!timedPlayerId) {
      room.turnStartedAt = null
      return
    }

    room.turnStartedAt = Date.now()

    const timer = setTimeout(() => {
      const currentRoom = rooms.get(room.code)

      if (
        !currentRoom ||
        currentRoom.status !== "playing"
      ) {
        return
      }

      const currentPlayer =
        currentRoom.players[
        currentRoom.turnIndex
        ]

      /*
       * Ignore an old timeout if the turn has already
       * moved to another player.
       */
      if (
        !currentPlayer ||
        currentPlayer.id !== timedPlayerId
      ) {
        return
      }

      giveStrike(
        currentRoom,
        currentPlayer.id,
      )

      addLog(currentRoom, {
        kind: "loss",
        message: `${currentPlayer.name} ran out of time and lost a life.`,
      })

      if (!checkForWinner(currentRoom)) {
        startNewRound(
          currentRoom,
          currentPlayer.id,
        )

        startTurnTimer(currentRoom)
      } else {
        currentRoom.turnStartedAt = null
        clearTurnTimer(currentRoom.code)
      }

      updateRoom(currentRoom)
    }, TURN_DURATION)

    turnTimers.set(room.code, timer)
  }

  io.on("connection", (socket) => {
    console.log(`Connected: ${socket.id}`);

    socket.on("create-room", async ({ name }, callback) => {
      const normalizedName = normalizeName(name);

      if (!normalizedName) {
        callback({
          success: false,
          error: "Please enter your name.",
        });

        return;
      }

      /*
       * Remove the socket from its previous Superghost room, if it
       * creates another room without first disconnecting.
       */
      removePlayerFromRoom(
        socket.data.code,
        socket.data.playerId,
      );

      if (socket.data.code) {
        await socket.leave(socket.data.code);
      }

      const code = createUniqueRoomCode();
      const playerId = randomUUID();

      const player: Player = {
        id: playerId,
        name: normalizedName,
        strikes: 0,
        roundsWon: 0,
        connected: true,
        eliminated: false
      };

      const now = new Date().toISOString()

      const room: Room = {
        code,
        hostId: player.id,
        status: 'lobby',
        players: [player],
        turnIndex: 0,
        fragment: "",
        challenge: null,
        log: [],
        messages: [],
        lastMoverId: null,
        round: 1,
        winnerId: null,
        createdAt: now,
        updatedAt: now,
        turnStartedAt: null
      };

      rooms.set(code, room);

      socket.data.code = code;
      socket.data.playerId = playerId;

      await socket.join(code);

      callback({
        success: true,
        session: {
          code,
          playerId,
          room,
        },
      });

      io.to(code).emit("room-updated", room);
    });

    socket.on("join-room", async ({ name, code }, callback) => {
      const normalizedName = normalizeName(name);
      const normalizedCode = normalizeCode(code);

      if (!normalizedName) {
        callback({
          success: false,
          error: "Please enter your name.",
        });

        return;
      }

      if (normalizedCode.length !== ROOM_CODE_LENGTH) {
        callback({
          success: false,
          error: "Enter a valid four-character room code.",
        });

        return;
      }

      const room = rooms.get(normalizedCode);

      if (!room) {
        callback({
          success: false,
          error: "Room not found.",
        });

        return;
      }

      if (room.players.length >= MAX_PLAYERS) {
        callback({
          success: false,
          error: "This room is full.",
        });

        return;
      }

      removePlayerFromRoom(
        socket.data.code,
        socket.data.playerId,
      );

      if (socket.data.code) {
        await socket.leave(socket.data.code);
      }

      const playerId = randomUUID();

      const player: Player = {
        id: playerId,
        name: normalizedName,
        strikes: 0,
        roundsWon: 0,
        connected: true,
        eliminated: false
      };

      room.players.push(player);
      if (room.status == "playing" || "finished" || "challenging") {
        addLog(room, {
          kind: "system",
          message: `${player.name} joined the game.`
        })
      }

      socket.data.code = normalizedCode;
      socket.data.playerId = playerId;

      await socket.join(normalizedCode);

      callback({
        success: true,
        session: {
          code: normalizedCode,
          playerId,
          room,
        },
      });

      io.to(normalizedCode).emit("room-updated", room);
    });

    socket.on("get-room", async ({ code, playerId }, callback) => {
      const normalizedCode = normalizeCode(code);
      const room = rooms.get(normalizedCode);

      if (!room) {
        callback({
          success: false,
          error: "This room no longer exists.",
        });

        return;
      }

      const player = room.players.find(
        (roomPlayer) => roomPlayer.id === playerId,
      );

      if (!player) {
        callback({
          success: false,
          error: "You are no longer in this room.",
        });

        return;
      }

      /*
       * This lets the new Socket.IO connection subscribe after
       * a client-side route change or reconnection.
       */
      socket.data.code = normalizedCode;
      socket.data.playerId = playerId;

      await socket.join(normalizedCode);

      callback({
        success: true,
        session: {
          code,
          playerId,
          room,
        },
      });
    },
    );

    socket.on("leave-room", async () => {
      const { code, playerId } = socket.data

      if (!code || !playerId) {
        return
      }

      const room = rooms.get(code)
      const player = room?.players.find(
        (candidate) => candidate.id === playerId,
      )

      if (room && player) {
        addLog(room, {
          kind: "system",
          message: `${player.name} left the room.`,
        })
      }

      removePlayerFromRoom(code, playerId)

      await socket.leave(code)

      socket.data.code = undefined
      socket.data.playerId = undefined
    })

    socket.on("start-game", ({ code, playerId }, callback) => {
      const normalizedCode = normalizeCode(code)
      const room = rooms.get(normalizedCode)

      if (!room) {
        callback({
          success: false,
          error: "Room not found.",
        })
        return
      }

      const activePlayers = room.players.filter(isActivePlayer)
      if (activePlayers.length < 2) {
        callback({
          success: false,
          error: "At least two players are required.",
        })
        return
      }

      room.status = "playing"
      room.fragment = ""
      room.lastMoverId = null
      room.winnerId = null

      room.turnIndex = room.players.findIndex(
        (player) => player.id === activePlayers[0].id,
      )

      addLog(room, {
        kind: "system",
        message: "The game has started!",
      })

      startTurnTimer(room)
      updateRoom(room)

      callback({
        success: true,
        session: {
          code,
          playerId,
          room,
        },
      })
    });

    socket.on("play-letter", ({ code, playerId, letter, side }, callback) => {
      const normalizedCode = normalizeCode(code)
      const room = rooms.get(normalizedCode)

      if (!room) {
        callback({
          success: false,
          error: "Room not found.",
        })
        return
      }

      if (room.status !== "playing") {
        callback({
          success: false,
          error: "The game is not accepting moves.",
        })
        return
      }

      const currentPlayer = getCurrentPlayer(room)
      const normalizedLetter = normalizeLetter(letter)

      if (!currentPlayer || currentPlayer.id !== playerId) {
        callback({
          success: false,
          error: "It is not your turn.",
        })
        return
      }

      if (!normalizedLetter) {
        callback({
          success: false,
          error: "Choose exactly one letter.",
        })
        return
      }

      if (side !== "left" && side !== "right") {
        callback({
          success: false,
          error: "Choose which side to add the letter to.",
        })
        return
      }

      room.fragment = side === "left" ? normalizedLetter + room.fragment : room.fragment + normalizedLetter
      room.lastMoverId = playerId

      addLog(room, {
        kind: "add",
        message: `${currentPlayer.name} added ${normalizedLetter} to the ${side}.`,
      })

      // Check whether the fragment is a word 
      if (isWord(room.fragment)) {
        const completedWord = room.fragment
        const penalizedPlayer = giveStrike(room, playerId)
        if (!penalizedPlayer) {
          callback({
            success: false,
            error: "The player could not be found.",
          })
          return
        }

        addLog(room, {
          kind: "loss",
          message: `${penalizedPlayer.name} completed ${completedWord} and lost a life.`,
        })

        if (!checkForWinner(room)) {
          startNewRound(
            room,
            penalizedPlayer.id,
          )
          startTurnTimer(room)
        }

        updateRoom(room)

        callback({
          success: true,
        })

        return

      }

      const nextTurnIndex = getNextTurnIndex(room, room.turnIndex)

      if (nextTurnIndex === null) {
        callback({
          success: false,
          error: "No next player is available.",
        })
        return
      }

      room.turnIndex = nextTurnIndex
      startTurnTimer(room)
      updateRoom(room)

      callback({
        success: true,
      })
    })

    socket.on("challenge", ({ code, playerId }, callback) => {
      const normalizedCode = normalizeCode(code)
      const room = rooms.get(normalizedCode)

      if (!room) {
        callback({
          success: false,
          error: "Room not found.",
        })
        return
      }

      if (room.status !== "playing") {
        callback({
          success: false,
          error: "A challenge cannot be made right now.",
        })
        return
      }

      const challenger = getCurrentPlayer(room)

      /*
       * Because the turn advances after every letter,
       * the current player is the only player allowed
       * to challenge the previous mover.
       */
      if (!challenger || challenger.id !== playerId) {
        callback({
          success: false,
          error: "Only the next player may challenge.",
        })
        return
      }

      if (!isActivePlayer(challenger)) {
        callback({
          success: false,
          error: "You cannot make a challenge.",
        })
        return
      }

      if (!room.lastMoverId) {
        callback({
          success: false,
          error: "There is no previous move to challenge.",
        })
        return
      }

      if (!room.fragment) {
        callback({
          success: false,
          error: "There is no fragment to challenge.",
        })
        return
      }

      if (room.lastMoverId === playerId) {
        callback({
          success: false,
          error: "You cannot challenge yourself.",
        })
        return
      }

      const challengedPlayer = getPlayer(
        room,
        room.lastMoverId,
      )

      if (!challengedPlayer) {
        callback({
          success: false,
          error: "The previous player could not be found.",
        })
        return
      }

      clearTurnTimer(room.code)
      room.turnStartedAt = null
      room.status = "challenging"

      room.challenge = {
        challengerId: challenger.id,
        challengedPlayerId: challengedPlayer.id,
        fragment: room.fragment,
        startedAt: Date.now(),
      }

      addLog(room, {
        kind: "challenge",
        message: `${challenger.name} challenged ${challengedPlayer.name}.`,
      })

      updateRoom(room)

      callback({
        success: true,
      })
    },
    )

    socket.on("submit-challenge-word", ({ code, playerId, word, }, callback,) => {
      const normalizedCode = normalizeCode(code)
      const room = rooms.get(normalizedCode)

      if (!room) {
        callback({
          success: false,
          error: "Room not found.",
        })
        return
      }

      const challenge = room.challenge

      if (
        room.status !== "challenging" ||
        !challenge
      ) {
        callback({
          success: false,
          error: "There is no active challenge.",
        })
        return
      }

      /*
       * Only the player who made the previous move
       * may submit the intended word.
       */
      if (
        challenge.challengedPlayerId !== playerId
      ) {
        callback({
          success: false,
          error:
            "Only the challenged player may submit a word.",
        })
        return
      }

      const challenger = getPlayer(
        room,
        challenge.challengerId,
      )

      const challengedPlayer = getPlayer(
        room,
        challenge.challengedPlayerId,
      )

      if (!challenger || !challengedPlayer) {
        callback({
          success: false,
          error: "A challenge player could not be found.",
        })
        return
      }

      const submittedWord = normalizeWord(word)

      /*
       * Since letters can be added to either side,
       * the current fragment must appear contiguously
       * somewhere within the submitted word.
       */
      const validWord =
        submittedWord.includes(challenge.fragment) &&
        isWord(submittedWord)

      const penalizedPlayer = validWord
        ? challenger
        : challengedPlayer

      giveStrike(room, penalizedPlayer.id)

      const challengeResult: ChallengeResult = {
        /*
         * The challenge succeeds when the challenged player
         * cannot provide a valid word.
         */
        success: !validWord,
        submittedWord,
        penalizedPlayerId: penalizedPlayer.id,
        penalizedPlayerName: penalizedPlayer.name,
        challengerId: challenger.id,
        challengedPlayerId: challengedPlayer.id,
      }

      io.to(room.code).emit(
        "challenge-result",
        challengeResult,
      )

      if (validWord) {
        addLog(room, {
          kind: "challenge",
          message: `${challengedPlayer.name} proved that ${submittedWord} was valid. ${challenger.name} lost a life.`,
        })
      } else {
        addLog(room, {
          kind: "loss",
          message: `${challengedPlayer.name} could not provide a valid word and lost a life.`,
        })
      }

      room.challenge = null

      if (!checkForWinner(room)) {
        startNewRound(
          room,
          penalizedPlayer.id,
        )
        startTurnTimer(room)
      } else {
        clearTurnTimer(room.code)
        room.turnStartedAt = null
      }

      updateRoom(room)

      callback({
        success: true,
      })
    },
    )

    socket.on("send-message", ({ code, playerId, message }, callback) => {
      const normalizedCode = normalizeCode(code)
      const room = rooms.get(normalizedCode)

      if (!room) {
        callback({
          success: false,
          error: "Room not found.",
        })
        return
      }

      const player = getPlayer(room, playerId)

      if (!player) {
        callback({
          success: false,
          error: "You are not in this room.",
        })
        return
      }

      if (!player.connected) {
        callback({
          success: false,
          error: "You are not connected to this room.",
        })
        return
      }

      const cleanedMessage = message
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 200)

      if (!cleanedMessage) {
        callback({
          success: false,
          error: "Enter a message.",
        })
        return
      }

      room.messages.push({
        id: randomUUID(),
        playerId: player.id,
        playerName: player.name,
        message: cleanedMessage,
        at: Date.now(),
      })

      // Prevent chat history from growing indefinitely.
      room.messages = room.messages.slice(-100)

      updateRoom(room)

      callback({
        success: true,
      })
    },
    )

    socket.on("disconnect", () => {
      console.log(`Disconnected: ${socket.id}`);

      removePlayerFromRoom(
        socket.data.code,
        socket.data.playerId,
      )
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`Superghost running at http://${hostname}:${port}`);
  });
}

startServer().catch((error: unknown) => {
  console.error("Failed to start the server:", error);
  process.exit(1);
});