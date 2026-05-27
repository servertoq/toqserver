"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { canModerate } from "@/lib/community";
import { courtSizeLabel, normalizePhoneDigits, whatsappUrl } from "@/lib/courts";
import { formatClubPrice, parsePriceInput } from "@/lib/clubFeatures";
import type { CommunityMemberRole } from "@/types/community";
import type {
  ClubCourt,
  ClubCourtBlock,
  ClubCourtHours,
  ClubCourtImage,
  ClubCourtPlan,
} from "@/types/clubFeatures";
import { useAppProfile } from "@/components/app/AppShell";
import { ClubCourtAgendaModal } from "./ClubCourtAgendaModal";

type Props = {
  communityId: string;
  clubName: string;
  myRole: CommunityMemberRole | null;
  buyerUsername: string;
};

function weekdayLabel(d: number) {
  return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][d] ?? String(d);
}

function toMinutes(hms: string) {
  const [h, m] = hms.split(":").map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function minutesToHHMM(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

function formatDateBR(iso: string) {
  // iso: yyyy-mm-dd
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function defaultHours(): ClubCourtHours[] {
  // Seg-Sex 07:00-22:00, Sáb 08:00-18:00, Dom fechado
  const mk = (weekday: number, start: string, end: string): ClubCourtHours => ({
    id: crypto.randomUUID(),
    court_id: "",
    weekday,
    start_time: start,
    end_time: end,
  });
  return [
    mk(1, "07:00:00", "22:00:00"),
    mk(2, "07:00:00", "22:00:00"),
    mk(3, "07:00:00", "22:00:00"),
    mk(4, "07:00:00", "22:00:00"),
    mk(5, "07:00:00", "22:00:00"),
    mk(6, "08:00:00", "18:00:00"),
  ];
}

type PlanKind = "hour" | "day" | "week" | "month";

type CourtDraft = {
  name: string;
  size_label: string;
  description: string;
  contact_phone: string;
  plans: Array<{
    key: string;
    kind: PlanKind;
    priceStr: string;
  }>;
  hours: Array<{
    key: string;
    weekday: number;
    start: string;
    end: string;
  }>;
};

function planMeta(kind: PlanKind) {
  if (kind === "hour") return { label: "Hora", unit_label: "hora", unit_minutes: 60 };
  if (kind === "day") return { label: "Dia", unit_label: "dia", unit_minutes: 1440 };
  if (kind === "week") return { label: "Semana", unit_label: "semana", unit_minutes: 10080 };
  return { label: "Mês", unit_label: "mês", unit_minutes: 43200 };
}

function planKindFromUnitMinutes(unitMinutes: number): PlanKind {
  if (unitMinutes === 60) return "hour";
  if (unitMinutes === 1440) return "day";
  if (unitMinutes === 10080) return "week";
  if (unitMinutes === 43200) return "month";
  return "hour";
}

function newPlanRow() {
  const row: CourtDraft["plans"][number] = {
    key: crypto.randomUUID(),
    kind: "hour",
    priceStr: "",
  };
  return row;
}

function fromCourt(court?: ClubCourt | null): CourtDraft {
  const plans: CourtDraft["plans"] = (court?.plans ?? []).length
    ? (court?.plans ?? []).map((p) => ({
        key: p.id,
        kind: planKindFromUnitMinutes(p.unit_minutes),
        priceStr: String(p.price),
      }))
    : [newPlanRow()];

  const hours = (court?.hours ?? []).length
    ? (court?.hours ?? []).map((h) => ({
        key: h.id,
        weekday: h.weekday,
        start: h.start_time.slice(0, 5),
        end: h.end_time.slice(0, 5),
      }))
    : defaultHours().map((h) => ({
        key: crypto.randomUUID(),
        weekday: h.weekday,
        start: h.start_time.slice(0, 5),
        end: h.end_time.slice(0, 5),
      }));

  return {
    name: court?.name ?? "",
    size_label: court?.size_label ?? "dupla",
    description: court?.description ?? "",
    contact_phone: court?.contact_phone ?? "",
    plans,
    hours,
  };
}

function isValidTimeHHMM(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

function buildBookingMessage(params: {
  clubName: string;
  courtName: string;
  buyerUsername: string;
  dateISO: string;
  startHHMM: string;
  endHHMM: string;
  planLabel: string;
  quantity: number;
  unitLabel: string;
  unitPrice: number;
  totalPrice: number;
}) {
  const lines = [
    `Olá! Quero alugar uma quadra no clube *${params.clubName}*:`,
    ``,
    `Quadra: *${params.courtName}*`,
    `Data: ${formatDateBR(params.dateISO)}`,
    `Horário: ${params.startHHMM}–${params.endHHMM}`,
    `Plano: ${params.planLabel} (${params.quantity} ${params.unitLabel}${params.quantity === 1 ? "" : "s"})`,
    `Valor: ${formatClubPrice(params.totalPrice)} (${formatClubPrice(params.unitPrice)} por ${params.unitLabel})`,
    ``,
    `Solicitante: @${params.buyerUsername}`,
  ];
  return lines.join("\n");
}

function ClubCourtForm({
  communityId,
  court,
  onSaved,
  onClose,
}: {
  communityId: string;
  court?: ClubCourt | null;
  onSaved: (courtId: string) => void;
  onClose: () => void;
}) {
  const supabase = createClient();
  const profile = useAppProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const isEdit = !!court;

  const [draft, setDraft] = useState<CourtDraft>(() => fromCourt(court));
  const [files, setFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<ClubCourtImage[]>(court?.images ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalImages = existingImages.length + files.length;

  function updatePlan(key: string, patch: Partial<CourtDraft["plans"][number]>) {
    setDraft((d) => ({ ...d, plans: d.plans.map((p) => (p.key === key ? { ...p, ...patch } : p)) }));
  }
  function addPlan() {
    setDraft((d) => ({ ...d, plans: [...d.plans, newPlanRow()] }));
  }
  function removePlan(key: string) {
    setDraft((d) => ({ ...d, plans: d.plans.length <= 1 ? d.plans : d.plans.filter((p) => p.key !== key) }));
  }

  function updateHour(key: string, patch: Partial<CourtDraft["hours"][number]>) {
    setDraft((d) => ({ ...d, hours: d.hours.map((h) => (h.key === key ? { ...h, ...patch } : h)) }));
  }
  function addHourRow() {
    setDraft((d) => ({
      ...d,
      hours: [...d.hours, { key: crypto.randomUUID(), weekday: 1, start: "07:00", end: "22:00" }],
    }));
  }
  function removeHourRow(key: string) {
    setDraft((d) => ({ ...d, hours: d.hours.filter((h) => h.key !== key) }));
  }

  async function removeImage(imageId: string) {
    await supabase.from("club_court_images").delete().eq("id", imageId);
    setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const phoneDigits = normalizePhoneDigits(draft.contact_phone);
    if (!draft.name.trim() || !draft.description.trim() || phoneDigits.length < 10) {
      setError("Preencha nome, descrição e um WhatsApp válido (DDD + número).");
      return;
    }

    const parsedPlans = draft.plans.map((p) => ({
      p,
      meta: planMeta(p.kind),
      price: parsePriceInput(p.priceStr),
    }));
    if (parsedPlans.some((x) => x.price == null)) {
      setError("Revise os planos: selecione HORA/DIA/SEMANA/MÊS e informe um preço válido.");
      return;
    }

    if (
      draft.hours.some(
        (h) =>
          h.weekday < 0 ||
          h.weekday > 6 ||
          !isValidTimeHHMM(h.start) ||
          !isValidTimeHHMM(h.end) ||
          toMinutes(`${h.start}:00`) >= toMinutes(`${h.end}:00`)
      )
    ) {
      setError("Revise o horário de funcionamento (dia da semana e horário inicial/final).");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let courtId = court?.id;

      if (isEdit && courtId) {
        const { error: updErr } = await supabase
          .from("club_courts")
          .update({
            name: draft.name.trim(),
            size_label: draft.size_label,
            description: draft.description.trim(),
            contact_phone: draft.contact_phone.trim(),
          })
          .eq("id", courtId);
        if (updErr) throw new Error(updErr.message);
      } else {
        const { data, error: insErr } = await supabase
          .from("club_courts")
          .insert({
            community_id: communityId,
            name: draft.name.trim(),
            size_label: draft.size_label,
            description: draft.description.trim(),
            contact_phone: draft.contact_phone.trim(),
          })
          .select("id")
          .single();
        if (insErr || !data) throw new Error(insErr?.message ?? "Erro ao criar quadra");
        courtId = data.id;
      }

      // Plans: upsert simplificado (update existentes e inserir novos; deletar removidos)
      const existingPlanIds = new Set((court?.plans ?? []).map((p) => p.id));
      const keptPlanIds = new Set<string>();
      for (let i = 0; i < parsedPlans.length; i++) {
        const { p, meta, price } = parsedPlans[i];
        const payload = {
          label: meta.label,
          unit_label: meta.unit_label,
          unit_minutes: meta.unit_minutes,
          price: price!,
          is_active: true,
          sort_order: i,
        };
        if (existingPlanIds.has(p.key)) {
          keptPlanIds.add(p.key);
          const { error } = await supabase.from("club_court_plans").update(payload).eq("id", p.key);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase.from("club_court_plans").insert({ court_id: courtId, ...payload });
          if (error) throw new Error(error.message);
        }
      }
      for (const id of existingPlanIds) {
        if (!keptPlanIds.has(id)) await supabase.from("club_court_plans").delete().eq("id", id);
      }

      // Hours: sempre recria (simples e robusto)
      await supabase.from("club_court_hours").delete().eq("court_id", courtId);
      if (draft.hours.length > 0) {
        const { error } = await supabase.from("club_court_hours").insert(
          draft.hours.map((h) => ({
            court_id: courtId,
            weekday: h.weekday,
            start_time: `${h.start}:00`,
            end_time: `${h.end}:00`,
          }))
        );
        if (error) throw new Error(error.message);
      }

      // Imagens
      for (let i = 0; i < files.length; i++) {
        if (existingImages.length + i >= 3) break;
        const file = files[i];
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const sortOrder = existingImages.length + i;
        const path = `${profile.id}/${communityId}/${courtId}/${sortOrder}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("club-court-images")
          .upload(path, file, { upsert: true, contentType: file.type });
        if (upErr) continue;
        const { data: urlData } = supabase.storage.from("club-court-images").getPublicUrl(path);
        await supabase.from("club_court_images").insert({
          court_id: courtId,
          url: urlData.publicUrl,
          sort_order: sortOrder,
        });
      }

      if (!courtId) throw new Error("Erro ao identificar a quadra.");
      onSaved(courtId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--toq-navy)]">{isEdit ? "Editar quadra" : "Nova quadra"}</h2>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-[var(--toq-text-muted)]">
            Fechar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-[var(--toq-navy)]">Nome</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                required
                maxLength={120}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[var(--toq-navy)]">WhatsApp do proprietário</span>
              <input
                value={draft.contact_phone}
                onChange={(e) => setDraft((d) => ({ ...d, contact_phone: e.target.value }))}
                required
                placeholder="(11) 99999-9999"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Tamanho da quadra</span>
            <select
              value={draft.size_label}
              onChange={(e) => setDraft((d) => ({ ...d, size_label: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="individual">Individual</option>
              <option value="dupla">Dupla</option>
              <option value="beach_tennis">Beach tennis</option>
              <option value="padel">Padel</option>
              <option value="outro">Outro</option>
            </select>
            <p className="mt-1 text-[11px] text-[var(--toq-text-muted)]">{courtSizeLabel(draft.size_label)}</p>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Descrição</span>
            <textarea
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              required
              rows={3}
              maxLength={2000}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[var(--toq-navy)]">Planos de aluguel</h3>
              <button type="button" onClick={addPlan} className="text-xs font-bold text-[var(--toq-sky)]">
                + Plano
              </button>
            </div>
            <p className="mt-1 text-[11px] text-[var(--toq-text-muted)]">
              Selecione HORA, DIA, SEMANA ou MÊS e informe o preço.
            </p>
            <div className="mt-3 space-y-3">
              {draft.plans.map((p, idx) => (
                <div key={p.key} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[var(--toq-navy)]">Plano {idx + 1}</span>
                    {draft.plans.length > 1 && (
                      <button type="button" onClick={() => removePlan(p.key)} className="text-[11px] font-semibold text-red-600">
                        Remover
                      </button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      value={p.kind}
                      onChange={(e) => updatePlan(p.key, { kind: e.target.value as PlanKind })}
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    >
                      <option value="hour">HORA</option>
                      <option value="day">DIA</option>
                      <option value="week">SEMANA</option>
                      <option value="month">MÊS</option>
                    </select>
                    <input
                      value={p.priceStr}
                      onChange={(e) => updatePlan(p.key, { priceStr: e.target.value })}
                      placeholder="Preço (R$)"
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    />
                  </div>
                  {parsePriceInput(p.priceStr) != null && (
                    <p className="mt-1 text-[11px] text-[var(--toq-text-muted)]">
                      {(() => {
                        const meta = planMeta(p.kind);
                        return `${formatClubPrice(parsePriceInput(p.priceStr)!)} por ${meta.unit_label}`;
                      })()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[var(--toq-navy)]">Funcionamento</h3>
              <button type="button" onClick={addHourRow} className="text-xs font-bold text-[var(--toq-sky)]">
                + Dia/horário
              </button>
            </div>
            <p className="mt-1 text-[11px] text-[var(--toq-text-muted)]">
              Defina os dias da semana e horários em que a quadra funciona.
            </p>

            <div className="mt-3 space-y-2">
              {draft.hours.map((h) => (
                <div key={h.key} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
                  <select
                    value={h.weekday}
                    onChange={(e) => updateHour(h.key, { weekday: parseInt(e.target.value, 10) })}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                      <option key={d} value={d}>
                        {weekdayLabel(d)}
                      </option>
                    ))}
                  </select>
                  <input
                    value={h.start}
                    onChange={(e) => updateHour(h.key, { start: e.target.value })}
                    placeholder="Início (07:00)"
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                  <span className="text-xs text-[var(--toq-text-muted)]">até</span>
                  <input
                    value={h.end}
                    onChange={(e) => updateHour(h.key, { end: e.target.value })}
                    placeholder="Fim (22:00)"
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                  <button type="button" onClick={() => removeHourRow(h.key)} className="ml-auto text-xs font-semibold text-red-600">
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Fotos (até 3)</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {existingImages.map((img) => (
                <div key={img.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => void removeImage(img.id)}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
              {files.map((f, i) => (
                <span key={i} className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] text-[var(--toq-navy)]">
                  {f.name}
                </span>
              ))}
            </div>
            {totalImages < 3 && (
              <>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-[var(--toq-navy)]"
                >
                  Adicionar foto ({totalImages}/3)
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? []);
                    const room = 3 - existingImages.length - files.length;
                    setFiles((prev) => [...prev, ...picked.slice(0, room)]);
                    e.target.value = "";
                  }}
                />
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--toq-lime-light)] py-2.5 text-sm font-bold text-[var(--toq-navy)] disabled:opacity-50"
          >
            {loading ? "Salvando…" : "Salvar quadra"}
          </button>
        </form>
      </div>
    </div>
  );
}

function BookingModal({
  clubName,
  buyerUsername,
  court,
  onClose,
}: {
  clubName: string;
  buyerUsername: string;
  court: ClubCourt;
  onClose: () => void;
}) {
  const plans = (court.plans ?? []).filter((p) => p.is_active !== false).sort((a, b) => a.sort_order - b.sort_order);
  const hours = (court.hours ?? []).slice();
  const blocks = (court.blocks ?? []).slice();

  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [dateISO, setDateISO] = useState(() => new Date().toISOString().slice(0, 10));
  const [startHHMM, setStartHHMM] = useState("07:00");
  const [quantity, setQuantity] = useState(1);
  const [hint, setHint] = useState<string | null>(null);

  const selectedPlan = plans.find((p) => p.id === planId) ?? null;

  const weekday = useMemo(() => {
    const d = new Date(`${dateISO}T12:00:00`);
    return Number.isNaN(d.getTime()) ? 0 : d.getDay();
  }, [dateISO]);

  const todaysHours = useMemo(() => hours.filter((h) => h.weekday === weekday), [hours, weekday]);

  const availableStartTimes = useMemo(() => {
    if (!selectedPlan) return [];
    const step = 30;
    const unit = selectedPlan.unit_minutes;
    const dur = unit * Math.max(1, quantity);

    const windowIntervals = todaysHours
      .map((h) => ({ start: toMinutes(h.start_time), end: toMinutes(h.end_time) }))
      .filter((w) => w.end > w.start);

    if (windowIntervals.length === 0) return [];

    // blocks for that date
    const dayStart = new Date(`${dateISO}T00:00:00`).getTime();
    const dayEnd = new Date(`${dateISO}T23:59:59`).getTime();
    const dayBlocks = blocks
      .filter((b) => {
        const s = new Date(b.start_ts).getTime();
        const e = new Date(b.end_ts).getTime();
        return overlaps(dayStart, dayEnd, s, e);
      })
      .map((b) => {
        const s = new Date(b.start_ts);
        const e = new Date(b.end_ts);
        const start = s.getHours() * 60 + s.getMinutes();
        const end = e.getHours() * 60 + e.getMinutes();
        return { start, end };
      });

    const out: string[] = [];
    for (const w of windowIntervals) {
      for (let t = w.start; t + dur <= w.end; t += step) {
        const end = t + dur;
        const blocked = dayBlocks.some((b) => overlaps(t, end, b.start, b.end));
        if (!blocked) out.push(minutesToHHMM(t));
      }
    }
    return Array.from(new Set(out));
  }, [blocks, dateISO, quantity, selectedPlan, todaysHours]);

  const price = selectedPlan ? selectedPlan.price * Math.max(1, quantity) : 0;

  function handleSendWhatsApp() {
    if (!selectedPlan) return;
    if (!availableStartTimes.includes(startHHMM)) {
      setHint("Selecione um horário disponível.");
      return;
    }
    const startMin = toMinutes(`${startHHMM}:00`);
    const endMin = startMin + selectedPlan.unit_minutes * Math.max(1, quantity);
    const msg = buildBookingMessage({
      clubName,
      courtName: court.name,
      buyerUsername,
      dateISO,
      startHHMM,
      endHHMM: minutesToHHMM(endMin),
      planLabel: selectedPlan.label,
      quantity: Math.max(1, quantity),
      unitLabel: selectedPlan.unit_label,
      unitPrice: selectedPlan.price,
      totalPrice: price,
    });
    window.open(whatsappUrl(court.contact_phone, msg), "_blank", "noopener,noreferrer");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--toq-navy)]">Agendar quadra</h2>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-[var(--toq-text-muted)]">
            Fechar
          </button>
        </div>

        <p className="text-sm font-semibold text-[var(--toq-navy)]">{court.name}</p>
        <p className="mt-1 text-xs text-[var(--toq-text-muted)]">{courtSizeLabel(court.size_label)}</p>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Plano</span>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} — {formatClubPrice(p.price)} / {p.unit_label} ({p.unit_minutes} min)
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-[var(--toq-navy)]">Data</span>
              <input
                type="date"
                value={dateISO}
                onChange={(e) => setDateISO(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[var(--toq-navy)]">Quantidade</span>
              <input
                type="number"
                min={1}
                max={12}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value || "1", 10) || 1)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-[var(--toq-navy)]">Horário disponível</span>
            {availableStartTimes.length === 0 ? (
              <p className="mt-1 rounded-lg bg-slate-100 px-3 py-2 text-sm text-[var(--toq-text-muted)]">
                Sem horários disponíveis para este dia/plano.
              </p>
            ) : (
              <select
                value={startHHMM}
                onChange={(e) => setStartHHMM(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {availableStartTimes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
          </label>

          {selectedPlan && (
            <p className="text-sm font-bold text-[var(--toq-lime-dark)]">
              Total: {formatClubPrice(price)}
            </p>
          )}

          {hint && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">{hint}</p>}

          <button
            type="button"
            onClick={handleSendWhatsApp}
            disabled={!selectedPlan || availableStartTimes.length === 0}
            className="w-full rounded-lg bg-[#25D366] py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            Enviar pedido no WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

export function ClubCourtsPanel({ communityId, clubName, myRole, buyerUsername }: Props) {
  const supabase = createClient();
  const canManage = canModerate(myRole);

  const [courts, setCourts] = useState<ClubCourt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ClubCourt | null | undefined>(undefined);
  const [bookingCourt, setBookingCourt] = useState<ClubCourt | null>(null);
  const [agendaCourtId, setAgendaCourtId] = useState<string | null>(null);
  const [agendaPickerOpen, setAgendaPickerOpen] = useState(false);
  const agendaCourt = courts.find((c) => c.id === agendaCourtId) ?? null;
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleCourtSaved(courtId: string) {
    setEditing(undefined);
    await load();
    setAgendaCourtId(courtId);
  }

  function openAgendaManager() {
    setInfo(null);
    if (courts.length === 0) {
      setInfo("Cadastre uma quadra com o botão “+ Nova quadra” antes de gerenciar a agenda.");
      return;
    }
    if (courts.length === 1) {
      setAgendaCourtId(courts[0].id);
      return;
    }
    setAgendaPickerOpen(true);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: listErr } = await supabase
      .from("club_courts")
      .select(
        `
        *,
        images:club_court_images(id, court_id, url, sort_order),
        plans:club_court_plans(id, court_id, label, unit_label, unit_minutes, price, is_active, sort_order),
        hours:club_court_hours(id, court_id, weekday, start_time, end_time),
        blocks:club_court_blocks(id, court_id, start_ts, end_ts, reason)
      `
      )
      .eq("community_id", communityId)
      .eq("is_active", true)
      .order("sort_order");

    if (listErr) {
      setError(
        "Não foi possível carregar as quadras do clube. Execute a migration 024_club_courts_booking.sql no Supabase."
      );
      setLoading(false);
      return;
    }

    const mapped: ClubCourt[] = (data ?? []).map((row) => {
      const rawImg = row.images as ClubCourtImage | ClubCourtImage[] | null;
      const imgs = Array.isArray(rawImg) ? rawImg : rawImg ? [rawImg] : [];
      const rawPlans = row.plans as ClubCourtPlan | ClubCourtPlan[] | null;
      const plans = Array.isArray(rawPlans) ? rawPlans : rawPlans ? [rawPlans] : [];
      const rawHours = row.hours as ClubCourtHours | ClubCourtHours[] | null;
      const hours = Array.isArray(rawHours) ? rawHours : rawHours ? [rawHours] : [];
      const rawBlocks = row.blocks as ClubCourtBlock | ClubCourtBlock[] | null;
      const blocks = Array.isArray(rawBlocks) ? rawBlocks : rawBlocks ? [rawBlocks] : [];

      return {
        ...row,
        images: [...imgs].sort((a, b) => a.sort_order - b.sort_order),
        plans: [...plans].sort((a, b) => a.sort_order - b.sort_order).map((p) => ({ ...p, price: Number(p.price) })),
        hours: [...hours].sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)),
        blocks,
      } as ClubCourt;
    });

    setCourts(mapped);
    setLoading(false);
  }, [communityId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: membros veem agenda em tempo real (somente admin/mod altera)
  useEffect(() => {
    const channel = supabase
      .channel(`club-court-blocks-${communityId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "club_court_blocks" },
        () => {
          void load();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [communityId, load, supabase]);

  async function removeCourt(court: ClubCourt) {
    if (!confirm("Remover esta quadra?")) return;
    await supabase.from("club_courts").update({ is_active: false }).eq("id", court.id);
    await load();
  }

  if (loading) {
    return <p className="mt-4 text-sm text-[var(--toq-text-muted)]">Carregando quadras…</p>;
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-[var(--toq-navy)]">Quadras do clube</h2>
          {canManage && (
            <p className="mt-0.5 text-[11px] text-[var(--toq-text-muted)]">
              Cadastre a quadra e use <strong>Agenda</strong> para marcar horários locados.
            </p>
          )}
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openAgendaManager}
              disabled={courts.length === 0}
              title={courts.length === 0 ? "Cadastre uma quadra antes" : "Abrir agenda para marcar locações"}
              className="rounded-lg bg-[var(--toq-navy)] px-3 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Gerenciar agenda
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-lg bg-[var(--toq-lime-light)] px-3 py-1.5 text-xs font-bold text-[var(--toq-navy)]"
            >
              + Nova quadra
            </button>
          </div>
        )}
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>}
      {info && (
        <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800">{info}</p>
      )}

      {courts.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-[var(--toq-navy)]">Nenhuma quadra cadastrada</p>
          {canManage ? (
            <>
              <p className="mt-2 text-xs text-[var(--toq-text-muted)]">
                A agenda só existe depois de cadastrar uma quadra. Ao salvar, a agenda abre
                automaticamente para você marcar os horários.
              </p>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="mt-4 rounded-lg bg-[var(--toq-lime-light)] px-4 py-2.5 text-sm font-bold text-[var(--toq-navy)]"
              >
                Cadastrar primeira quadra
              </button>
            </>
          ) : (
            <p className="mt-1 text-xs text-[var(--toq-text-muted)]">
              O administrador ainda não cadastrou quadras neste clube.
            </p>
          )}
        </div>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {courts.map((court) => (
            <li key={court.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {court.images?.[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={court.images[0].url} alt="" className="aspect-[4/3] w-full object-cover" />
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-[var(--toq-navy)]">{court.name}</h3>
                  <span className="shrink-0 text-[11px] font-bold text-[var(--toq-sky)]">
                    {courtSizeLabel(court.size_label)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-[var(--toq-text-muted)]">{court.description}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAgendaCourtId(court.id)}
                    className={`rounded-lg px-3 py-2 text-xs font-bold ${
                      canManage
                        ? "bg-[var(--toq-navy)] text-white"
                        : "border border-slate-200 text-[var(--toq-navy)]"
                    }`}
                  >
                    {canManage ? "Agenda — editar horários" : "Ver agenda"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingCourt(court)}
                    className="rounded-lg bg-[#25D366] px-3 py-2 text-xs font-bold text-white"
                  >
                    Agendar no WhatsApp
                  </button>
                  {canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditing(court)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-[var(--toq-navy)]"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeCourt(court)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700"
                      >
                        Remover
                      </button>
                    </>
                  )}
                </div>

                {(court.blocks?.length ?? 0) > 0 && (
                  <p className="mt-3 text-[11px] font-semibold text-red-600">
                    {(court.blocks?.length ?? 0)} horário(s) locado(s) — abra a Agenda para ver a semana
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing !== undefined && (
        <ClubCourtForm
          communityId={communityId}
          court={editing}
          onSaved={handleCourtSaved}
          onClose={() => setEditing(undefined)}
        />
      )}

      {agendaPickerOpen && courts.length > 1 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-sm font-bold text-[var(--toq-navy)]">Escolha a quadra</h3>
            <ul className="mt-3 space-y-2">
              {courts.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setAgendaCourtId(c.id);
                      setAgendaPickerOpen(false);
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm font-semibold text-[var(--toq-navy)] hover:bg-slate-50"
                  >
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setAgendaPickerOpen(false)}
              className="mt-4 w-full text-sm font-semibold text-[var(--toq-text-muted)]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {bookingCourt && (
        <BookingModal
          clubName={clubName}
          buyerUsername={buyerUsername}
          court={bookingCourt}
          onClose={() => setBookingCourt(null)}
        />
      )}

      {agendaCourt && (
        <ClubCourtAgendaModal
          canManage={canManage}
          court={agendaCourt}
          onChanged={load}
          onClose={() => setAgendaCourtId(null)}
        />
      )}
    </div>
  );
}

