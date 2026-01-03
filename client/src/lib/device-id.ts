const DEVICE_ID_KEY = 'chamadospro_device_id';
const DEVICE_ID_COOKIE = 'chamadospro_device_id';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const parts = document.cookie.split(';');
  const target = `${name}=`;
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(target)) {
      return decodeURIComponent(trimmed.slice(target.length));
    }
  }
  return null;
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; path=/; max-age=${maxAgeSeconds}; samesite=lax${secure}`;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
    ''
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16
  )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getTrialDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let storedId = '';

  try {
    storedId = localStorage.getItem(DEVICE_ID_KEY) || '';
  } catch (error) {
    console.warn('[DeviceId] Failed to read localStorage:', error);
  }

  if (!storedId) {
    storedId = getCookieValue(DEVICE_ID_COOKIE) || '';
  }

  if (!storedId) {
    storedId = generateId();
    try {
      localStorage.setItem(DEVICE_ID_KEY, storedId);
    } catch (error) {
      console.warn('[DeviceId] Failed to persist localStorage:', error);
    }
  }

  setCookie(DEVICE_ID_COOKIE, storedId, ONE_YEAR_SECONDS);
  return storedId;
}
