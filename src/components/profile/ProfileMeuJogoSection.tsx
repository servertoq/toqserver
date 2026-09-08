"use client";

import type { ComponentProps } from "react";
import {
  DOMINANT_HAND_OPTIONS,
  EXPERIENCE_BAND_OPTIONS,
  FAVORITE_COURT_OPTIONS,
  PLAY_FREQUENCY_OPTIONS,
  PLAY_STYLE_OPTIONS,
  PLAYER_LEVEL_OPTIONS,
  dominantHandLabel,
  experienceBandLabel,
  favoriteCourtLabel,
  playFrequencyLabel,
  playStyleLabel,
  playerLevelLabel,
  type DominantHand,
  type ExperienceBand,
  type FavoriteCourt,
  type PlayFrequency,
  type PlayerLevelType,
  type PlayStyle,
} from "@/lib/profile";

export type MeuJogoValues = {
  playerLevel: PlayerLevelType;
  dominantHand: DominantHand | null;
  experienceBand: ExperienceBand | null;
  playFrequency: PlayFrequency | null;
  playStyle: PlayStyle | null;
  favoriteCourt: FavoriteCourt | null;
};

type Props = MeuJogoValues & {
  isOwnProfile: boolean;
  editing?: boolean;
  onChange?: (next: Partial<MeuJogoValues>) => void;
};

function GameIcon({ name }: { name: "level" | "hand" | "clock" | "freq" | "style" | "court" }) {
  const cls = "h-5 w-5 text-[var(--toq-profile-accent)]";
  switch (name) {
    case "level":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 18V9M10 18V6M16 18v-7M20 18H3" strokeLinecap="round" />
        </svg>
      );
    case "hand":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 11V7a1.5 1.5 0 013 0v4M11 10V6a1.5 1.5 0 013 0v4M14 11V8a1.5 1.5 0 013 0v6c0 3-2 5-5.5 5S6 17 6 14v-2a1.5 1.5 0 013 0"
          />
        </svg>
      );
    case "clock":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="8" />
          <path strokeLinecap="round" d="M12 8v4l3 2" />
        </svg>
      );
    case "freq":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path strokeLinecap="round" d="M8 3v4M16 3v4M4 10h16" />
        </svg>
      );
    case "style":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3 5.6 18.4" />
        </svg>
      );
    case "court":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="5" width="18" height="14" rx="1.5" />
          <path d="M12 5v14M3 12h18" />
        </svg>
      );
  }
}

function Tile({
  icon,
  label,
  value,
}: {
  icon: ComponentProps<typeof GameIcon>["name"];
  label: string;
  value: string;
}) {
  return (
    <div className="profile-game-tile">
      <GameIcon name={icon} />
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-[var(--toq-profile-muted)]">{label}</p>
        <p className="truncate text-sm font-semibold text-[var(--toq-profile-navy)]">{value}</p>
      </div>
    </div>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--toq-profile-muted)]">
        {label}
      </span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value as T)}
        className="mt-1.5 w-full rounded-xl border border-[var(--toq-profile-border)] bg-[var(--toq-surface)] px-3 py-2 text-sm text-[var(--toq-profile-navy)] outline-none focus:border-[var(--toq-profile-accent)]"
      >
        <option value="">Selecionar</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ProfileMeuJogoSection({
  playerLevel,
  dominantHand,
  experienceBand,
  playFrequency,
  playStyle,
  favoriteCourt,
  isOwnProfile,
  editing = false,
  onChange,
}: Props) {
  if (isOwnProfile && editing && onChange) {
    return (
      <section>
        <p className="profile-section-label">Meu jogo</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Nível"
            value={playerLevel}
            options={PLAYER_LEVEL_OPTIONS}
            onChange={(value) => onChange({ playerLevel: value })}
          />
          <SelectField
            label="Mão dominante"
            value={dominantHand}
            options={DOMINANT_HAND_OPTIONS}
            onChange={(value) => onChange({ dominantHand: value })}
          />
          <SelectField
            label="Experiência"
            value={experienceBand}
            options={EXPERIENCE_BAND_OPTIONS}
            onChange={(value) => onChange({ experienceBand: value })}
          />
          <SelectField
            label="Frequência"
            value={playFrequency}
            options={PLAY_FREQUENCY_OPTIONS}
            onChange={(value) => onChange({ playFrequency: value })}
          />
          <SelectField
            label="Estilo de jogo"
            value={playStyle}
            options={PLAY_STYLE_OPTIONS}
            onChange={(value) => onChange({ playStyle: value })}
          />
          <SelectField
            label="Quadra favorita"
            value={favoriteCourt}
            options={FAVORITE_COURT_OPTIONS}
            onChange={(value) => onChange({ favoriteCourt: value })}
          />
        </div>
      </section>
    );
  }

  return (
    <section>
      <p className="profile-section-label">Meu jogo</p>
      <div className="profile-game-grid mt-4">
        <Tile icon="level" label="Nível" value={playerLevelLabel(playerLevel)} />
        <Tile icon="hand" label="Mão dominante" value={dominantHandLabel(dominantHand)} />
        <Tile icon="clock" label="Experiência" value={experienceBandLabel(experienceBand)} />
        <Tile icon="freq" label="Frequência" value={playFrequencyLabel(playFrequency)} />
        <Tile icon="style" label="Estilo de jogo" value={playStyleLabel(playStyle)} />
        <Tile icon="court" label="Quadra favorita" value={favoriteCourtLabel(favoriteCourt)} />
      </div>
    </section>
  );
}
