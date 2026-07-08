export type PollVoter = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type PollOptionState = {
  id: string;
  label: string;
  sort_order: number;
  vote_count: number | null;
  voters: PollVoter[];
};

export type PostPollState = {
  allow_multiple: boolean;
  show_results_to_all: boolean;
  can_see_results: boolean;
  options: PollOptionState[];
  my_option_ids: string[];
  total_voters: number | null;
};

function parseVoter(raw: unknown): PollVoter | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.username !== "string") return null;
  return {
    id: row.id,
    username: row.username,
    display_name: typeof row.display_name === "string" ? row.display_name : null,
    avatar_url: typeof row.avatar_url === "string" ? row.avatar_url : null,
  };
}

export function parsePollState(raw: unknown): PostPollState | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const options = Array.isArray(data.options) ? data.options : [];
  const myIds = Array.isArray(data.my_option_ids) ? data.my_option_ids : [];

  return {
    allow_multiple: Boolean(data.allow_multiple),
    show_results_to_all: Boolean(data.show_results_to_all),
    can_see_results: Boolean(data.can_see_results),
    total_voters: typeof data.total_voters === "number" ? data.total_voters : null,
    my_option_ids: myIds.filter((id): id is string => typeof id === "string"),
    options: options
      .map((opt) => {
        if (!opt || typeof opt !== "object") return null;
        const row = opt as Record<string, unknown>;
        if (typeof row.id !== "string" || typeof row.label !== "string") return null;
        const votersRaw = Array.isArray(row.voters) ? row.voters : [];
        return {
          id: row.id,
          label: row.label,
          sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
          vote_count: typeof row.vote_count === "number" ? row.vote_count : null,
          voters: votersRaw.map(parseVoter).filter((v): v is PollVoter => v !== null),
        };
      })
      .filter((opt): opt is PollOptionState => opt !== null)
      .sort((a, b) => a.sort_order - b.sort_order),
  };
}
