"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Ghost, Loader2 } from "lucide-react";
import { Button } from "@/app/components/button";
import { getRoomSession, removeRoomSession } from "@/lib/room-session";
import { socket } from "@/lib/socket";
import type { Room, RoomSession } from "@/lib/game";
import GameLobby from "./game-lobby"
import GameScreen from "./game-screen"

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();

  const code = params.code.toUpperCase();

  const [session, setSession] = useState<RoomSession | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isPageUnloadingRef = useRef(false);
  const hasLeftRoomRef = useRef(false);

  useEffect(() => {
    const storedSession = getRoomSession(code);

    if (!storedSession) {
      setError(
        "Please join this room from the home page.",
      );
      setLoading(false);
      return;
    }

    setSession(storedSession);

    function handleRoomUpdated(updatedRoom: Room): void {
      if (updatedRoom.code === code) {
        setRoom(updatedRoom);
      }
    }

    function handleRemovedFromRoom(data: {
      message: string;
    }): void {
      removeRoomSession(code);
      setError(data.message);
      setRoom(null);
    }

    socket.on("room-updated", handleRoomUpdated);
    socket.on(
      "room-closed",
      handleRemovedFromRoom,
    );

    if (!socket.connected) {
      socket.connect();
    }

    socket.timeout(5000).emit(
      "get-room",
      {
        code,
        playerId: storedSession.playerId,
      },
      (timeoutError, response) => {
        setLoading(false);

        if (timeoutError) {
          setError("Oops, the server didn't respond!");
          return;
        }

        if (!response.success) {
          removeRoomSession(code);
          setError(response.error);
          return;
        }
        setRoom(response.session["room"]);
      },
    );

    return () => {
      socket.off("room-updated", handleRoomUpdated);
      socket.off(
        "room-closed",
        handleRemovedFromRoom,
      );
    };
  }, [code]);

  useEffect(() => {
    function handleBeforeUnload(): void {
      /*
       * A refresh, tab close, or full-page navigation is
       * beginning. Let the server's reconnection grace
       * period handle the disconnection.
       */
      isPageUnloadingRef.current = true;
    }

    window.addEventListener(
      "beforeunload",
      handleBeforeUnload,
    );

    return () => {
      window.removeEventListener(
        "beforeunload",
        handleBeforeUnload,
      );

      /*
       * Client-side navigation, including the browser Back
       * button, unmounts this component without firing
       * beforeunload.
       */
      if (
        session &&
        !isPageUnloadingRef.current &&
        !hasLeftRoomRef.current
      ) {
        hasLeftRoomRef.current = true;

        socket.emit("leave-room", {
          code,
          playerId: session.playerId,
        });
        removeRoomSession(code);
      }
    };
  }, [code, session]);

  // async function copyRoomCode(): Promise<void> {
  //   try {
  //     await navigator.clipboard.writeText(code);
  //     setCopied(true);

  //     window.setTimeout(() => {
  //       setCopied(false);
  //     }, 1500);
  //   } catch {
  //     setError("Could not copy the room code.");
  //   }
  // }

  function leaveRoom(): void {
    if (session) {
      socket.emit("leave-room", {
        code,
        playerId: session.playerId,
      });
      removeRoomSession(code)
      router.push("/")
    }

    removeRoomSession(code);
    router.push("/");
  }

  if (loading) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading room…
        </div>
      </main>
    );
  }

  if (error || !session || !room) {
    console.log(session)
    console.log(room)
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
        <Ghost className="h-12 w-12 text-muted-foreground" />

        <h1 className="text-2xl font-bold">
          Unable to open room
        </h1>

        <p className="text-sm text-muted-foreground">
          {error ?? "This room is unavailable."}
        </p>

        <Button onClick={() => router.push("/")}>
          Return home
        </Button>
      </main>
    );
  }

  if (
    room.status === "playing" ||
    room.status === "finished" ||
    room.status === "challenging"
  ) {
    return (
      <GameScreen
        room={room}
        playerId={session.playerId}
        onLeave={leaveRoom}
      />
    )
  }

  return (
    <GameLobby
      room={room}
      playerId={session.playerId}
      onLeave={leaveRoom}
    />
  )
}