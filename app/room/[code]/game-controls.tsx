"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, ArrowRight, Loader2, Swords, Check, Ghost } from "lucide-react"
import { Button } from "@/app/components/button"
import { socket } from "@/lib/socket"
import type { LetterSide, Room, ChallengeResult } from "@/lib/game"
import { TURN_DURATION } from "@/lib/game-config"
import { cn } from "@/lib/utils"

type GameControlsProps = {
    room: Room
    playerId: string
}

const KEYBOARD_ROWS = [
    "QWERTYUIOP",
    "ASDFGHJKL",
    "ZXCVBNM",
] as const

export default function GameControls({
    room,
    playerId,
}: GameControlsProps) {
    const [selectedLetter, setSelectedLetter] =
        useState<string | null>(null)

    const [selectedSide, setSelectedSide] =
        useState<LetterSide>("right")

    const [submitting, setSubmitting] =
        useState(false)

    const [error, setError] =
        useState<string | null>(null)

    const [challengeWord, setChallengeWord] = useState("")
    const [challenging, setChallenging] = useState(false)

    const [challengeResult, setChallengeResult] = useState<ChallengeResult | null>(null)

    const currentPlayer =
        room.players[room.turnIndex] ?? null

    const isMyTurn =
        room.status === "playing" &&
        currentPlayer?.id === playerId

    const currentPlayerIsActive =
        currentPlayer &&
        currentPlayer.connected &&
        !currentPlayer.eliminated

    const activeChallenge = room.challenge
    const amChallenger = activeChallenge?.challengerId === playerId
    const amChallenged = activeChallenge?.challengedPlayerId === playerId
    const canChallenge =
        room.status === "playing" &&
        isMyTurn &&
        room.lastMoverId !== null &&
        room.lastMoverId !== playerId &&
        room.fragment.length > 0

    const [secondsRemaining, setSecondsRemaining] = useState(Math.ceil(TURN_DURATION / 1000),)

    useEffect(() => {
        setSelectedLetter(null)
        setError(null)
    }, [
        room.turnIndex,
        room.fragment,
        room.round,
    ])

    function selectLetter(
        letter: string,
    ): void {
        if (!isMyTurn || submitting) {
            return
        }

        setSelectedLetter(letter)
        setError(null)
    }

    function submitMove(): void {
        if (
            !isMyTurn ||
            !selectedLetter ||
            submitting
        ) {
            return
        }

        setSubmitting(true)
        setError(null)

        socket.timeout(5000).emit(
            "play-letter",
            {
                code: room.code,
                playerId,
                letter: selectedLetter,
                side: selectedSide,
            },
            (timeoutError, response) => {
                setSubmitting(false)

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

                setSelectedLetter(null)
            },
        )
    }

    function startChallenge(): void {
        if (!canChallenge || challenging) {
            return
        }

        setChallenging(true)
        setError(null)

        socket.timeout(5000).emit(
            "challenge",
            {
                code: room.code,
                playerId,
            },
            (timeoutError, response) => {
                setChallenging(false)

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

    function submitChallengeWord(): void {
        if (
            !amChallenged ||
            !challengeWord.trim() ||
            challenging
        ) {
            return
        }

        setChallenging(true)
        setError(null)

        socket.timeout(5000).emit(
            "submit-challenge-word",
            {
                code: room.code,
                playerId,
                word: challengeWord,
            },
            (timeoutError, response) => {
                setChallenging(false)

                if (timeoutError) {
                    setError("The server did not respond.")
                    return
                }

                if (!response.success) {
                    setError(response.error)
                    return
                }

                setChallengeWord("")
            },
        )
    }

    useEffect(() => {
        function handleKeyDown(
            event: KeyboardEvent,
        ): void {
            const target = event.target

            if (
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target instanceof HTMLSelectElement ||
                (target instanceof HTMLElement &&
                    target.isContentEditable)
            ) {
                return
            }

            if (
                !isMyTurn ||
                !currentPlayerIsActive ||
                submitting
            ) {
                return
            }

            if (/^[a-zA-Z]$/.test(event.key)) {
                event.preventDefault()
                selectLetter(event.key.toUpperCase())
                return
            }

            if (event.key === "ArrowLeft") {
                event.preventDefault()
                setSelectedSide("left")
                return
            }

            if (event.key === "ArrowRight") {
                event.preventDefault()
                setSelectedSide("right")
                return
            }

            if (event.key === "Enter") {
                event.preventDefault()

                if (!event.repeat) {
                    submitMove()
                }

                return
            }

            if (
                event.key === "Backspace" ||
                event.key === "Escape"
            ) {
                event.preventDefault()
                setSelectedLetter(null)
                setError(null)
            }
        }

        window.addEventListener(
            "keydown",
            handleKeyDown,
        )

        return () => {
            window.removeEventListener(
                "keydown",
                handleKeyDown,
            )
        }
    }, [
        isMyTurn,
        currentPlayerIsActive,
        submitting,
        selectedLetter,
        selectedSide,
        room.code,
        playerId,
    ])

    useEffect(() => {
        let hideResultTimer: ReturnType<typeof setTimeout> | undefined

        function handleChallengeResult(
            result: ChallengeResult,
        ): void {
            setChallengeResult(result)

            hideResultTimer = setTimeout(() => {
                setChallengeResult(null)
            }, 3000)
        }

        socket.on(
            "challenge-result",
            handleChallengeResult,
        )

        return () => {
            socket.off(
                "challenge-result",
                handleChallengeResult,
            )

            if (hideResultTimer) {
                clearTimeout(hideResultTimer)
            }
        }
    }, [])

    useEffect(() => {
        if (
            room.status !== "playing" ||
            room.turnStartedAt === null
        ) {
            return
        }

        function updateCountdown(): void {
            if (room.turnStartedAt === null) {
                return
            }

            const elapsed =
                Date.now() - room.turnStartedAt

            const remaining = Math.max(
                0,
                TURN_DURATION - elapsed,
            )

            setSecondsRemaining(
                Math.ceil(remaining / 1000),
            )
        }

        updateCountdown()

        const interval = window.setInterval(
            updateCountdown,
            250,
        )

        return () => {
            window.clearInterval(interval)
        }
    }, [
        room.status,
        room.turnStartedAt,
    ])

    if (room.status === "finished") {
        const winner = room.players.find(
            (player) =>
                player.id === room.winnerId,
        )

        return (
            <section className="flex min-h-136 flex-col items-center justify-center rounded-2xl border bg-card p-8 text-center">
                <h2 className="text-3xl font-bold">
                    {winner?.name ?? "A player"} won!
                </h2>

                <p className="mt-2 text-muted-foreground">
                    The game is over.
                </p>
            </section>
        )
    }

    if (challengeResult) {
        return (
            <ChallengeResultScreen
                result={challengeResult}
                playerId={playerId}
            />
        )
    }

    if (
        room.status === "challenging" &&
        activeChallenge
    ) {
        const challengedPlayer = room.players.find(
            (player) =>
                player.id ===
                activeChallenge.challengedPlayerId,
        )

        const challenger = room.players.find(
            (player) =>
                player.id ===
                activeChallenge.challengerId,
        )

        return (
            <section className="flex min-h-136 flex-col items-center justify-center rounded-2xl border bg-card p-5 text-center sm:p-8">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-[#ee852f]">
                    <Swords className="h-6 w-6" />
                </span>

                <h2 className="mt-4 text-2xl font-bold">
                    Challenge
                </h2>

                <p className="mt-2 text-muted-foreground">
                    {challenger?.name ?? "A player"} challenged{" "}
                    {challengedPlayer?.name ?? "the previous player"}.
                </p>

                <div className="mt-6 rounded-xl bg-secondary px-6 py-4">
                    <p className="text-xs text-muted-foreground">
                        Fragment
                    </p>

                    <p className="mt-1 font-mono text-3xl font-bold tracking-widest">
                        {activeChallenge.fragment}
                    </p>
                </div>

                {amChallenged ? (
                    <div className="mt-6 w-full max-w-sm">
                        <label className="text-left">
                            <span className="text-sm font-medium">
                                What word did you have in mind?
                            </span>

                            <input
                                autoFocus
                                value={challengeWord}
                                onChange={(event) => {
                                    setChallengeWord(
                                        event.target.value
                                            .toUpperCase()
                                            .replace(/[^A-Z]/g, ""),
                                    )
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        submitChallengeWord()
                                    }
                                }}
                                placeholder="Enter a word"
                                className="mt-2 h-11 w-full rounded-xl border bg-background px-3 font-mono uppercase outline-none focus:border-[#ee852f]"
                            />
                        </label>

                        <Button
                            className="mt-3 w-full"
                            disabled={
                                !challengeWord.trim() ||
                                challenging
                            }
                            onClick={submitChallengeWord}
                        >
                            {challenging && (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            )}

                            Submit word
                        </Button>
                    </div>
                ) : amChallenger ? (
                    <p className="mt-6 text-sm text-muted-foreground">
                        Waiting for {challengedPlayer?.name ?? "the challenged player"} to provide a word…
                    </p>
                ) : (
                    <p className="mt-6 text-sm text-muted-foreground">
                        Waiting for the challenge to be resolved…
                    </p>
                )}

                {error && (
                    <p
                        role="alert"
                        className="mt-4 text-sm text-destructive"
                    >
                        {error}
                    </p>
                )}
            </section>
        )
    }

    return (
        <section className="rounded-2xl border bg-card p-5 sm:p-8">
            <div className="text-center">
                <div
                    className={cn(
                        "inline-flex rounded-full px-5 py-2 text-sm font-medium",
                        isMyTurn
                            ? "bg-orange-50 text-[#ee852f]"
                            : "bg-secondary text-muted-foreground",
                    )}
                >
                    <span>
                        {isMyTurn
                            ? "Your turn"
                            : `${currentPlayer?.name ?? "Player"}'s turn`}
                        {" · "}
                        {secondsRemaining}s
                    </span>
                </div>

                <p className="mt-5 text-muted-foreground">
                    Add one letter to either end of the
                    fragment.
                </p>
            </div>

            <div className="my-10 flex min-h-24 items-center justify-center gap-2 overflow-x-auto">
                <button
                    type="button"
                    disabled={!isMyTurn}
                    aria-label="Add letter to the left"
                    onClick={() =>
                        setSelectedSide("left")
                    }
                    className={cn(
                        "flex h-20 min-w-16 items-center justify-center rounded-xl border-2 transition-colors",
                        selectedSide === "left"
                            ? "border-orange-500 bg-orange-50"
                            : "border-border",
                        !isMyTurn &&
                        "cursor-not-allowed opacity-40",
                    )}
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>

                {room.fragment.length > 0 ? (
                    room.fragment
                        .split("")
                        .map((letter, index) => (
                            <div
                                key={`${letter}-${index}`}
                                className="flex h-20 min-w-14 items-center justify-center rounded-xl bg-secondary px-3 text-3xl font-bold sm:min-w-16"
                            >
                                {letter}
                            </div>
                        ))
                ) : (
                    <div className="flex h-20 min-w-52 items-center justify-center rounded-xl bg-secondary px-6 text-muted-foreground">
                        Choose the first letter
                    </div>
                )}

                <button
                    type="button"
                    disabled={!isMyTurn}
                    aria-label="Add letter to the right"
                    onClick={() =>
                        setSelectedSide("right")
                    }
                    className={cn(
                        "flex h-20 min-w-16 items-center justify-center rounded-xl border-2 transition-colors",
                        selectedSide === "right"
                            ? "border-orange-500 bg-orange-50"
                            : "border-border",
                        !isMyTurn &&
                        "cursor-not-allowed opacity-40",
                    )}
                >
                    <ArrowRight className="h-5 w-5" />
                </button>
            </div>

            <p className="mb-5 text-center text-sm text-muted-foreground">
                Word length: {room.fragment.length}
            </p>

            <div className="space-y-2">
                {KEYBOARD_ROWS.map((row) => (
                    <div
                        key={row}
                        className="flex justify-center gap-1.5 sm:gap-2"
                    >
                        {row.split("").map((letter) => (
                            <button
                                key={letter}
                                type="button"
                                disabled={
                                    !isMyTurn ||
                                    !currentPlayerIsActive ||
                                    submitting
                                }
                                onClick={() =>
                                    selectLetter(letter)
                                }
                                className={cn(
                                    "flex h-11 min-w-8 flex-1 items-center justify-center rounded-lg border bg-background text-sm font-medium transition-colors sm:h-12 sm:max-w-12",
                                    selectedLetter === letter &&
                                    "border-orange-500 bg-orange-50 text-orange-600",
                                    (!isMyTurn ||
                                        !currentPlayerIsActive) &&
                                    "cursor-not-allowed opacity-40",
                                )}
                            >
                                {letter}
                            </button>
                        ))}
                    </div>
                ))}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Button
                    variant="outline"
                    disabled={!canChallenge || challenging}
                    onClick={startChallenge}
                >
                    <Swords className="h-4 w-4" />
                    Challenge
                </Button>

                <Button
                    disabled={
                        !isMyTurn ||
                        !selectedLetter ||
                        submitting
                    }
                    onClick={submitMove}
                >
                    {submitting && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    )}

                    {selectedLetter
                        ? `Play ${selectedLetter}`
                        : "Choose a letter"}
                </Button>
            </div>

            {error && (
                <p
                    role="alert"
                    className="mt-4 text-center text-sm text-destructive"
                >
                    {error}
                </p>
            )}
        </section>
    )
}

function ChallengeResultScreen({
    result,
    playerId,
}: {
    result: ChallengeResult
    playerId: string
}) {
    const currentPlayerWasPenalized =
        result.penalizedPlayerId === playerId

    const title = result.success
        ? "Challenge successful"
        : "Challenge failed"

    const description = result.success
        ? result.submittedWord
            ? `${result.submittedWord} was not accepted as a valid word.`
            : "No valid word was provided."
        : `${result.submittedWord} is a valid word.`

    const penaltyMessage = currentPlayerWasPenalized
        ? "You lost a life."
        : `${result.penalizedPlayerName} lost a life.`

    return (
        <section className="flex min-h-136 flex-col items-center justify-center rounded-2xl border bg-card p-6 text-center sm:p-8">
            <div
                className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-2xl",
                    result.success
                        ? "bg-green-50 text-green-600"
                        : "bg-orange-50 text-[#ee852f]",
                )}
            >
                {result.success ? (
                    <Check className="h-8 w-8" />
                ) : (
                    <Ghost className="h-8 w-8" />
                )}
            </div>

            <p
                className={cn(
                    "mt-5 text-sm font-medium",
                    result.success
                        ? "text-green-600"
                        : "text-[#ee852f]",
                )}
            >
                {result.success
                    ? "Challenge won"
                    : "Challenge lost"}
            </p>

            <h2 className="mt-2 text-3xl font-bold">
                {title}
            </h2>

            <p className="mt-3 max-w-sm text-muted-foreground">
                {description}
            </p>

            <div className="mt-6 flex items-center gap-2 rounded-xl bg-secondary px-4 py-3">
                <Ghost className="h-5 w-5 fill-[#ee852f] text-[#ee852f]" />

                <span className="font-medium">
                    {penaltyMessage}
                </span>
            </div>

            <p className="mt-6 text-sm text-muted-foreground">
                Starting the next round…
            </p>
        </section>
    )
}

