export type MatchInterestedUser = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type MatchInterestState = {
  capacity: number;
  interest_count: number;
  my_interested: boolean;
  is_author: boolean;
  interested: MatchInterestedUser[];
};

export function parseMatchInterestState(raw: unknown): MatchInterestState | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const capacity = Number(row.capacity);
  if (!Number.isFinite(capacity) || capacity < 1) return null;

  const interestedRaw = Array.isArray(row.interested) ? row.interested : [];
  const interested: MatchInterestedUser[] = interestedRaw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const u = item as Record<string, unknown>;
      if (typeof u.id !== "string" || typeof u.username !== "string") return null;
      return {
        id: u.id,
        username: u.username,
        display_name: typeof u.display_name === "string" ? u.display_name : null,
        avatar_url: typeof u.avatar_url === "string" ? u.avatar_url : null,
      };
    })
    .filter((u): u is MatchInterestedUser => !!u);

  return {
    capacity,
    interest_count: Number(row.interest_count) || interested.length,
    my_interested: Boolean(row.my_interested),
    is_author: Boolean(row.is_author),
    interested,
  };
}
