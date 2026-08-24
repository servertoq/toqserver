"use client";

import {
  dominantHandLabel,
  experienceBandLabel,
  favoriteCourtLabel,
  playFrequencyLabel,
  playStyleLabel,
  type DominantHand,
  type ExperienceBand,
  type FavoriteCourt,
  type PlayFrequency,
  type PlayStyle,
} from "@/lib/profileGame";
import { playerLevelLabel, type PlayerLevelType } from "@/lib/profile";

type Props = {
  playerLevel: PlayerLevelType;
  dominantHand: DominantHand | null;
  experienceBand: ExperienceBand | null;
  playFrequency: PlayFrequency | null;
  playStyle: PlayStyle | null;
  favoriteCourt: FavoriteCourt | null;
};

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--toq-profile-border)] bg-[var(--toq-card)] px-3 py-3.5 text-center shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--toq-profile-muted)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-[var(--toq-profile-navy)]">{value}</p>
    </div>
  );
}

export function ProfileMeuJogoGrid({
  playerLevel,
  dominantHand,
  experienceBand,
  playFrequency,
  playStyle,
  favoriteCourt,
}: Props) {
  return (
    <section>
      <p className="profile-section-label">Meu jogo</p>
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <Card label="Nível" value={playerLevelLabel(playerLevel)} />
        <Card label="Mão dominante" value={dominantHandLabel(dominantHand)} />
        <Card label="Experiência" value={experienceBandLabel(experienceBand)} />
        <Card label="Frequência" value={playFrequencyLabel(playFrequency)} />
        <Card label="Estilo de jogo" value={playStyleLabel(playStyle)} />
        <Card label="Quadra favorita" value={favoriteCourtLabel(favoriteCourt)} />
      </div>
    </section>
  );
}
