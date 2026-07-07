"use client";

import { useState } from "react";
import {
  type AddressFields,
  fetchAddressByCep,
  formatCepDisplay,
  formatProfileLocation,
  normalizeCep,
} from "@/lib/address";

type Props = {
  value: Pick<AddressFields, "zip" | "city" | "state">;
  onChange: (next: Pick<AddressFields, "zip" | "city" | "state">) => void;
  readOnly?: boolean;
  compact?: boolean;
};

export function ProfileCepField({ value, onChange, readOnly = false, compact = false }: Props) {
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  async function handleCepBlur() {
    if (readOnly) return;

    const digits = normalizeCep(value.zip);
    if (digits.length !== 8) {
      setCepError(digits.length > 0 ? "CEP deve ter 8 dígitos." : null);
      if (digits.length === 0) {
        onChange({ zip: "", city: "", state: "" });
      }
      return;
    }

    setCepError(null);
    setCepLoading(true);
    try {
      const found = await fetchAddressByCep(digits);
      if (!found) {
        setCepError("CEP não encontrado.");
        return;
      }
      onChange({
        zip: digits,
        city: found.city,
        state: found.state,
      });
    } catch {
      setCepError("Não foi possível buscar o CEP. Tente novamente.");
    } finally {
      setCepLoading(false);
    }
  }

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
      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--toq-profile-muted)]">
          CEP
        </span>
        <input
          value={formatCepDisplay(value.zip)}
          onChange={(e) => {
            setCepError(null);
            onChange({ ...value, zip: normalizeCep(e.target.value) });
          }}
          onBlur={() => void handleCepBlur()}
          inputMode="numeric"
          placeholder="00000-000"
          maxLength={9}
          className={`mt-1.5 w-full rounded-xl border border-[var(--toq-profile-border)] bg-[var(--toq-surface)] px-3 py-2 text-sm text-[var(--toq-profile-navy)] outline-none focus:border-[var(--toq-profile-accent)] ${
            compact ? "max-w-[10rem]" : ""
          }`}
        />
      </label>

      {cepLoading && (
        <p className="text-[10px] text-[var(--toq-profile-muted)]">Buscando cidade e UF…</p>
      )}
      {cepError && (
        <p className="text-[10px] text-red-500" role="alert">
          {cepError}
        </p>
      )}
      {locationLabel && !cepLoading && (
        <p className="text-xs font-semibold text-[var(--toq-profile-navy)]">{locationLabel}</p>
      )}
    </div>
  );
}
