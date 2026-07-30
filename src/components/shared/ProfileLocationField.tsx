"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type AddressFields,
  formatProfileLocation,
  hasProfileLocation,
} from "@/lib/address";
import { detectCurrentPlace } from "@/lib/nearbyLocation";

type LocationValue = Pick<AddressFields, "zip" | "city" | "state">;

type Props = {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  readOnly?: boolean;
  /** Busca localização ao montar se ainda não houver cidade. */
  autoDetect?: boolean;
  compact?: boolean;
  hideLabel?: boolean;
};

export function ProfileLocationField({
  value,
  onChange,
  readOnly = false,
  autoDetect = true,
  compact = false,
  hideLabel = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detect = useCallback(
    async (forceRefresh = false) => {
      if (readOnly) return;
      setError(null);
      setLoading(true);
      try {
        const place = await detectCurrentPlace({ forceRefresh, timeoutMs: 12000 });
        if (!place) {
          setError(
            "Não foi possível obter a localização. Permita o acesso à localização no navegador."
          );
          return;
        }
        onChange({
          zip: place.cep ?? "",
          city: place.city,
          state: place.state,
        });
      } catch {
        setError("Não foi possível obter a localização. Tente novamente.");
      } finally {
        setLoading(false);
      }
    },
    [onChange, readOnly]
  );

  useEffect(() => {
    if (!autoDetect || readOnly) return;
    if (hasProfileLocation(value)) return;
    void detect(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na montagem / quando ainda vazio
  }, [autoDetect, readOnly]);

  const locationLabel = formatProfileLocation(value);

  if (readOnly) {
    return (
      <p className="text-sm font-semibold text-[var(--toq-profile-navy)]">
        {locationLabel ?? "Não informado"}
      </p>
    );
  }

  return (
    <div className={compact ? "space-y-1.5" : "space-y-3"}>
      {!hideLabel && (
        <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--toq-profile-muted)]">
          Localização
        </span>
      )}

      {loading ? (
        <p className="text-sm text-[var(--toq-profile-muted)]">Detectando sua cidade…</p>
      ) : locationLabel ? (
        <p className="text-sm font-semibold text-[var(--toq-profile-navy)]">{locationLabel}</p>
      ) : (
        <p className="text-sm text-[var(--toq-profile-muted)]">Cidade ainda não detectada</p>
      )}

      <button
        type="button"
        onClick={() => void detect(true)}
        disabled={loading}
        className="text-xs font-bold text-[var(--toq-profile-accent)] hover:underline disabled:opacity-50"
      >
        {loading ? "Detectando…" : "Usar minha localização atual"}
      </button>

      {error && (
        <p className="text-[10px] text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
