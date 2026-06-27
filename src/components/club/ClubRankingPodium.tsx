import type { ClubRankingEntry } from "@/types/clubFeatures";

const TOP_N = 5;

type Props = {
  entries: ClubRankingEntry[];
  unitLabel: string;
  canManage: boolean;
  onRemove: (entryId: string) => void;
};

type SlotProps = {
  rank: number;
  entry: ClubRankingEntry;
  unitLabel: string;
  tier: "gold" | "silver" | "bronze" | "default";
  canManage: boolean;
  onRemove: (entryId: string) => void;
};

function rankLabel(rank: number) {
  return `${rank}º`;
}

function tierForRank(rank: number): SlotProps["tier"] {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return "default";
}

function RankingAvatar({
  src,
  name,
  size,
}: {
  src: string | null | undefined;
  name: string;
  size: "sm" | "md" | "lg";
}) {
  const initial = name.charAt(0).toUpperCase() || "?";

  return (
    <div className={`club-ranking-avatar club-ranking-avatar--${size}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : (
        <span className="club-ranking-avatar-fallback">{initial}</span>
      )}
    </div>
  );
}

function PodiumSlot({ rank, entry, unitLabel, tier, canManage, onRemove }: SlotProps) {
  const username = entry.profile?.username ?? "jogador";
  const size = rank === 1 ? "lg" : rank <= 3 ? "md" : "sm";

  return (
    <div className={`club-ranking-slot club-ranking-slot--${tier}`}>
      <div className="club-ranking-slot-body">
        <span className={`club-ranking-rank club-ranking-rank--${tier}`}>{rankLabel(rank)}</span>
        <RankingAvatar src={entry.profile?.avatar_url} name={username} size={size} />
        <div className="club-ranking-slot-info">
          <p className="club-ranking-slot-name" title={`@${username}`}>
            @{username}
          </p>
          <p className="club-ranking-slot-score">
            {entry.score.toLocaleString("pt-BR")}{" "}
            <span className="club-ranking-slot-unit">{unitLabel}</span>
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => onRemove(entry.id)}
            className="club-ranking-slot-remove"
            aria-label={`Remover @${username}`}
          >
            ×
          </button>
        )}
      </div>
      <div className={`club-ranking-pedestal club-ranking-pedestal--rank-${rank}`} aria-hidden />
    </div>
  );
}

export function ClubRankingPodium({ entries, unitLabel, canManage, onRemove }: Props) {
  const top = entries.slice(0, TOP_N);
  const [first, second, third, fourth, fifth] = top;

  if (top.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-xs text-[var(--toq-text-muted)]">
        Nenhum jogador nesta categoria ainda.
      </p>
    );
  }

  return (
    <div className="club-ranking-podium">
      {first && (
        <div className="club-ranking-podium-row club-ranking-podium-row--1">
          <PodiumSlot
            rank={1}
            entry={first}
            unitLabel={unitLabel}
            tier={tierForRank(1)}
            canManage={canManage}
            onRemove={onRemove}
          />
        </div>
      )}

      {(second || third) && (
        <div className="club-ranking-podium-row club-ranking-podium-row--2">
          {second && (
            <PodiumSlot
              rank={2}
              entry={second}
              unitLabel={unitLabel}
              tier={tierForRank(2)}
              canManage={canManage}
              onRemove={onRemove}
            />
          )}
          {third && (
            <PodiumSlot
              rank={3}
              entry={third}
              unitLabel={unitLabel}
              tier={tierForRank(3)}
              canManage={canManage}
              onRemove={onRemove}
            />
          )}
        </div>
      )}

      {(fourth || fifth) && (
        <div className="club-ranking-podium-row club-ranking-podium-row--3">
          {fourth && (
            <PodiumSlot
              rank={4}
              entry={fourth}
              unitLabel={unitLabel}
              tier={tierForRank(4)}
              canManage={canManage}
              onRemove={onRemove}
            />
          )}
          {fifth && (
            <PodiumSlot
              rank={5}
              entry={fifth}
              unitLabel={unitLabel}
              tier={tierForRank(5)}
              canManage={canManage}
              onRemove={onRemove}
            />
          )}
        </div>
      )}

      {entries.length > TOP_N && (
        <p className="club-ranking-top-note">
          Exibindo os {TOP_N} melhores de {entries.length} jogadores
        </p>
      )}
    </div>
  );
}
