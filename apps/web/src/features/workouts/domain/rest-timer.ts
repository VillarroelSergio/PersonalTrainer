/**
 * A rest period is anchored to a deadline rather than to a chain of one-second
 * callbacks. Backgrounded mobile tabs can delay callbacks; the deadline keeps
 * the visible clock correct when the person returns to Trainer.
 */
export function remainingRestSeconds(endsAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

export function isRestComplete(endsAt: number, now = Date.now()): boolean {
  return now >= endsAt;
}

export function adjustRestSeconds(current: number, change: number, min = 15, max = 300): number {
  return Math.min(max, Math.max(min, current + change));
}
