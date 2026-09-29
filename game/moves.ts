// Move classification.
//
// A sentence is a combo string, not a word list: every word inside it is a move, and
// which move is decided by how hard the word is to type.
//
//   block  (<= BLOCK_MAX_CHARS)   a guard: the word is short, the defence is cheap
//   punch  (up to KICK_MIN_CHARS) the bread and butter hit
//   kick   (>= KICK_MIN_CHARS)    the heavy, KO-capable hit
//
// These two thresholds are also used by scripts/build-sentences.py, which refuses to
// write a sentence that cannot both defend and attack, and by the test suite, which
// asserts the same rule on the generated pool. Changing a threshold here means
// regenerating the pool and re-reading the balance table in docs/GAME-DESIGN.md.

import { BLOCK_MAX_CHARS, KICK_MIN_CHARS } from "./constants";
import type { MoveKind, SentenceWord } from "./types";

export function moveForWord(word: string): MoveKind {
  if (word.length <= BLOCK_MAX_CHARS) return "block";
  if (word.length >= KICK_MIN_CHARS) return "kick";
  return "punch";
}

/** Split a sentence into its words, each carrying the move it becomes. */
export function splitSentence(text: string): SentenceWord[] {
  return text
    .split(" ")
    .filter((w) => w.length > 0)
    .map<SentenceWord>((w) => ({
      text: w,
      move: moveForWord(w),
      typed: 0,
      flawed: false,
    }));
}

/** Rejoin a word list, so Prompt.text is always exactly what the player types. */
export function sentenceText(words: readonly SentenceWord[]): string {
  return words.map((w) => w.text).join(" ");
}

/**
 * Characters of the sentence before word `index`, including the single space that
 * follows each finished word. This is the index into Prompt.text, and it is what
 * makes the spaces skippable: the cursor lands on a letter, never on a space.
 */
export function charOffset(words: readonly SentenceWord[], index: number): number {
  let n = 0;
  for (let i = 0; i < index && i < words.length; i++) n += words[i].text.length + 1;
  return n;
}
