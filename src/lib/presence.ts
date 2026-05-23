/** Mesmo intervalo de get_online_friends (3 minutos) */
export const ONLINE_THRESHOLD_MS = 3 * 60 * 1000;

export function isUserOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;
}

export function presenceLabel(lastSeenAt: string | null | undefined): {
  online: boolean;
  text: string;
} {
  const online = isUserOnline(lastSeenAt);
  return {
    online,
    text: online ? "Online" : "Offline",
  };
}
