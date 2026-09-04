/* ─────────────────────────────────────────────
 * PIN del barbero: hash + bloqueo por intentos.
 *
 * El PIN nunca se guarda en texto plano: solo su hash SHA-256
 * con sal. Además, tras varios intentos fallidos se bloquea
 * temporalmente la pantalla de acceso.
 * ───────────────────────────────────────────── */

const PIN_SALT = 'barberia-pin-v1';
const LOCK_KEY = 'barber_pin_lock_v1';

export const MAX_PIN_FAILS = 5;
export const PIN_LOCK_SECONDS = 180;

/** ¿El valor ya es un hash (SHA-256 hex o fallback)? */
export const isPinHash = (value: string): boolean =>
  /^[0-9a-f]{64}$/.test(value) || /^f:[0-9a-f]{16}$/.test(value);

const bytesToHex = (buf: ArrayBuffer): string =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

/** Hash no criptográfico, solo como respaldo si no hay SubtleCrypto. */
const fallbackHash = (text: string): string => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `f:${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0)
    .toString(16)
    .padStart(8, '0')}`;
};

export const hashPin = async (pin: string): Promise<string> => {
  const input = `${PIN_SALT}:${pin}`;
  try {
    const subtle = typeof crypto !== 'undefined' ? crypto.subtle : undefined;
    if (subtle) {
      const digest = await subtle.digest('SHA-256', new TextEncoder().encode(input));
      return bytesToHex(digest);
    }
  } catch {
    // sin SubtleCrypto: usar respaldo
  }
  return fallbackHash(input);
};

export const verifyPin = async (pin: string, stored: string): Promise<boolean> => {
  if (!pin || !stored) return false;
  const hashed = await hashPin(pin);
  return hashed === stored;
};

/* ── Bloqueo por intentos fallidos ── */
interface PinLockState {
  fails: number;
  lockedUntil: number; // epoch ms
}

const readLock = (): PinLockState => {
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    if (!raw) return { fails: 0, lockedUntil: 0 };
    const parsed = JSON.parse(raw) as Partial<PinLockState>;
    return {
      fails: typeof parsed.fails === 'number' ? parsed.fails : 0,
      lockedUntil: typeof parsed.lockedUntil === 'number' ? parsed.lockedUntil : 0,
    };
  } catch {
    return { fails: 0, lockedUntil: 0 };
  }
};

const writeLock = (state: PinLockState): void => {
  try {
    localStorage.setItem(LOCK_KEY, JSON.stringify(state));
  } catch {
    // almacenamiento no disponible
  }
};

export const getPinLockState = (): { fails: number; lockedSecondsLeft: number } => {
  const { fails, lockedUntil } = readLock();
  const left = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
  return { fails: left > 0 ? fails : 0, lockedSecondsLeft: left };
};

export const recordPinFailure = (): {
  locked: boolean;
  secondsLeft: number;
  failsLeft: number;
} => {
  const { fails } = readLock();
  const nextFails = fails + 1;
  if (nextFails >= MAX_PIN_FAILS) {
    writeLock({ fails: 0, lockedUntil: Date.now() + PIN_LOCK_SECONDS * 1000 });
    return { locked: true, secondsLeft: PIN_LOCK_SECONDS, failsLeft: 0 };
  }
  writeLock({ fails: nextFails, lockedUntil: 0 });
  return { locked: false, secondsLeft: 0, failsLeft: MAX_PIN_FAILS - nextFails };
};

export const clearPinFailures = (): void => {
  try {
    localStorage.removeItem(LOCK_KEY);
  } catch {
    // ignorar
  }
};

export const formatLockCountdown = (totalSeconds: number): string => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};
