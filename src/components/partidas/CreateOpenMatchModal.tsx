"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import {
  fetchAddressByCep,
  formatCepDisplay,
  formatProfileLocation,
  normalizeCep,
} from "@/lib/address";
import { createOpenMatch, OPEN_MATCH_COURT_SURFACES } from "@/lib/openMatches";
import { useSingleSubmit } from "@/lib/useSingleSubmit";
import type { OpenMatchCourtSurface, OpenMatchFormat } from "@/types/openMatches";

type Props = {
  open: boolean;
  defaultCity?: string;
  onClose: () => void;
  onCreated: () => void;
};

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CreateOpenMatchModal({ open, defaultCity = "", onClose, onCreated }: Props) {
  const supabase = createClient();
  const { isSubmitting, guard } = useSingleSubmit();
  const [mounted, setMounted] = useState(false);
  const defaultStarts = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2, 0, 0, 0);
    return toLocalInputValue(d);
  }, [open]);

  const [format, setFormat] = useState<OpenMatchFormat>("2v2");
  const [skillLevel, setSkillLevel] = useState(3);
  const [courtName, setCourtName] = useState("");
  const [clubName, setClubName] = useState("");
  const [courtSurface, setCourtSurface] = useState<OpenMatchCourtSurface>("");
  const [cep, setCep] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const lastFetchedCep = useRef<string | null>(null);
  const [startsAt, setStartsAt] = useState(defaultStarts);
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setStartsAt(defaultStarts);
    setCep("");
    setCity(defaultCity);
    setState("");
    setClubName("");
    setCourtSurface("");
    setCepError(null);
    lastFetchedCep.current = null;
    setError(null);
  }, [open, defaultStarts, defaultCity]);

  async function lookupCep(raw: string) {
    const digits = normalizeCep(raw);
    if (digits.length !== 8) {
      setCepError(digits.length > 0 ? "CEP deve ter 8 dígitos." : null);
      if (digits.length === 0) {
        setCity("");
        setState("");
      }
      return;
    }
    if (cepLoading || lastFetchedCep.current === digits) return;

    setCepError(null);
    setCepLoading(true);
    try {
      const found = await fetchAddressByCep(digits);
      if (!found?.city) {
        setCepError("CEP não encontrado.");
        lastFetchedCep.current = null;
        setCity("");
        setState("");
        return;
      }
      lastFetchedCep.current = digits;
      setCity(found.city);
      setState(found.state);
    } catch {
      lastFetchedCep.current = null;
      setCepError("Não foi possível buscar o CEP. Tente novamente.");
    } finally {
      setCepLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const level = Number(skillLevel);
    if (!Number.isFinite(level) || level < 0 || level > 5) {
      setError("Nível deve ser entre 0 e 5.");
      return;
    }
    if (!courtName.trim()) {
      setError("Informe o nome da quadra.");
      return;
    }
    const digits = normalizeCep(cep);
    if (digits.length !== 8) {
      setError("Informe um CEP válido com 8 dígitos.");
      return;
    }
    if (!city.trim()) {
      setError("Aguarde a cidade ser preenchida pelo CEP.");
      return;
    }
    if (!startsAt) {
      setError("Informe data e horário.");
      return;
    }
    if (usePassword && password.trim().length < 3) {
      setError("A senha precisa ter pelo menos 3 caracteres.");
      return;
    }

    const cityToSave =
      formatProfileLocation({ zip: digits, city, state })?.slice(0, 80) || city.trim();

    await guard(async () => {
      const iso = new Date(startsAt).toISOString();
      const { error: createErr } = await createOpenMatch(supabase, {
        format,
        skillLevel: Math.round(level * 10) / 10,
        courtName,
        city: cityToSave,
        startsAt: iso,
        password: usePassword ? password : undefined,
        notes,
        clubName,
        courtSurface,
      });
      if (createErr) {
        setError(createErr);
        return;
      }
      onCreated();
      onClose();
    });
  }

  if (!open || !mounted) return null;

  const locationLabel = formatProfileLocation({ zip: cep, city, state });

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        aria-label="Fechar"
        onClick={onClose}
      />
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="relative z-[1] flex max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-bottom,0px)))] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[var(--toq-border)] bg-[var(--toq-card)] shadow-2xl sm:max-h-[min(92dvh,720px)] sm:rounded-3xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--toq-border)] px-5 py-4">
          <h2 className="text-lg font-bold text-[var(--toq-text)]">Criar partida</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--toq-border)] px-3 py-1.5 text-xs font-semibold text-[var(--toq-text)]"
          >
            Fechar
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 [-webkit-overflow-scrolling:touch]">
          {error && (
            <p
              className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
              role="alert"
            >
              {error}
            </p>
          )}

          <fieldset className="mb-4">
            <legend className="text-xs font-semibold uppercase tracking-wide text-[var(--toq-text-muted)]">
              Formato
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(
                [
                  { id: "2v2" as const, label: "Duplas (2vs2)", sub: "4 jogadores" },
                  { id: "1v1" as const, label: "Simples (1vs1)", sub: "2 jogadores" },
                ] as const
              ).map((opt) => {
                const active = format === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFormat(opt.id)}
                    className={`rounded-2xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-[var(--toq-accent)] bg-[var(--toq-accent)] text-white"
                        : "border-[var(--toq-border)] bg-[var(--toq-input-bg)] text-[var(--toq-text)] hover:border-[var(--toq-accent)]/50"
                    }`}
                  >
                    <p className={`text-sm font-bold ${active ? "text-white" : ""}`}>
                      {opt.label}
                    </p>
                    <p
                      className={`text-[11px] ${
                        active ? "text-white/80" : "text-[var(--toq-text-muted)]"
                      }`}
                    >
                      {opt.sub}
                    </p>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="mb-4 block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--toq-text-muted)]">
              Nível da partida (0 a 5)
            </span>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={5}
                step={0.1}
                value={skillLevel}
                onChange={(e) => setSkillLevel(Number(e.target.value))}
                className="h-2 w-full accent-[var(--toq-accent)]"
              />
              <span className="w-12 shrink-0 rounded-lg border border-[var(--toq-border)] bg-[var(--toq-input-bg)] py-1.5 text-center text-sm font-bold text-[var(--toq-text)]">
                {Number(skillLevel).toFixed(1)}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-[var(--toq-text-muted)]">
              0 = iniciante · 5 = profissional
            </p>
          </label>

          <label className="mb-3 block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--toq-text-muted)]">
              Nome do clube (opcional)
            </span>
            <input
              value={clubName}
              onChange={(e) => setClubName(e.target.value.slice(0, 80))}
              placeholder="Ex.: Lacio Clube"
              className="mt-1 w-full rounded-xl toq-input px-3 py-2.5 text-sm text-[var(--toq-text)]"
            />
          </label>

          <label className="mb-3 block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--toq-text-muted)]">
              Nome da quadra
            </span>
            <input
              value={courtName}
              onChange={(e) => setCourtName(e.target.value.slice(0, 80))}
              placeholder="Ex.: Quadra 1"
              required
              className="mt-1 w-full rounded-xl toq-input px-3 py-2.5 text-sm text-[var(--toq-text)]"
            />
          </label>

          <label className="mb-3 block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--toq-text-muted)]">
              Tipo de quadra
            </span>
            <select
              value={courtSurface}
              onChange={(e) => setCourtSurface(e.target.value as OpenMatchCourtSurface)}
              className="mt-1 w-full rounded-xl toq-input px-3 py-2.5 text-sm text-[var(--toq-text)]"
            >
              <option value="">Não informado</option>
              {OPEN_MATCH_COURT_SURFACES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <div className="mb-3">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--toq-text-muted)]">
                CEP
              </span>
              <input
                value={formatCepDisplay(cep)}
                onChange={(e) => {
                  setCepError(null);
                  const digits = normalizeCep(e.target.value);
                  if (digits !== lastFetchedCep.current) {
                    lastFetchedCep.current = null;
                    if (digits.length < 8) {
                      setCity("");
                      setState("");
                    }
                  }
                  setCep(digits);
                  if (digits.length === 8) {
                    void lookupCep(digits);
                  }
                }}
                onBlur={() => void lookupCep(cep)}
                inputMode="numeric"
                placeholder="00000-000"
                maxLength={9}
                required
                className="mt-1 w-full rounded-xl toq-input px-3 py-2.5 text-sm text-[var(--toq-text)]"
              />
            </label>
            {cepLoading && (
              <p className="mt-1.5 text-[11px] text-[var(--toq-text-muted)]">Buscando cidade…</p>
            )}
            {cepError && (
              <p className="mt-1.5 text-[11px] text-red-400" role="alert">
                {cepError}
              </p>
            )}
            {locationLabel && !cepLoading && !cepError && (
              <p className="mt-1.5 text-sm font-semibold text-[var(--toq-text)]">{locationLabel}</p>
            )}
          </div>

          <label className="mb-3 block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--toq-text-muted)]">
              Data e horário
            </span>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
              className="mt-1 w-full rounded-xl toq-input px-3 py-2.5 text-sm text-[var(--toq-text)]"
            />
          </label>

          <div className="mb-3 rounded-2xl border border-[var(--toq-border)] bg-[var(--toq-input-bg)] p-3">
            <label className="flex items-start gap-2.5 text-sm text-[var(--toq-text)]">
              <input
                type="checkbox"
                checked={usePassword}
                onChange={(e) => setUsePassword(e.target.checked)}
                className="mt-0.5 accent-[var(--toq-accent)]"
              />
              <span>
                <span className="font-semibold">Proteger com senha</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-[var(--toq-text-muted)]">
                  Sem senha: qualquer um pede e você aceita. Com senha: quem souber entra direto.
                </span>
              </span>
            </label>
            {usePassword && (
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value.slice(0, 40))}
                placeholder="Senha para entrar"
                className="mt-3 w-full rounded-xl toq-input px-3 py-2.5 text-sm text-[var(--toq-text)]"
              />
            )}
          </div>

          <label className="mb-2 block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--toq-text-muted)]">
              Observações (opcional)
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 280))}
              rows={2}
              className="mt-1 w-full resize-y rounded-xl toq-input px-3 py-2 text-sm text-[var(--toq-text)]"
              placeholder="Ex.: trazer bolinhas"
            />
          </label>
        </div>

        <div className="shrink-0 border-t border-[var(--toq-border)] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="submit"
            disabled={isSubmitting || cepLoading}
            className="w-full rounded-2xl bg-[var(--toq-accent)] py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {isSubmitting ? "Criando…" : "Publicar partida"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
