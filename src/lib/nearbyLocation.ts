import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCep } from "@/lib/address";

export type UserLocationAnchor = {
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  state: string | null;
  cep: string | null;
  source: "device" | "profile";
};

export type PlaceLocation = {
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
};

const GEO_CACHE_KEY = "toq_user_geo_v1";
const CEP_COORDS_CACHE_PREFIX = "toq_cep_coords_v1:";
/** Raio em km para considerar “perto” quando há coordenadas. */
export const NEARBY_RADIUS_KM = 40;

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function readCachedGeo(): { latitude: number; longitude: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(GEO_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { latitude?: number; longitude?: number };
    if (
      typeof parsed.latitude === "number" &&
      typeof parsed.longitude === "number" &&
      Number.isFinite(parsed.latitude) &&
      Number.isFinite(parsed.longitude)
    ) {
      return { latitude: parsed.latitude, longitude: parsed.longitude };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeCachedGeo(latitude: number, longitude: number) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ latitude, longitude }));
  } catch {
    /* ignore */
  }
}

function readDevicePosition(timeoutMs = 6000): Promise<{ latitude: number; longitude: number } | null> {
  if (typeof window === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  const cached = readCachedGeo();
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        writeCachedGeo(coords.latitude, coords.longitude);
        resolve(coords);
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 15 * 60 * 1000 }
    );
  });
}

type BrasilApiCep = {
  city?: string;
  state?: string;
  location?: {
    coordinates?: { latitude?: number | string; longitude?: number | string };
  };
};

