"use client"

import { useState } from "react"
import { useRouter } from "next/navigation";
import { Ghost, Loader2 } from "lucide-react"

import { Button } from "./components/button"
import { socket } from "../lib/socket"
import type { RoomResponse } from "@/lib/game"
import { saveRoomSession } from "@/lib/room-session";
import { cn } from "@/lib/utils"
import HelpButton from "@/app/components/help-button"
import HelpDrawer from "@/app/components/help-drawer"


export default function Home() {
  const router = useRouter();

  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [mode, setMode] = useState<"create" | "join">("create")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  function connectSocket(): void {
    if (!socket.connected) {
      socket.connect();
    }
  }

  function handleResponse(response: RoomResponse): void {
    setBusy(false);

    if (!response.success) {
      setError(response.error);
      return;
    }

    saveRoomSession(response.session);
    router.push(`/room/${response.session.code}`);
  }

  function create(): void {
    const normalizedName = name.trim();

    if (!normalizedName) {
      setError("Please enter your name.");
      return;
    }

    setBusy(true);
    setError(null);

    connectSocket();

    socket.timeout(5000).emit(
      "create-room",
      {
        name: normalizedName,
      },
      (timeoutError, response) => {
        if (timeoutError) {
          setBusy(false);
          setError("The server did not respond.");
          return;
        }

        handleResponse(response);
      },
    );
  }

  function join(): void {
    const normalizedName = name.trim();
    const normalizedCode = code.trim().toUpperCase();

    if (!normalizedName) {
      setError("Please enter your name.");
      return;
    }

    if (normalizedCode.length !== 4) {
      setError("Enter a four-character room code.");
      return;
    }

    setBusy(true);
    setError(null);

    connectSocket();

    socket.timeout(5000).emit(
      "join-room",
      {
        name: normalizedName,
        code: normalizedCode,
      },
      (timeoutError, response) => {
        if (timeoutError) {
          setBusy(false);
          setError("The server did not respond.");
          return;
        }

        handleResponse(response);
      },
    );
  }

  function submit(): void {
    if (mode === "create") {
      create();
      return;
    }

    join();
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-8 px-5 py-12">
      <header className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Ghost className="h-7 w-7" />
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-balance">Superghost</h1>
        <p className="max-w-xs text-pretty leading-relaxed text-muted-foreground">
          Add letters to either end of a growing word. Don't be the one to complete it.
        </p>
      </header>

      <div className="w-full rounded-2xl border border-border bg-card p-5">
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
          {(["create", "join"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m)
                setError(null)
              }}
              className={cn(
                "rounded-lg py-2 text-sm font-medium capitalize transition-colors",
                mode === m ? "bg-card text-card-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {m === "create" ? "Create room" : "Join room"}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-card-foreground">Your name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 16))}
              placeholder="e.g. Aaron"
              className="h-11 rounded-xl border border-input bg-background px-3 text-foreground outline-none focus:border-primary"
            />
          </label>

          {mode === "join" && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-card-foreground">Room code</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
                placeholder="ABCD"
                className="h-11 rounded-xl border border-input bg-background px-3 font-mono text-lg uppercase tracking-widest text-foreground outline-none focus:border-primary"
              />
            </label>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            size="lg"
            className="h-12"
            disabled={busy || !name.trim() || (mode === "join" && code.length < 4)}
            onClick={mode === "create" ? create : join}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "create" ? "Create game" : "Join game"}
          </Button>
        </div>
      </div>

      <p className="max-w-sm text-center text-xs leading-relaxed text-muted-foreground text-pretty">
        Play across devices — share your room code and everyone joins the same live game. 2 to 6 players.
      </p>

      <HelpButton
        onClick={() => setHelpOpen(true)}
      />

      <HelpDrawer
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
    </main>
  );
}
