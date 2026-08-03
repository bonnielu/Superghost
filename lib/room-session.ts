import type { RoomSession } from "./game";

const SESSION_PREFIX = "superghost-room-";

function getStorageKey(code: string): string {
  return `${SESSION_PREFIX}${code.toUpperCase()}`;
}

export function saveRoomSession(session: RoomSession): void {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(
    getStorageKey(session.code),
    JSON.stringify(session),
  );
}

export function getRoomSession(
  code: string,
): RoomSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedSession = sessionStorage.getItem(
    getStorageKey(code),
  );

  if (!storedSession) {
    return null;
  }

  try {
    return JSON.parse(storedSession) as RoomSession;
  } catch {
    sessionStorage.removeItem(getStorageKey(code));
    return null;
  }
}

export function removeRoomSession(code: string): void {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.removeItem(getStorageKey(code));
}