"use client";

import { useEffect, useState } from "react";
import { fetchAddressByCep, formatCep } from "@/lib/courts";
import type { CourtFormData } from "@/types/courts";

type Props = {
  value: Pick<
    CourtFormData,
    | "cep"
    | "street"
    | "street_number"
    | "complement"
    | "neighborhood"
    | "city"
    | "state"
    | "latitude"
    | "longitude"
    | "formatted_address"
  >;
  onChange: (patch: Partial<CourtFormData>) => void;
  /** Se true, tenta obter a localização do dispositivo ao montar. */
  autoLocate?: boolean;
};

function parseCoord(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function geoErrorMessage(code: number | undefined) {
  if (code === 1) return "Permissão de localização negada no navegador.";
  if (code === 2) return "Não foi possível obter a localização.";
  if (code === 3) return "Tempo esgotado ao obter a localização.";
  return "Não foi possível obter a localização atual.";
}

export function CourtLocationPicker({ value, onChange, autoLocate = true }: Props) {
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [latText, setLatText] = useState(
    value.latitude != null ? String(value.latitude) : ""
  );
  const [lngText, setLngText] = useState(
    value.longitude != null ? String(value.longitude) : ""
  );

  useEffect(() => {
    setLatText(value.latitude != null ? String(value.latitude) : "");
    setLngText(value.longitude != null ? String(value.longitude) : "");
  }, [value.latitude, value.longitude]);

  function applyCoords(lat: number, lng: number) {
    const roundedLat = Number(lat.toFixed(6));
    const roundedLng = Number(lng.toFixed(6));
    setLatText(String(roundedLat));
    setLngText(String(roundedLng));
    onChange({
      latitude: roundedLat,
      longitude: roundedLng,
      formatted_address: value.formatted_address || `${roundedLat}, ${roundedLng}`,
    });
  }

  function requestCurrentLocation() {
    if (!navigator.geolocation) {
      setGeoError("Seu navegador não suporta geolocalização.");
      return;
    }

    setGeoLoading(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyCoords(pos.coords.latitude, pos.coords.longitude);
        setGeoLoading(false);
      },
      (err) => {
        setGeoError(geoErrorMessage(err.code));
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }

  useEffect(() => {
    if (!autoLocate) return;
    if (value.latitude != null && value.longitude != null) return;
    requestCurrentLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLocate]);

  async function handleCepLookup() {
    setCepLoading(true);
    setCepError(null);
    const result = await fetchAddressByCep(value.cep);
    setCepLoading(false);
    if (result.error) {
      setCepError(result.error);
      return;
    }
    onChange({
      street: result.street,
      neighborhood: result.neighborhood,
      city: result.city,
      state: result.state,
    });
  }

  function commitLat(raw: string) {
    setLatText(raw);
    const lat = parseCoord(raw);
    if (lat == null || lat < -90 || lat > 90) {
      onChange({ latitude: null });
      return;
    }
    onChange({
      latitude: lat,
      formatted_address: value.formatted_address || (value.longitude != null ? `${lat}, ${value.longitude}` : ""),
    });
  }

  function commitLng(raw: string) {
    setLngText(raw);
    const lng = parseCoord(raw);
    if (lng == null || lng < -180 || lng > 180) {
      onChange({ longitude: null });
      return;
    }
    onChange({
      longitude: lng,
      formatted_address: value.formatted_address || (value.latitude != null ? `${value.latitude}, ${lng}` : ""),
    });
  }

  const hasCoords = value.latitude != null && value.longitude != null;

  return (
    <div className="space-y-5">
      <div>
        <span className="text-xs font-semibold text-[var(--toq-navy)]">Localização</span>
        <p className="mt-1 text-[11px] text-[var(--toq-text-muted)]">
          Use sua localização atual ou informe latitude e longitude.
        </p>

        <button
          type="button"
          onClick={requestCurrentLocation}
          disabled={geoLoading}
          className="mt-3 w-full rounded-lg toq-btn-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 sm:w-auto"
        >
          {geoLoading ? "Obtendo localização…" : "Usar minha localização"}
        </button>

        {geoError && (
          <p className="mt-2 text-xs text-red-600" role="alert">
            {geoError}
          </p>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] font-medium text-[var(--toq-text-muted)]">Latitude</span>
            <input
              type="text"
              inputMode="decimal"
              value={latText}
              onChange={(e) => commitLat(e.target.value)}
              placeholder="-23.550520"
              className="mt-0.5 w-full rounded-lg toq-input px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-[var(--toq-text-muted)]">Longitude</span>
            <input
              type="text"
              inputMode="decimal"
              value={lngText}
              onChange={(e) => commitLng(e.target.value)}
              placeholder="-46.633308"
              className="mt-0.5 w-full rounded-lg toq-input px-3 py-2 text-sm"
            />
          </label>
        </div>

        {hasCoords && (
          <p className="mt-2 text-[11px] font-medium text-[var(--toq-accent)]">
            Coordenadas: {value.latitude!.toFixed(6)}, {value.longitude!.toFixed(6)}
          </p>
        )}
      </div>

      <div>
        <span className="text-xs font-semibold text-[var(--toq-navy)]">Endereço</span>

        <div className="mt-2 flex flex-wrap gap-2">
          <label className="min-w-[140px] flex-1">
            <span className="text-[11px] font-medium text-[var(--toq-text-muted)]">CEP</span>
            <input
              value={value.cep}
              onChange={(e) => onChange({ cep: e.target.value })}
              placeholder="00000-000"
              maxLength={9}
              className="mt-0.5 w-full rounded-lg toq-input px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleCepLookup()}
            disabled={cepLoading}
            className="mt-5 self-end rounded-lg toq-btn-outline px-3 py-2 text-xs font-bold disabled:opacity-50"
          >
            {cepLoading ? "Buscando…" : "Buscar CEP"}
          </button>
        </div>
        {cepError && <p className="mt-1 text-xs text-red-600">{cepError}</p>}
        {value.cep && (
          <p className="mt-1 text-[11px] text-[var(--toq-text-muted)]">CEP: {formatCep(value.cep)}</p>
        )}

        <label className="mt-3 block">
          <span className="text-[11px] font-medium text-[var(--toq-text-muted)]">Rua / Avenida</span>
          <input
            value={value.street}
            onChange={(e) => onChange({ street: e.target.value })}
            className="mt-0.5 w-full rounded-lg toq-input px-3 py-2 text-sm"
          />
        </label>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="text-[11px] font-medium text-[var(--toq-text-muted)]">Número</span>
            <input
              value={value.street_number}
              onChange={(e) => onChange({ street_number: e.target.value })}
              className="mt-0.5 w-full rounded-lg toq-input px-3 py-2 text-sm"
            />
          </label>
          <label>
            <span className="text-[11px] font-medium text-[var(--toq-text-muted)]">Complemento</span>
            <input
              value={value.complement}
              onChange={(e) => onChange({ complement: e.target.value })}
              className="mt-0.5 w-full rounded-lg toq-input px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="text-[11px] font-medium text-[var(--toq-text-muted)]">Bairro</span>
            <input
              value={value.neighborhood}
              onChange={(e) => onChange({ neighborhood: e.target.value })}
              className="mt-0.5 w-full rounded-lg toq-input px-3 py-2 text-sm"
            />
          </label>
          <label>
            <span className="text-[11px] font-medium text-[var(--toq-text-muted)]">Cidade</span>
            <input
              value={value.city}
              onChange={(e) => onChange({ city: e.target.value })}
              required
              className="mt-0.5 w-full rounded-lg toq-input px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="mt-3 block w-24">
          <span className="text-[11px] font-medium text-[var(--toq-text-muted)]">UF</span>
          <input
            value={value.state}
            onChange={(e) => onChange({ state: e.target.value.toUpperCase().slice(0, 2) })}
            maxLength={2}
            required
            className="mt-0.5 w-full rounded-lg toq-input px-3 py-2 text-sm uppercase"
          />
        </label>
      </div>
    </div>
  );
}
