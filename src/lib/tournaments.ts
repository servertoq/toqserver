import type { SupabaseClient } from "@supabase/supabase-js";
import { whatsappUrl } from "@/lib/courts";
import { groupDetailHref } from "@/lib/communityGroup";
import type { ClubTournament } from "@/types/clubFeatures";

type RawTournamentRow = {
  id: string;
  community_id: string | null;
  created_by?: string | null;
  location_label?: string | null;
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
  promoter?:
    | {
        id: string;
        username: string;
        avatar_url: string | null;
        display_name?: string | null;
      }
    | {
        id: string;
        username: string;
        avatar_url: string | null;
        display_name?: string | null;
      }[]
    | null;
};

export function mapTournamentRow(row: RawTournamentRow): ClubTournament {
  const community = Array.isArray(row.community) ? row.community[0] : row.community;
  const promoter = Array.isArray(row.promoter) ? row.promoter[0] : row.promoter;

  return {
    id: row.id,
    community_id: row.community_id,
    created_by: row.created_by ?? null,
    location_label: row.location_label ?? null,
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
    community: community ?? null,
    promoter: promoter ?? null,
  };
}

export function isStandaloneTournament(tournament: ClubTournament) {
  return !tournament.community_id;
}

export function tournamentOrganizerLabel(tournament: ClubTournament): string {
  if (tournament.community?.name) return tournament.community.name;
  if (tournament.promoter?.username) return `@${tournament.promoter.username}`;
  return "Torneio avulso";
}

export function tournamentLocationLabel(tournament: ClubTournament): string | null {
  if (tournament.location_label?.trim()) return tournament.location_label.trim();
  const cityParts = [tournament.community?.address_city, tournament.community?.address_state].filter(
    Boolean
  );
  return cityParts.length > 0 ? cityParts.join(" · ") : null;
}

export function tournamentClubHref(tournament: ClubTournament): string | null {
  if (!tournament.community?.slug) return null;
  const base = groupDetailHref("club", tournament.community.slug);
  if (tournament.is_private) return base;
  return `${base}?tab=tournaments`;
}

export function tournamentShareHref(tournament: ClubTournament, origin?: string): string | null {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  const root = base || "https://www.toqtennis.com.br";

  if (!tournament.community?.slug) {
    const url = new URL("/inicio/torneios", root);
    url.searchParams.set("torneio", tournament.id);
    return url.toString();
  }

  const path = groupDetailHref("club", tournament.community.slug);
  const url = new URL(path, root);

  if (!tournament.is_private) {
    url.searchParams.set("tab", "tournaments");
    url.searchParams.set("torneio", tournament.id);
  }

  return url.toString();
}

export function tournamentShareMessage(tournament: ClubTournament): string {
  const organizer = tournamentOrganizerLabel(tournament);
  const location = tournamentLocationLabel(tournament);
  const link = tournamentShareHref(tournament) ?? tournamentClubHref(tournament) ?? "";

  const lines = [
    `🏆 Torneio: ${tournament.name}`,
    tournament.community_id ? `Clube: ${organizer}` : `Promotor: ${organizer}`,
    location ? `Local: ${location}` : null,
    tournament.is_private && tournament.community_id
      ? "🔒 Torneio privado — se você ainda não é membro, abra o link e solicite entrada no clube para ver."
      : null,
    "",
    link,
  ];

  return lines.filter((line) => line !== null).join("\n");
}

export function tournamentSignupMessage(
  tournamentName: string,
  organizerName: string,
  username: string
): string {
  return `Olá! Quero me inscrever no torneio "${tournamentName}" (${organizerName}).\n\nMeu usuário no Toq: @${username}`;
}

export function tournamentSignupUrl(
  phone: string,
  tournamentName: string,
  organizerName: string,
  username: string
): string {
  return whatsappUrl(phone, tournamentSignupMessage(tournamentName, organizerName, username));
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
  created_by,
  location_label,
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
  community:communities(
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
  ),
  promoter:profiles!club_tournaments_created_by_fkey(
    id,
    username,
    avatar_url,
    display_name
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
    .eq("community_id", communityId);

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
    .eq("is_private", false)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? [])
    .map((row) => mapTournamentRow(row as RawTournamentRow))
    .filter((t) => !t.community_id || t.community != null);
}

export async function fetchMyStandaloneTournaments(
  supabase: SupabaseClient,
  userId: string
): Promise<ClubTournament[]> {
  const { data, error } = await supabase
    .from("club_tournaments")
    .select(TOURNAMENT_SELECT)
    .is("community_id", null)
    .eq("created_by", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapTournamentRow(row as RawTournamentRow));
}

export async function setTournamentActive(
  supabase: SupabaseClient,
  tournamentId: string,
  isActive: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("club_tournaments")
    .update({ is_active: isActive })
    .eq("id", tournamentId);
  return { error: error?.message ?? null };
}

export async function deleteTournament(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("club_tournaments").delete().eq("id", tournamentId);
  return { error: error?.message ?? null };
}
