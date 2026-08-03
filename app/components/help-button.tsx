"use client"

import { CircleHelp } from "lucide-react"

import { Button } from "@/app/components/button"

type HelpButtonProps = {
  onClick: () => void
}

export default function HelpButton({
  onClick,
}: HelpButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="How to play"
      title="How to play"
      onClick={onClick}
      className="fixed bottom-5 right-5 z-40 h-11 w-11 rounded-full bg-background shadow-md"
    >
      <CircleHelp className="h-5 w-5" />
    </Button>
  )
}