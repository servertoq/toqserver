import type { MatchResultPayload, MatchSetScore } from "@/types/feed";

export function matchResultSetsFromRow(row: {
  set1_team1?: number | null;
  set1_team2?: number | null;
  set2_team1?: number | null;
  set2_team2?: number | null;
  set3_team1?: number | null;
  set3_team2?: number | null;
  team1_score?: number | null;
  team2_score?: number | null;
}): MatchSetScore[] {
  const hasSetColumns =
    row.set1_team1 != null &&
    row.set1_team2 != null;

  if (hasSetColumns) {
    return [
      { team1: Number(row.set1_team1), team2: Number(row.set1_team2) },
      {
        team1: row.set2_team1 != null ? Number(row.set2_team1) : null,
        team2: row.set2_team2 != null ? Number(row.set2_team2) : null,
      },
      {
        team1: row.set3_team1 != null ? Number(row.set3_team1) : null,
        team2: row.set3_team2 != null ? Number(row.set3_team2) : null,
      },
    ];
  }

  return [
    {
      team1: Number(row.team1_score ?? 0),
      team2: Number(row.team2_score ?? 0),
    },
    { team1: null, team2: null },
    { team1: null, team2: null },
  ];
}

export function setsWonFromScores(sets: MatchSetScore[]): { team1: number; team2: number } {
  let team1 = 0;
  let team2 = 0;
  for (const s of sets) {
    if (s.team1 == null || s.team2 == null) continue;
    if (s.team1 > s.team2) team1 += 1;
    else if (s.team2 > s.team1) team2 += 1;
  }
  return { team1, team2 };
}

export function parseSetScoreInput(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n < 0 || n > 99) return null;
  return n;
}

export function validateThreeSetInputs(
  sets: { team1: string; team2: string }[]
): { ok: true; values: MatchSetScore[] } | { ok: false; message: string } {
  if (sets.length !== 3) {
    return { ok: false, message: "Informe os três sets." };
  }

  const values: MatchSetScore[] = [];
  const labels = ["1º", "2º", "3º"];

  for (let i = 0; i < 3; i++) {
    const t1 = parseSetScoreInput(sets[i]!.team1);
    const t2 = parseSetScoreInput(sets[i]!.team2);
    if (t1 === null || t2 === null) {
      return {
        ok: false,
        message: `Informe a pontuação das duas equipes no ${labels[i]} set.`,
      };
    }
    values.push({ team1: t1, team2: t2 });
  }

  return { ok: true, values };
}

export function matchResultPayloadSets(result: MatchResultPayload): MatchSetScore[] {
  if (result.sets?.length) return result.sets;
  return matchResultSetsFromRow({
    set1_team1: result.set1_team1,
    set1_team2: result.set1_team2,
    set2_team1: result.set2_team1,
    set2_team2: result.set2_team2,
    set3_team1: result.set3_team1,
    set3_team2: result.set3_team2,
    team1_score: result.team1_score,
    team2_score: result.team2_score,
  });
}
