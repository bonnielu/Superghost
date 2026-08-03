"use client"

import { useState, useEffect, useRef } from "react"
import { Ghost, LogOut, Users, Check, Copy, Send, MessageCircle } from "lucide-react"
import { MAX_STRIKES } from "@/lib/game-config"
import { Button } from "@/app/components/button"
import type { Room } from "@/lib/game"
import { socket } from "@/lib/socket"
import GameControls from "./game-controls"
import { cn } from "@/lib/utils"
import HelpButton from "@/app/components/help-button"
import HelpDrawer from "@/app/components/help-drawer"

type GameScreenProps = {
    room: Room
    playerId: string
    onLeave: () => void
}

export default function GameScreen({
    room,
    playerId,
    onLeave,
}: GameScreenProps) {
    const currentPlayer =
        room.players[room.turnIndex] ?? null
    const [copied, setCopied] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [helpOpen, setHelpOpen] = useState(false)

    const isMyTurn =
        currentPlayer?.id === playerId

    async function copyRoomCode(): Promise<void> {
        try {
            await navigator.clipboard.writeText(room.code)
            setCopied(true)

            window.setTimeout(() => {
                setCopied(false)
            }, 1500)
        } catch {
            setError("Unable to copy the room code.")
        }
    }

    return (
        <main className="min-h-svh bg-background px-5 py-6">
            <div className="mx-auto max-w-7xl">
                <header className="mb-6 flex items-center justify-between border-b pb-5">
                    <div className="flex items-center gap-3">
                        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                            <Ghost className="h-6 w-6" />
                        </span>

                        <div>
                            <p className="text-2xl font-semibold">
                                Superghost
                            </p>
                        </div>
                    </div>

                    <div className="hidden text-center sm:block">
                        <p className="text-xs text-muted-foreground">
                            Room code
                        </p>

                        <Button
                            variant="outline"
                            onClick={copyRoomCode}
                        >
                            <span className="font-mono text-l font-bold tracking-[0.25em]">
                                {room.code}
                            </span>

                            {copied ? (
                                <Check className="h-4 w-4" />
                            ) : (
                                <Copy className="h-4 w-4" />
                            )}
                        </Button>
                    </div>

                    <Button
                        variant="outline"
                        onClick={onLeave}
                    >
                        <LogOut className="h-4 w-4" />
                        Leave room
                    </Button>
                </header>

                <div className="grid items-stretch gap-5 lg:h-[40rem] lg:grid-cols-[16rem_minmax(0,1fr)_19rem]">
                    <PlayersPanel
                        room={room}
                        playerId={playerId}
                    />

                    <GameControls
                        room={room}
                        playerId={playerId}
                    />

                    <ActivityChatPanel
                        room={room}
                        playerId={playerId}
                    />
                </div>

                <p className="mt-4 text-center text-sm text-muted-foreground lg:hidden">
                    {isMyTurn
                        ? "It is your turn."
                        : `Waiting for ${currentPlayer?.name ?? "the next player"
                        }.`}
                </p>
            </div>
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

function PlayersPanel({
    room,
    playerId,
}: {
    room: Room
    playerId: string
}) {
    return (
        <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Users className="h-5 w-5" />

                    <h2 className="font-semibold">
                        Players
                    </h2>
                </div>

                <span className="text-sm text-muted-foreground">
                    {room.players.length}/6
                </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
                <div className="space-y-2">
                    {room.players.map((player) => {
                        const isCurrent =
                            room.players[room.turnIndex]?.id ===
                            player.id

                        const isMe =
                            player.id === playerId

                        return (
                            <div
                                key={player.id}
                                className={`rounded-xl px-3 py-3 ${isCurrent
                                    ? "bg-orange-50 ring-1 ring-orange-200"
                                    : "bg-secondary"
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className="font-medium">
                                            {player.name}
                                        </p>

                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            {isMe && player.id === room.hostId
                                                ? "You · Host"
                                                : isMe
                                                    ? "You"
                                                    : player.id === room.hostId
                                                        ? "Host"
                                                        : isCurrent
                                                            ? "Current turn"
                                                            : ""}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-3 flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">
                                        Lives
                                    </span>

                                    <GhostStrikes
                                        strikes={player.strikes}
                                        maxStrikes={MAX_STRIKES}
                                    />
                                </div>

                                {player.eliminated && (
                                    <p className="mt-2 text-xs font-medium text-destructive">
                                        Eliminated
                                    </p>
                                )}
                            </div>
                        )
                    })}
                </div>

            </div>
        </aside>
    )
}

function GhostStrikes({
    strikes,
    maxStrikes,
}: {
    strikes: number
    maxStrikes: number
}) {
    return (
        <div
            className="flex gap-1"
            aria-label={`${strikes} of ${maxStrikes} strikes`}
        >
            {Array.from({
                length: maxStrikes,
            }).map((_, index) => {
                const received = index < strikes

                return (
                    <Ghost
                        key={index}
                        className={`h-5 w-5 ${received
                            ? "text-muted-foreground/30"
                            : "text-[#ee852f]"
                            }`}
                    />
                )
            })}
        </div>
    )
}

function ActivityChatPanel({
    room,
    playerId,
}: {
    room: Room
    playerId: string
}) {
    const [selectedTab, setSelectedTab] =
        useState<"activity" | "chat">("activity")

    const [message, setMessage] = useState("")
    const [sending, setSending] = useState(false)

    const [error, setError] =
        useState<string | null>(null)

    const scrollAreaRef =
        useRef<HTMLDivElement | null>(null)

    const entries = room.log ?? []
    const messages = room.messages ?? []

    useEffect(() => {
        if (selectedTab !== "chat") {
            return
        }

        const scrollArea = scrollAreaRef.current

        if (scrollArea) {
            scrollArea.scrollTop =
                scrollArea.scrollHeight
        }
    }, [
        messages.length,
        selectedTab,
    ])

    function sendMessage(): void {
        const cleanedMessage = message.trim()

        if (!cleanedMessage || sending) {
            return
        }

        setSending(true)
        setError(null)

        socket.timeout(5000).emit(
            "send-message",
            {
                code: room.code,
                playerId,
                message: cleanedMessage,
            },
            (timeoutError, response) => {
                setSending(false)

                if (timeoutError) {
                    setError(
                        "The server did not respond.",
                    )
                    return
                }

                if (!response.success) {
                    setError(response.error)
                    return
                }

                setMessage("")
            },
        )
    }

    return (
        <aside className="flex h-[32rem] min-h-0 flex-col overflow-hidden rounded-2xl border bg-card lg:h-[40rem]">
            <div className="grid shrink-0 grid-cols-2 border-b p-1">
                <button
                    type="button"
                    onClick={() => {
                        setSelectedTab("activity")
                        setError(null)
                    }}
                    className={cn(
                        "flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                        selectedTab === "activity"
                            ? "bg-secondary text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                    )}
                >
                    Activity
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setSelectedTab("chat")
                        setError(null)
                    }}
                    className={cn(
                        "flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                        selectedTab === "chat"
                            ? "bg-secondary text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                    )}
                >
                    Chat
                </button>
            </div>

            <div
                ref={scrollAreaRef}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4"
            >
                {selectedTab === "activity" ? (
                    entries.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Moves will appear here.
                        </p>
                    ) : (
                        <ol className="space-y-4">
                            {entries
                                .slice()
                                .reverse()
                                .map((entry) => (
                                    <li
                                        key={entry.id}
                                        className="border-b pb-3 text-sm last:border-b-0"
                                    >
                                        <p>{entry.message}</p>

                                        <time className="mt-1 block text-xs text-muted-foreground">
                                            {new Date(entry.at).toLocaleTimeString([], {
                                                hour: "numeric",
                                                minute: "2-digit",
                                            })}
                                        </time>
                                    </li>
                                ))}
                        </ol>
                    )
                ) : messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No messages yet.
                    </p>
                ) : (
                    <ol className="space-y-4">
                        {messages.map((chatMessage, index) => {
                            const isMine =
                                chatMessage.playerId === playerId

                            const previousMessage =
                                index > 0
                                    ? messages[index - 1]
                                    : null

                            const isGrouped =
                                previousMessage?.playerId ===
                                chatMessage.playerId &&
                                chatMessage.at - previousMessage.at <
                                5 * 60 * 1000

                            return (
                                <li
                                    key={chatMessage.id}
                                    className={cn(
                                        "flex flex-col",
                                        isMine
                                            ? "items-end"
                                            : "items-start",
                                        isGrouped && "-mt-2",
                                    )}
                                >
                                    {!isGrouped && (
                                        <div
                                            className={cn(
                                                "mb-1 flex max-w-[90%] items-center gap-1 px-1 text-xs text-muted-foreground",
                                                isMine
                                                    ? "justify-end text-right"
                                                    : "justify-start text-left",
                                            )}
                                        >
                                            <span className="font-medium">
                                                {isMine
                                                    ? "You"
                                                    : chatMessage.playerName}
                                            </span>

                                            <span aria-hidden="true">
                                                ·
                                            </span>

                                            <time>
                                                {new Date(
                                                    chatMessage.at,
                                                ).toLocaleTimeString([], {
                                                    hour: "numeric",
                                                    minute: "2-digit",
                                                })}
                                            </time>
                                        </div>
                                    )}

                                    <div
                                        className={cn(
                                            "max-w-[90%] wrap-break-word rounded-2xl px-4 py-2.5 text-sm",
                                            isMine
                                                ? "bg-[#ee852f] text-white"
                                                : "bg-secondary text-foreground",
                                            isGrouped &&
                                            (isMine
                                                ? "rounded-tr-md"
                                                : "rounded-tl-md"),
                                        )}
                                    >
                                        {chatMessage.message}
                                    </div>
                                </li>
                            )
                        })}
                    </ol>
                )}
            </div>

            {selectedTab === "chat" && (
                <div className="shrink-0 border-t bg-card p-3">
                    <div className="flex gap-2">
                        <input
                            value={message}
                            maxLength={200}
                            placeholder="Type a message…"
                            aria-label="Chat message"
                            onChange={(event) => {
                                setMessage(event.target.value)
                                setError(null)
                            }}
                            onKeyDown={(event) => {
                                if (
                                    event.key === "Enter" &&
                                    !event.shiftKey
                                ) {
                                    event.preventDefault()
                                    sendMessage()
                                }
                            }}
                            className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-[#ee852f]"
                        />

                        <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            aria-label="Send message"
                            disabled={!message.trim() || sending}
                            onClick={sendMessage}
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>

                    {error && (
                        <p
                            role="alert"
                            className="mt-2 text-xs text-destructive"
                        >
                            {error}
                        </p>
                    )}
                </div>
            )}
        </aside>
    )
}