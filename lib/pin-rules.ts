/** Aturan percobaan PIN. Modul murni supaya bisa diuji unit. */
export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCK_MS = 5 * 60 * 1000;

export type PinState = { failedCount: number; lockedUntil: Date | null };

/** Masih terkunci? Mengembalikan sisa waktu kunci (ms), atau 0 bila tidak. */
export function lockRemaining(state: PinState, now: Date): number {
  return state.lockedUntil && state.lockedUntil > now ? state.lockedUntil.getTime() - now.getTime() : 0;
}

/**
 * Keadaan sesudah satu percobaan salah. Percobaan ke-5 mengunci PIN selama 5 menit dan
 * mengembalikan hitungan ke 0, jadi setelah kunci lepas ada 5 percobaan lagi.
 */
export function afterFailure(state: PinState, now: Date): PinState & { remaining: number; locked: boolean } {
  const failedCount = (lockRemaining(state, now) === 0 && state.lockedUntil ? 0 : state.failedCount) + 1;
  if (failedCount >= PIN_MAX_ATTEMPTS) {
    return { failedCount: 0, lockedUntil: new Date(now.getTime() + PIN_LOCK_MS), remaining: 0, locked: true };
  }
  return { failedCount, lockedUntil: null, remaining: PIN_MAX_ATTEMPTS - failedCount, locked: false };
}
