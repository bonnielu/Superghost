export const MAX_PLAYERS = 6
export const MAX_STRIKES = 3
export const TURN_DURATION = 60_000
export const MIN_WORD_LENGTH = 4

import words from "an-array-of-english-words"

const dictionary = words
  .map((word) => word.toUpperCase())
  .filter((word) => word.length >= 4)

const wordSet = new Set(dictionary)

export function isWord(word: string): boolean {
  return wordSet.has(word.toUpperCase())
}

export function containsFragment(
  fragment: string,
): boolean {
  const normalized = fragment.toUpperCase()

  return dictionary.some((word) =>
    word.includes(normalized),
  )
}