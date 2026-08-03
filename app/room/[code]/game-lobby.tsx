"use client"

import { useState } from "react"
import { Check, Copy, Ghost, Loader2, LogOut, Users } from "lucide-react"
import { MAX_PLAYERS } from "@/lib/game-config"
import { Button } from "@/app/components/button"
import { socket } from "@/lib/socket"
import type { Room } from "@/lib/game"
import HelpButton from "@/app/components/help-button"
import HelpDrawer from "@/app/components/help-drawer"

type GameLobbyProps = {
  room: Room
  playerId: string
  onLeave: () => void
}

export default function GameLobby({
  room,
  playerId,
  onLeave,
}: GameLobbyProps) {
  const [copied, setCopied] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  const code = room.code
  const isHost = room.hostId === playerId

  async function copyRoomCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)

      window.setTimeout(() => {
        setCopied(false)
      }, 1500)
    } catch {
      setError("Unable to copy the room code.")
    }
  }

  function leaveRoom(): void {
    onLeave()
  }

  function startGame(): void {
    if (!isHost || room.players.length < 2 || starting) {
      return
    }

    setStarting(true)
    setError(null)

    socket.timeout(5000).emit(
      "start-game",
      {
        code: room.code,
        playerId,
      },
      (timeoutError, response) => {
        setStarting(false)

        if (timeoutError) {
          setError("The server did not respond.")
          return
        }

        if (!response.success) {
          setError(response.error)
        }
      },
    )
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-6 px-5 py-12">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Ghost className="h-6 w-6" />
          </span>

          <div>
            <p className="text-sm text-muted-foreground">
              Superghost
            </p>

            <h1 className="text-xl font-bold">
              Game lobby
            </h1>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Leave room"
          onClick={leaveRoom}
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5 text-center">
        <p className="mb-2 text-sm text-muted-foreground">
          Room code
        </p>

        <button
          type="button"
          onClick={copyRoomCode}
          className="inline-flex items-center gap-3 rounded-xl bg-secondary px-5 py-3"
        >
          <span className="font-mono text-3xl font-bold tracking-[0.25em]">
            {code}
          </span>

          {copied ? (
            <Check className="h-5 w-5" />
          ) : (
            <Copy className="h-5 w-5" />
          )}
        </button>

        <p className="mt-3 text-xs text-muted-foreground">
          {copied
            ? "Room code copied!"
            : "Share this code with the other players."}
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <h2 className="font-semibold">Players</h2>
          </div>

          <span className="text-sm text-muted-foreground">
            {room.players.length}/{MAX_PLAYERS}
          </span>
        </div>

        <ul className="flex flex-col gap-2">
          {room.players.map((player, index) => {
            const isCurrentPlayer =
              player.id === playerId

            const playerIsHost =
              player.id === room.hostId

            return (
              <li
                key={player.id}
                className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-background text-sm font-medium">
                    {index + 1}
                  </span>

                  <div>
                    <span className="font-medium">
                      {player.name}
                    </span>

                    {!player.connected && (
                      <p className="text-xs text-muted-foreground">
                        Disconnected
                      </p>
                    )}
                  </div>
                </div>

                <span className="text-xs text-muted-foreground">
                  {isCurrentPlayer && playerIsHost
                    ? "You · Host"
                    : isCurrentPlayer
                      ? "You"
                      : playerIsHost
                        ? "Host"
                        : ""}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      {error && (
        <p
          role="alert"
          className="text-center text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {room.players.length < 2 ? (
        <p className="text-center text-sm text-muted-foreground">
          Waiting for at least one other player…
        </p>
      ) : isHost ? (
        <Button
          size="lg"
          className="h-12"
          disabled={starting}
          onClick={startGame}
        >
          {starting && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}

          Start game
        </Button>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Waiting for the host to start the game…
        </p>
      )}
      <HelpButton
        onClick={() => setHelpOpen(true)}
      />

      <HelpDrawer
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
    </main>
  )
}