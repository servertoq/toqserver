"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAddressByCep, formatCep } from "@/lib/courts";
import type { CourtFormData } from "@/types/courts";

const DEFAULT_CENTER = { lat: -23.5505, lng: -46.6333 };
const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

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
};

export function CourtLocationPicker({ value, onChange }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  const setMarker = useCallback(
    (lat: number, lng: number) => {
      if (!mapInstance.current) return;
      const pos = { lat, lng };
      if (markerRef.current) {
        markerRef.current.setPosition(pos);
      } else {
        markerRef.current = new google.maps.Marker({
          map: mapInstance.current,
          position: pos,
          draggable: true,
        });
        markerRef.current.addListener("dragend", () => {
          const p = markerRef.current?.getPosition();
          if (p) void reverseGeocode(p.lat(), p.lng());
        });
      }
      mapInstance.current.panTo(pos);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      if (!window.google?.maps) return;
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status !== "OK" || !results?.[0]) {
          onChange({ latitude: lat, longitude: lng });
          return;
        }
        applyGeocoderResult(results[0], lat, lng);
      });
    },
    [onChange]
  );

  const applyGeocoderResult = useCallback(
    (result: google.maps.GeocoderResult, lat: number, lng: number) => {
      let street = "";
      let streetNumber = "";
      let neighborhood = "";
      let city = "";
      let state = "";
      let cep = "";

      for (const c of result.address_components) {
        const types = c.types;
        if (types.includes("postal_code")) cep = c.long_name.replace(/\D/g, "");
        if (types.includes("route")) street = c.long_name;
        if (types.includes("street_number")) streetNumber = c.long_name;
        if (types.includes("sublocality") || types.includes("neighborhood")) {
          neighborhood = c.long_name;
        }
        if (types.includes("administrative_area_level_2")) city = c.long_name;
        if (types.includes("locality") && !city) city = c.long_name;
        if (types.includes("administrative_area_level_1")) state = c.short_name;
      }

      onChange({
        latitude: lat,
        longitude: lng,
        formatted_address: result.formatted_address ?? "",
        street: street || value.street,
        street_number: streetNumber || value.street_number,
        neighborhood: neighborhood || value.neighborhood,
        city: city || value.city,
        state: state || value.state,
        cep: cep || value.cep,
      });
    },
    [onChange, value]
  );

  useEffect(() => {
    if (!MAPS_KEY) {
      setMapsError("Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY no .env.local para usar o mapa.");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { importLibrary, setOptions } = await import("@googlemaps/js-api-loader");
        setOptions({
          key: MAPS_KEY,
          v: "weekly",
          language: "pt-BR",
          region: "BR",
        });
        await importLibrary("maps");
        await importLibrary("places");
        if (cancelled || !mapRef.current) return;

        mapInstance.current = new google.maps.Map(mapRef.current, {
          center: DEFAULT_CENTER,
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });

        mapInstance.current.addListener("click", (e: google.maps.MapMouseEvent) => {
          const lat = e.latLng?.lat();
          const lng = e.latLng?.lng();
          if (lat == null || lng == null) return;
          setMarker(lat, lng);
          void reverseGeocode(lat, lng);
        });

        if (searchRef.current) {
          autocompleteRef.current = new google.maps.places.Autocomplete(searchRef.current, {
            componentRestrictions: { country: "br" },
            fields: ["address_components", "formatted_address", "geometry"],
          });
          autocompleteRef.current.addListener("place_changed", () => {
            const place = autocompleteRef.current?.getPlace();
            if (!place?.geometry?.location) return;
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            setMarker(lat, lng);
            if (place.address_components) {
              applyGeocoderResult(
                {
                  address_components: place.address_components,
                  formatted_address: place.formatted_address ?? "",
                } as google.maps.GeocoderResult,
                lat,
                lng
              );
            } else {
              onChange({
                latitude: lat,
                longitude: lng,
                formatted_address: place.formatted_address ?? "",
              });
            }
          });
        }

        setMapsReady(true);
      } catch {
        if (!cancelled) setMapsError("Não foi possível carregar o Google Maps.");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapsReady || value.latitude == null || value.longitude == null) return;
    setMarker(value.latitude, value.longitude);
    mapInstance.current?.setZoom(16);
  }, [mapsReady, value.latitude, value.longitude, setMarker]);

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

  return (
    <div className="space-y-4">
      <div>
        <span className="text-xs font-semibold text-[var(--toq-navy)]">Buscar no mapa</span>
        <input
          ref={searchRef}
          type="text"
          placeholder="Digite um endereço ou lugar…"
          className="mt-1 w-full rounded-lg toq-input px-3 py-2 text-sm text-[var(--toq-navy)]"
          disabled={!mapsReady}
        />
        <p className="mt-1 text-[11px] text-[var(--toq-text-muted)]">
          Clique no mapa para marcar a localização exata da quadra.
        </p>
      </div>

      <div
        ref={mapRef}
        className={`h-56 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 sm:h-64 ${
          mapsReady ? "" : "flex items-center justify-center"
        }`}
      >
        {!mapsReady && (
          <p className="px-4 text-center text-xs text-[var(--toq-text-muted)]">
            {mapsError ?? "Carregando mapa…"}
          </p>
        )}
      </div>

      {value.latitude != null && value.longitude != null && (
        <p className="text-[11px] text-[var(--toq-accent)]">
          Localização marcada ({value.latitude.toFixed(5)}, {value.longitude.toFixed(5)})
        </p>
      )}

      <fieldset className="rounded-xl border border-slate-200 bg-white p-4">
        <legend className="px-1 text-xs font-semibold text-[var(--toq-navy)]">Endereço manual</legend>

        <div className="mt-2 flex flex-wrap gap-2">
          <label className="min-w-[140px] flex-1">
            <span className="text-[11px] font-medium text-[var(--toq-text-muted)]">CEP</span>
            <input
              value={value.cep}
              onChange={(e) => onChange({ cep: e.target.value })}
              placeholder="00000-000"
              maxLength={9}
              className="mt-0.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleCepLookup()}
            disabled={cepLoading}
            className="mt-5 self-end rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-[var(--toq-navy)] disabled:opacity-50"
          >
            {cepLoading ? "Buscando…" : "Buscar CEP"}
          </button>
        </div>
        {cepError && <p className="mt-1 text-xs text-red-600">{cepError}</p>}

        <label className="mt-3 block">
          <span className="text-[11px] font-medium text-[var(--toq-text-muted)]">Rua / Avenida</span>
          <input
            value={value.street}
            onChange={(e) => onChange({ street: e.target.value })}
            className="mt-0.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="text-[11px] font-medium text-[var(--toq-text-muted)]">Número</span>
            <input
              value={value.street_number}
              onChange={(e) => onChange({ street_number: e.target.value })}
              className="mt-0.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label>
            <span className="text-[11px] font-medium text-[var(--toq-text-muted)]">Complemento</span>
            <input
              value={value.complement}
              onChange={(e) => onChange({ complement: e.target.value })}
              className="mt-0.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="text-[11px] font-medium text-[var(--toq-text-muted)]">Bairro</span>
            <input
              value={value.neighborhood}
              onChange={(e) => onChange({ neighborhood: e.target.value })}
              className="mt-0.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label>
            <span className="text-[11px] font-medium text-[var(--toq-text-muted)]">Cidade</span>
            <input
              value={value.city}
              onChange={(e) => onChange({ city: e.target.value })}
              required
              className="mt-0.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
            className="mt-0.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase"
          />
        </label>

        {value.cep && (
          <p className="mt-2 text-[11px] text-[var(--toq-text-muted)]">CEP: {formatCep(value.cep)}</p>
        )}
      </fieldset>
    </div>
  );
}
