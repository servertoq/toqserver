"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppProfile } from "@/components/app/AppShell";
import { formatCourtAddress, mapCourtRow, whatsappUrl } from "@/lib/courts";
import type { CourtWithOwner } from "@/types/courts";
import { FeedTopBar } from "@/components/feed/FeedTopBar";
import { appContentClass } from "@/lib/layout";
import { profilePath } from "@/lib/publicProfile";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

export function CourtDetailPage({ id }: { id: string }) {
  const supabase = createClient();
  const profile = useAppProfile();
  const [court, setCourt] = useState<CourtWithOwner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scheduleMsg, setScheduleMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: fetchErr } = await supabase
      .from("courts")
      .select(
        `
        *,
        owner:profiles!courts_owner_id_fkey(id, username, avatar_url)
      `
      )
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !data) {
      setError("Quadra não encontrada.");
      setLoading(false);
      return;
    }

    setCourt(mapCourtRow(data));
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const isOwner = court?.owner_id === profile.id;

  const mapEmbedUrl =
    court?.latitude != null && court?.longitude != null
      ? MAPS_KEY
        ? `https://www.google.com/maps/embed/v1/place?key=${MAPS_KEY}&q=${court.latitude},${court.longitude}&zoom=16`
        : `https://www.openstreetmap.org/export/embed.html?bbox=${court.longitude - 0.01}%2C${court.latitude - 0.01}%2C${court.longitude + 0.01}%2C${court.latitude + 0.01}&layer=mapnik&marker=${court.latitude}%2C${court.longitude}`
      : null;

  const mapsLink =
    court?.latitude != null && court?.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${court.latitude},${court.longitude}`
      : court?.formatted_address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(court.formatted_address)}`
        : null;

  const waMessage = court
    ? `Olá! Vi a quadra "${court.name}" no Toq Tennis e gostaria de mais informações.`
    : "";

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <p className="text-sm text-[var(--toq-text-muted)]">Carregando…</p>
      </div>
    );
  }

  if (!court) {
    return (
      <main className={appContentClass}>
        <p className="text-sm text-red-600">{error ?? "Quadra não encontrada."}</p>
        <Link href="/inicio/quadras" className="mt-4 inline-block text-sm font-semibold text-[var(--toq-sky)]">
          Voltar às quadras
        </Link>
      </main>
    );
  }

  return (
    <>
      <FeedTopBar />
      <main className={appContentClass}>
        <Link href="/inicio/quadras" className="mb-4 inline-block text-xs font-semibold text-[var(--toq-sky)]">
          ← Quadras
        </Link>

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-[var(--toq-navy)]">{court.name}</h1>
                <p className="mt-1 text-sm font-semibold text-[var(--toq-lime-dark)]">{court.size_label}</p>
                {court.owner && (
                  <Link
                    href={profilePath(court.owner.username)}
                    className="mt-2 inline-block text-xs font-semibold text-[var(--toq-sky)] hover:underline"
                  >
                    Cadastrado por @{court.owner.username}
                  </Link>
                )}
              </div>
              {isOwner && (
                <Link
                  href={`/inicio/quadras/${court.id}/editar`}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-[var(--toq-navy)]"
                >
                  Editar
                </Link>
              )}
            </div>

            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-[var(--toq-navy)]">
              {court.description}
            </p>

            <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--toq-text-muted)]">
                Localização
              </p>
              <p className="mt-1 text-sm text-[var(--toq-navy)]">
                {court.formatted_address || formatCourtAddress(court)}
              </p>
              {mapsLink && (
                <a
                  href={mapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs font-semibold text-[var(--toq-sky)] hover:underline"
                >
                  Abrir no Google Maps
                </a>
              )}
            </div>
          </div>

          {mapEmbedUrl && (
            <div className="aspect-[16/10] w-full border-b border-slate-100 sm:aspect-[2/1]">
              <iframe
                title="Mapa da quadra"
                src={mapEmbedUrl}
                className="h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          )}

          <div className="flex flex-wrap gap-3 p-5 sm:p-6">
            <a
              href={whatsappUrl(court.contact_phone, waMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#20bd5a]"
            >
              <WhatsAppIcon />
              Entrar em contato
            </a>
            <button
              type="button"
              onClick={() => {
                setScheduleMsg("Agendamento online em breve. Use o WhatsApp por enquanto.");
                setTimeout(() => setScheduleMsg(null), 4000);
              }}
              className="rounded-lg bg-[var(--toq-lime-light)] px-5 py-2.5 text-sm font-bold text-[var(--toq-navy)] transition hover:bg-[var(--toq-lime-bright)]"
            >
              Agendar agora
            </button>
          </div>

          {scheduleMsg && (
            <p className="border-t border-slate-100 px-5 py-3 text-xs font-semibold text-[var(--toq-navy)] sm:px-6">
              {scheduleMsg}
            </p>
          )}
        </article>
      </main>
    </>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
