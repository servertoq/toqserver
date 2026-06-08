"use client";

import { useState } from "react";
import {
  type AddressFields,
  fetchAddressByCep,
  formatCepDisplay,
  normalizeCep,
} from "@/lib/address";

type Props = {
  value: AddressFields;
  onChange: (next: AddressFields) => void;
  optionalLabel?: string;
};

export function AddressForm({ value, onChange, optionalLabel = "opcional" }: Props) {
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  function patch(partial: Partial<AddressFields>) {
    onChange({ ...value, ...partial });
  }

  async function handleCepBlur() {
    const digits = normalizeCep(value.zip);
    if (digits.length !== 8) {
      setCepError(digits.length > 0 ? "CEP deve ter 8 dígitos." : null);
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
        ...value,
        zip: digits,
        city: found.city || value.city,
        state: found.state || value.state,
        street: value.street || found.street,
        neighborhood: value.neighborhood || found.neighborhood,
      });
    } catch {
      setCepError("Não foi possível buscar o CEP. Tente novamente.");
    } finally {
      setCepLoading(false);
    }
  }

  return (
    <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <legend className="px-1 text-xs font-semibold text-[var(--toq-navy)]">
        Endereço <span className="font-normal text-[var(--toq-text-muted)]">({optionalLabel})</span>
      </legend>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-1">
          <span className="text-xs font-semibold text-[var(--toq-navy)]">CEP</span>
          <input
            value={formatCepDisplay(value.zip)}
            onChange={(e) => {
              setCepError(null);
              patch({ zip: normalizeCep(e.target.value) });
            }}
            onBlur={() => void handleCepBlur()}
            inputMode="numeric"
            placeholder="00000-000"
            maxLength={9}
            className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-navy)]"
          />
          {cepLoading && (
            <span className="mt-1 block text-[10px] text-[var(--toq-text-muted)]">Buscando…</span>
          )}
          {cepError && (
            <span className="mt-1 block text-[10px] text-red-600" role="alert">
              {cepError}
            </span>
          )}
        </label>

        <label className="block sm:col-span-1">
          <span className="text-xs font-semibold text-[var(--toq-navy)]">Cidade</span>
          <input
            value={value.city}
            onChange={(e) => patch({ city: e.target.value })}
            className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-navy)]"
            readOnly={cepLoading}
          />
        </label>

        <label className="block sm:col-span-1">
          <span className="text-xs font-semibold text-[var(--toq-navy)]">Estado</span>
          <input
            value={value.state}
            onChange={(e) => patch({ state: e.target.value.toUpperCase().slice(0, 2) })}
            maxLength={2}
            placeholder="UF"
            className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm uppercase text-[var(--toq-navy)]"
            readOnly={cepLoading}
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-[var(--toq-navy)]">Rua ou avenida</span>
        <input
          value={value.street}
          onChange={(e) => patch({ street: e.target.value })}
          maxLength={120}
          className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-navy)]"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-[var(--toq-navy)]">Número</span>
          <input
            value={value.number}
            onChange={(e) => patch({ number: e.target.value })}
            maxLength={20}
            className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-navy)]"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[var(--toq-navy)]">Bairro</span>
          <input
            value={value.neighborhood}
            onChange={(e) => patch({ neighborhood: e.target.value })}
            maxLength={80}
            className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-navy)]"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-[var(--toq-navy)]">Complemento</span>
        <input
          value={value.complement}
          onChange={(e) => patch({ complement: e.target.value })}
          maxLength={80}
          placeholder="Apto, bloco, sala…"
          className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-navy)]"
        />
      </label>
    </fieldset>
  );
}
