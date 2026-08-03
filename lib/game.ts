
export type Player = {
  id: string
  name: string
  strikes: number
  roundsWon: number
  connected: boolean
  eliminated: boolean
}

export type LogEntry = {
  id: string
  kind: "info" | "add" | "challenge" | "loss" | "win" | "system"
  message: string
  at: number
}

export type GameStatus = "lobby" | "playing" | "finished" | "challenging"

export type LetterSide = "left" | "right"

export type ChatMessage = {
  id: string
  playerId: string
  playerName: string
  message: string
  at: number
}

export type Challenge = {
  challengerId: string
  challengedPlayerId: string
  fragment: string
  startedAt: number
}

export type ChallengeResult = {
  success: boolean
  submittedWord: string
  penalizedPlayerId: string
  penalizedPlayerName: string
  challengerId: string
  challengedPlayerId: string
}

export type Room = {
  code: string
  hostId: string
  status: GameStatus
  players: Player[]
  turnIndex: number
  fragment: string
  /** id of the player who made the most recent letter add (for challenges). */
  lastMoverId: string | null
  challenge: Challenge | null
  round: number
  winnerId: string | null
  log: LogEntry[]
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
  turnStartedAt: number | null
}

export type RoomSession = {
  code: string
  playerId: string
  room: Room
}

export type BasicResponse =
  | {
    success: true
  }
  | {
    success: false
    error: string
  }

export type RoomResponse =
  | {
    success: true;
    session: RoomSession;
  }
  | {
    success: false;
    error: string;
  }

export interface ClientToServerEvents {
  "create-room": (
    data: {
      name: string;
    },
    callback: (response: RoomResponse) => void,
  ) => void;

  "join-room": (
    data: {
      name: string;
      code: string;
    },
    callback: (response: RoomResponse) => void,
  ) => void;

  "get-room": (
    data: {
      code: string;
      playerId: string;
    },
    callback: (response: RoomResponse) => void,
  ) => void;

  "leave-room": (
    data: {
      code: string;
      playerId: string;
    },
  ) => void;

  "start-game": (
    data: {
      code: string;
      playerId: string;
    },
    callback: (response: RoomResponse) => void,
  ) => void

  "play-letter": (
    data: {
      code: string;
      playerId: string;
      letter: string;
      side: LetterSide
    },
    callback: (response: BasicResponse) => void
  ) => void;

  "challenge": (
    data: {
      code: string
      playerId: string
    },
    callback: (response: BasicResponse) => void,
  ) => void

  "submit-challenge-word": (
    data: {
      code: string
      playerId: string
      word: string
    },
    callback: (response: BasicResponse) => void,
  ) => void

  "send-message": (
    data: {
      code: string
      playerId: string
      message: string
    },
    callback: (response: BasicResponse) => void,
  ) => void
}

export interface ServerToClientEvents {
  "room-updated": (room: Room) => void;

  "room-closed": (data: {
    message: string;
  }) => void;

  "challenge-result": (
    result: ChallengeResult,
  ) => void
}

export interface SocketData {
  code?: string;
  playerId?: string;
}