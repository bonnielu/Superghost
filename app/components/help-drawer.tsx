"use client"

import { useEffect } from "react"
import {
    CircleHelp,
    Ghost,
    Keyboard,
    Swords,
    Trophy,
    X,
    HatGlasses
} from "lucide-react"

import { Button } from "@/app/components/button"

type HelpDrawerProps = {
    open: boolean
    onClose: () => void
}

export default function HelpDrawer({
    open,
    onClose,
}: HelpDrawerProps) {
    useEffect(() => {
        if (!open) {
            return
        }

        function handleKeyDown(
            event: KeyboardEvent,
        ): void {
            if (event.key === "Escape") {
                onClose()
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
    }, [open, onClose])

    useEffect(() => {
        document.body.style.overflow =
            open ? "hidden" : ""

        return () => {
            document.body.style.overflow = ""
        }
    }, [open])

    if (!open) {
        return null
    }

    return (
        <div
            className="fixed inset-0 z-50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
        >
            <button
                type="button"
                aria-label="Close help"
                onClick={onClose}
                className="absolute inset-0 bg-black/20"
            />

            <aside className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l bg-background shadow-xl">
                <header className="flex shrink-0 items-center justify-between border-b px-5 py-4">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-[#ee852f]">
                            <CircleHelp className="h-5 w-5" />
                        </span>

                        <div>
                            <h2
                                id="help-title"
                                className="font-semibold"
                            >
                                How to play
                            </h2>
                        </div>
                    </div>

                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Close help"
                        onClick={onClose}
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
                    <div className="space-y-7">
                        <HelpSection
                            icon={<Ghost className="h-5 w-5" />}
                            title="Objective"
                        >
                            Build a word one letter at a time. Avoid being the player who
                            completes a valid English word.
                        </HelpSection>

                        <HelpSection
                            icon={
                                <Keyboard className="h-5 w-5" />
                            }
                            title="Taking a turn"
                        >
                            Add exactly one letter to the left or
                            right of the fragment before the timer
                            runs out. Every move must keep the
                            fragment capable of becoming a valid
                            English word.
                        </HelpSection>

                        <HelpSection
                            icon={<HatGlasses className="h-5 w-5" />}
                            title="Bluffing"
                        >
                            Not sure where the fragment is going? Bluff anyway. You can add a letter even if you don't know the final word—but if you're challenged, you'll need to prove a valid word exists.
                        </HelpSection>

                        <HelpSection
                            icon={
                                <Swords className="h-5 w-5" />
                            }
                            title="Challenges"
                        >
                            Only the next player may challenge the previous move. Challenge if you believe the previous player cannot provide a valid English word containing the current fragment.
                        </HelpSection>

                        <div className="rounded-xl border bg-secondary/60 p-4">
                            <p className="text-sm font-medium">
                                Example
                            </p>

                            <div className="mt-3 rounded-lg bg-background px-4 py-3 text-center">
                                <p className="text-xs text-muted-foreground">
                                    Current fragment
                                </p>

                                <p className="mt-1 font-mono text-2xl font-bold tracking-widest">
                                    OSTR
                                </p>
                            </div>

                            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                                The next player challenges, believing there is no
                                valid English word containing the fragment. The
                                challenged player responds with{" "}
                                <span className="font-medium text-foreground">
                                    OSTRICH
                                </span>
                                . Since a valid word exists, the challenge fails
                                and the challenger loses a life.
                            </p>
                        </div>

                        <HelpSection
                            icon={<Ghost className="h-5 w-5" />}
                            title="Ghosts"
                        >
                            Completing a word, losing a challenge, or running out of time costs one life. Lose all three lives and you're eliminated.
                        </HelpSection>

                        <HelpSection
                            icon={
                                <Trophy className="h-5 w-5" />
                            }
                            title="Winning"
                        >
                            The last remaining player wins.
                        </HelpSection>

                        <section>
                            <h3 className="font-medium">
                                Keyboard shortcuts
                            </h3>

                            <div className="mt-3 space-y-2 text-sm">
                                <Shortcut
                                    keys="A–Z"
                                    action="Choose a letter"
                                />

                                <Shortcut
                                    keys="← / →"
                                    action="Choose a side"
                                />

                                <Shortcut
                                    keys="Enter"
                                    action="Play the letter"
                                />

                                <Shortcut
                                    keys="Esc"
                                    action="Close this panel"
                                />
                            </div>
                        </section>
                    </div>
                </div>

                <footer className="shrink-0 border-t p-4">
                    <Button
                        type="button"
                        className="w-full"
                        onClick={onClose}
                    >
                        Got it
                    </Button>
                </footer>
            </aside>
        </div>
    )
}

function HelpSection({
    icon,
    title,
    children,
}: {
    icon: React.ReactNode
    title: string
    children: React.ReactNode
}) {
    return (
        <section>
            <div className="flex items-center gap-2 text-[#ee852f]">
                {icon}

                <h3 className="font-medium text-foreground">
                    {title}
                </h3>
            </div>

            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {children}
            </p>
        </section>
    )
}

function Shortcut({
    keys,
    action,
}: {
    keys: string
    action: string
}) {
    return (
        <div className="flex items-center justify-between gap-4">
            <kbd className="rounded-md border bg-secondary px-2 py-1 font-mono text-xs">
                {keys}
            </kbd>

            <span className="text-right text-muted-foreground">
                {action}
            </span>
        </div>
    )
}