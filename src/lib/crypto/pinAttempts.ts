import { storageMMKV } from "@/lib/mmkv/stores";

/**
 * PIN attempt limiting — protection against brute-force attacks.
 *
 * Max 5 attempts before progressive lockout:
 * - 5 fails → 30 seconds
 * - 6 fails → 2 minutes
 * - 7 fails → 10 minutes
 * - 8+ fails → 30 minutes
 *
 * Attempt count + lockout time persisted in MMKV.
 */

const MMKV_KEY_ATTEMPTS = "vault_pin_attempts";
const MMKV_KEY_LOCKED_UNTIL = "vault_locked_until";

const MAX_ATTEMPTS_BEFORE_LOCK = 5;

const LOCKOUT_DURATIONS_MS = [
  30 * 1000, // 30 seconds
  2 * 60 * 1000, // 2 minutes
  10 * 60 * 1000, // 10 minutes
  30 * 60 * 1000, // 30 minutes
];

export function getFailedAttempts(): number {
  return storageMMKV.getNumber(MMKV_KEY_ATTEMPTS) ?? 0;
}

export function getLockedUntil(): number | null {
  const val = storageMMKV.getNumber(MMKV_KEY_LOCKED_UNTIL);
  if (!val || val <= Date.now()) {
    return null;
  }
  return val;
}

export function isLocked(): boolean {
  const lockedUntil = getLockedUntil();
  return lockedUntil !== null && lockedUntil > Date.now();
}

export function getRemainingLockSeconds(): number {
  const lockedUntil = getLockedUntil();
  if (!lockedUntil) return 0;
  return Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
}

/**
 * Records a failed PIN attempt. Returns the new failed count.
 * If max attempts exceeded, sets a lockout timer.
 */
export function recordFailedAttempt(): {
  attempts: number;
  lockedUntil: number | null;
} {
  const attempts = getFailedAttempts() + 1;
  storageMMKV.set(MMKV_KEY_ATTEMPTS, attempts);

  if (attempts >= MAX_ATTEMPTS_BEFORE_LOCK) {
    const lockIndex = Math.min(
      attempts - MAX_ATTEMPTS_BEFORE_LOCK,
      LOCKOUT_DURATIONS_MS.length - 1,
    );
    const lockDuration = LOCKOUT_DURATIONS_MS[lockIndex];
    const lockedUntil = Date.now() + lockDuration;
    storageMMKV.set(MMKV_KEY_LOCKED_UNTIL, lockedUntil);
    return { attempts, lockedUntil };
  }

  return { attempts, lockedUntil: null };
}

/**
 * Resets the failed attempts counter (called on successful unlock).
 */
export function resetAttempts(): void {
  storageMMKV.delete(MMKV_KEY_ATTEMPTS);
  storageMMKV.delete(MMKV_KEY_LOCKED_UNTIL);
}
