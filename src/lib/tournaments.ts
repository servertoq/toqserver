import type { SupabaseClient } from "@supabase/supabase-js";
import { whatsappUrl } from "@/lib/courts";
import { groupDetailHref } from "@/lib/communityGroup";
import type { ClubTournament } from "@/types/clubFeatures";

type RawTournamentRow = {
  id: string;
  community_id: string;
  name: string;
  description: string;
  how_it_works: string;
  prizes: string;
  contact_whatsapp: string;
  image_url: string | null;
  is_private: boolean;
  is_active: boolean;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  community?:
    | {
        id: string;
        name: string;
        slug: string;
        cover_image_url: string | null;
        address_city?: string | null;
        address_zip?: string | null;
        address_neighborhood?: string | null;
        address_street?: string | null;
        address_state?: string | null;
      }
    | {
        id: string;
        name: string;
        slug: string;
        cover_image_url: string | null;
        address_city?: string | null;
        address_zip?: string | null;
        address_neighborhood?: string | null;
        address_street?: string | null;
        address_state?: string | null;
      }[]
    | null;
};

export function mapTournamentRow(row: RawTournamentRow): ClubTournament {
  const community = Array.isArray(row.community) ? row.community[0] : row.community;

  return {
    id: row.id,
    community_id: row.community_id,
    name: row.name,
    description: row.description,
    how_it_works: row.how_it_works,
    prizes: row.prizes,
    contact_whatsapp: row.contact_whatsapp,
    image_url: row.image_url,
    is_private: row.is_private,
    is_active: row.is_active,
    sort_order: row.sort_order,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    community: community ?? undefined,
  };
}

export function tournamentClubHref(tournament: ClubTournament): string | null {
  if (!tournament.community?.slug) return null;
  const base = groupDetailHref("club", tournament.community.slug);
  // Privados: página inicial do clube (pedir acesso). Públicos: aba Torneios.
  if (tournament.is_private) return base;
  return `${base}?tab=tournaments`;
}

export function tournamentShareHref(tournament: ClubTournament, origin?: string): string | null {
  if (!tournament.community?.slug) return null;
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  const path = groupDetailHref("club", tournament.community.slug);
  const url = new URL(path, base || "https://www.toqtennis.com.br");

  if (!tournament.is_private) {
    url.searchParams.set("tab", "tournaments");
    url.searchParams.set("torneio", tournament.id);
  }

  return url.toString();
}

export function tournamentShareMessage(tournament: ClubTournament): string {
  const club = tournament.community?.name ?? "Clube";
  const cityParts = [
    tournament.community?.address_city,
    tournament.community?.address_state,
  ].filter(Boolean);
  const location = cityParts.length > 0 ? cityParts.join(" / ") : null;
  const link = tournamentShareHref(tournament) ?? tournamentClubHref(tournament) ?? "";

  const lines = [
    `🏆 Torneio: ${tournament.name}`,
    `Clube: ${club}`,
    location ? `Local: ${location}` : null,
    tournament.is_private
      ? "🔒 Torneio privado — se você ainda não é membro, abra o link e solicite entrada no clube para ver."
      : null,
    "",
    link,
  ];

  return lines.filter((line) => line !== null).join("\n");
}

export function tournamentSignupMessage(
  tournamentName: string,
  clubName: string,
  username: string
): string {
  return `Olá! Quero me inscrever no torneio "${tournamentName}" do clube ${clubName}.\n\nMeu usuário no Toq: @${username}`;
}

export function tournamentSignupUrl(
  phone: string,
  tournamentName: string,
  clubName: string,
  username: string
): string {
  return whatsappUrl(phone, tournamentSignupMessage(tournamentName, clubName, username));
}

export function formatTournamentDateRange(startsAt: string | null, endsAt: string | null): string | null {
  if (!startsAt && !endsAt) return null;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (startsAt && endsAt) return `${fmt(startsAt)} — ${fmt(endsAt)}`;
  if (startsAt) return `A partir de ${fmt(startsAt)}`;
  return `Até ${fmt(endsAt!)}`;
}

const TOURNAMENT_SELECT = `
  id,
  community_id,
  name,
  description,
  how_it_works,
  prizes,
  contact_whatsapp,
  image_url,
  is_private,
  is_active,
  sort_order,
  starts_at,
  ends_at,
  community:communities!inner(
    id,
    name,
    slug,
    cover_image_url,
    kind,
    address_city,
    address_zip,
    address_neighborhood,
    address_street,
    address_state
  )
`;

export async function fetchClubTournaments(
  supabase: SupabaseClient,
  communityId: string,
  options?: { includeInactive?: boolean }
): Promise<ClubTournament[]> {
  let query = supabase
    .from("club_tournaments")
    .select(TOURNAMENT_SELECT)
    .eq("community_id", communityId)
    .eq("community.kind", "club");

  if (!options?.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query
    .order("sort_order")
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []).map((row) => mapTournamentRow(row as RawTournamentRow));
}

export async function fetchAllTournaments(
  supabase: SupabaseClient
): Promise<ClubTournament[]> {
  const { data, error } = await supabase
    .from("club_tournaments")
    .select(TOURNAMENT_SELECT)
    .eq("is_active", true)
    .eq("community.kind", "club")
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []).map((row) => mapTournamentRow(row as RawTournamentRow));
}