export async function fetchCepCoordinates(cep: string): Promise<{
  latitude: number;
  longitude: number;
  city: string;
  state: string;
} | null> {
  const digits = normalizeCep(cep);
  if (digits.length !== 8) return null;

  if (typeof window !== "undefined") {
    try {
      const cached = sessionStorage.getItem(CEP_COORDS_CACHE_PREFIX + digits);
      if (cached) {
        const parsed = JSON.parse(cached) as {
          latitude: number;
          longitude: number;
          city: string;
          state: string;
        };
        if (Number.isFinite(parsed.latitude) && Number.isFinite(parsed.longitude)) {
          return parsed;
        }
      }
    } catch {
      /* ignore */
    }
  }

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`);
    if (!res.ok) return null;
    const data = (await res.json()) as BrasilApiCep;
    const latRaw = data.location?.coordinates?.latitude;
    const lngRaw = data.location?.coordinates?.longitude;
    const latitude = typeof latRaw === "string" ? Number(latRaw) : latRaw;
    const longitude = typeof lngRaw === "string" ? Number(lngRaw) : lngRaw;
    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return null;
    }
    const result = {
      latitude,
      longitude,
      city: data.city ?? "",
      state: data.state ?? "",
    };
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(CEP_COORDS_CACHE_PREFIX + digits, JSON.stringify(result));
      } catch {
        /* ignore */
      }
    }
    return result;
  } catch {
    return null;
  }
}

export async function fetchProfileLocation(
  supabase: SupabaseClient,
  userId: string
): Promise<{ cep: string | null; city: string | null; state: string | null }> {
  const { data } = await supabase
    .from("profiles")
    .select("address_zip, address_city, address_state")
    .eq("id", userId)
    .maybeSingle();

  return {
    cep: data?.address_zip ? normalizeCep(data.address_zip) || null : null,
    city: data?.address_city?.trim() || null,
    state: data?.address_state?.trim().toUpperCase().slice(0, 2) || null,
  };
}

export async function reverseGeocodeCity(
  latitude: number,
  longitude: number
): Promise<{ city: string | null; state: string | null; cep: string | null }> {
  try {
    const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("localityLanguage", "pt");
    const res = await fetch(url.toString());
    if (!res.ok) return { city: null, state: null, cep: null };
    const data = (await res.json()) as {
      city?: string;
      locality?: string;
      principalSubdivisionCode?: string;
      principalSubdivision?: string;
      postcode?: string;
    };
    const city = data.city || data.locality || null;
    const stateCode = data.principalSubdivisionCode?.replace(/^BR-/, "") || null;
    const state =
      stateCode && stateCode.length === 2
        ? stateCode.toUpperCase()
        : data.principalSubdivision?.slice(0, 2).toUpperCase() || null;
    const cep = data.postcode ? normalizeCep(data.postcode) || null : null;
    return { city, state, cep: cep && cep.length === 8 ? cep : null };
  } catch {
    return { city: null, state: null, cep: null };
  }
}

/** Obtém cidade/UF (e CEP se disponível) a partir do GPS do dispositivo. */
export async function detectCurrentPlace(options?: {
  timeoutMs?: number;
  forceRefresh?: boolean;
}): Promise<{
  city: string;
  state: string;
  cep: string | null;
  latitude: number;
  longitude: number;
} | null> {
  if (typeof window === "undefined" || !navigator.geolocation) return null;

  const timeoutMs = options?.timeoutMs ?? 10000;
  const coords = await new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
    if (!options?.forceRefresh) {
      const cached = readCachedGeo();
      if (cached) {
        resolve(cached);
        return;
      }
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        writeCachedGeo(next.latitude, next.longitude);
        resolve(next);
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: options?.forceRefresh ? 0 : 15 * 60 * 1000 }
    );
  });

  if (!coords) return null;

  const place = await reverseGeocodeCity(coords.latitude, coords.longitude);
  if (!place.city || !place.state) return null;

  return {
    city: place.city,
    state: place.state,
    cep: place.cep,
    latitude: coords.latitude,
    longitude: coords.longitude,
  };
}

/**
 * Resolve âncora do usuário: GPS do dispositivo (preferido) ou CEP/cidade do perfil.
 */
export async function resolveUserLocationAnchor(
  supabase: SupabaseClient,
  userId: string
): Promise<UserLocationAnchor | null> {
  const [device, profile] = await Promise.all([
    readDevicePosition(),
    fetchProfileLocation(supabase, userId),
  ]);

  let latitude: number | null = device?.latitude ?? null;
  let longitude: number | null = device?.longitude ?? null;
  let city = profile.city;
  let state = profile.state;
  let cep = profile.cep;
  let source: UserLocationAnchor["source"] = device ? "device" : "profile";

  if (device && (!city || !state)) {
    const reversed = await reverseGeocodeCity(device.latitude, device.longitude);
    if (!city && reversed.city) city = reversed.city;
    if (!state && reversed.state) state = reversed.state;
  }

  if ((latitude == null || longitude == null) && cep) {
    const coords = await fetchCepCoordinates(cep);
    if (coords) {
      latitude = coords.latitude;
      longitude = coords.longitude;
      if (!city && coords.city) city = coords.city;
      if (!state && coords.state) state = coords.state;
    }
  }

  if (latitude == null && longitude == null && !city && !state && !cep) {
    return null;
  }

  return { latitude, longitude, city, state, cep, source };
}

export type ProximityScore = {
  nearby: boolean;
  /** Menor = mais perto. Sem distância numérica usa valores altos. */
  rank: number;
  distanceKm: number | null;
};

export function scorePlaceProximity(
  anchor: UserLocationAnchor | null,
  place: PlaceLocation
): ProximityScore {
  if (!anchor) {
    return { nearby: false, rank: Number.POSITIVE_INFINITY, distanceKm: null };
  }

  const placeLat = place.latitude;
  const placeLng = place.longitude;
  const hasPlaceCoords =
    typeof placeLat === "number" &&
    typeof placeLng === "number" &&
    Number.isFinite(placeLat) &&
    Number.isFinite(placeLng);
  const hasAnchorCoords =
    typeof anchor.latitude === "number" &&
    typeof anchor.longitude === "number" &&
    Number.isFinite(anchor.latitude) &&
    Number.isFinite(anchor.longitude);

  if (hasAnchorCoords && hasPlaceCoords) {
    const distanceKm = haversineKm(anchor.latitude!, anchor.longitude!, placeLat!, placeLng!);
    return {
      nearby: distanceKm <= NEARBY_RADIUS_KM,
      rank: distanceKm,
      distanceKm,
    };
  }

  const anchorCep = anchor.cep ? normalizeCep(anchor.cep) : "";
  const placeCep = place.cep ? normalizeCep(place.cep) : "";
  if (anchorCep.length >= 5 && placeCep.length >= 5 && anchorCep.slice(0, 5) === placeCep.slice(0, 5)) {
    return { nearby: true, rank: 5, distanceKm: null };
  }

  const anchorCity = anchor.city ? normalizeText(anchor.city) : "";
  const placeCity = place.city ? normalizeText(place.city) : "";
  const anchorState = (anchor.state ?? "").toUpperCase();
  const placeState = (place.state ?? "").toUpperCase();

  if (anchorCity && placeCity && anchorCity === placeCity) {
    if (!anchorState || !placeState || anchorState === placeState) {
      return { nearby: true, rank: 15, distanceKm: null };
    }
  }

  if (anchorCep.length >= 3 && placeCep.length >= 3 && anchorCep.slice(0, 3) === placeCep.slice(0, 3)) {
    return { nearby: true, rank: 25, distanceKm: null };
  }

  // Ainda ordena por proximidade aproximada mesmo fora do “perto”
  if (hasAnchorCoords && hasPlaceCoords) {
    const distanceKm = haversineKm(anchor.latitude!, anchor.longitude!, placeLat!, placeLng!);
    return { nearby: false, rank: distanceKm, distanceKm };
  }

  return { nearby: false, rank: Number.POSITIVE_INFINITY, distanceKm: null };
}

export function partitionByProximity<T>(
  items: T[],
  getPlace: (item: T) => PlaceLocation,
  anchor: UserLocationAnchor | null
): { nearby: T[]; others: T[] } {
  if (!anchor || items.length === 0) {
    return { nearby: [], others: items };
  }

  const scored = items.map((item) => ({
    item,
    score: scorePlaceProximity(anchor, getPlace(item)),
  }));

  scored.sort((a, b) => a.score.rank - b.score.rank);

  const nearby: T[] = [];
  const others: T[] = [];
  for (const row of scored) {
    if (row.score.nearby) nearby.push(row.item);
    else others.push(row.item);
  }
  return { nearby, others };
}

export function formatNearbyAnchorHint(anchor: UserLocationAnchor | null): string | null {
  if (!anchor) return null;
  if (anchor.source === "device") return "Com base na sua localização atual";
  if (anchor.city && anchor.state) return `Com base no seu CEP (${anchor.city} — ${anchor.state})`;
  if (anchor.cep) return `Com base no CEP do seu perfil`;
  if (anchor.city) return `Com base em ${anchor.city}`;
  return "Com base no seu perfil";
}
