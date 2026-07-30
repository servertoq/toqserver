import { NextResponse } from "next/server";
import { normalizeCep } from "@/lib/address";
import { toBrazilUf } from "@/lib/brazilStates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PlaceResult = {
  city: string;
  state: string;
  cep: string | null;
};

async function reverseViaNominatim(lat: number, lng: number): Promise<PlaceResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "pt-BR");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "ToqTennis/1.0 (https://www.toqtennis.com.br; suporte@toqtennis.com.br)",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    address?: {
      city?: string;
      town?: string;
      village?: string;
      municipality?: string;
      county?: string;
      state?: string;
      postcode?: string;
      "ISO3166-2-lvl4"?: string;
      country_code?: string;
    };
  };

  const address = data.address;
  if (!address || address.country_code?.toLowerCase() !== "br") {
    // Ainda tenta se não vier country_code
  }

  const city =
    address?.city ||
    address?.town ||
    address?.village ||
    address?.municipality ||
    address?.county ||
    null;
  const state =
    toBrazilUf(address?.["ISO3166-2-lvl4"]) || toBrazilUf(address?.state) || null;
  if (!city || !state) return null;

  const cep = address?.postcode ? normalizeCep(address.postcode) : null;
  return {
    city: city.trim(),
    state,
    cep: cep && cep.length === 8 ? cep : null,
  };
}

async function reverseViaBigDataCloud(lat: number, lng: number): Promise<PlaceResult | null> {
  const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("localityLanguage", "pt");

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    city?: string;
    locality?: string;
    principalSubdivisionCode?: string;
    principalSubdivision?: string;
    postcode?: string;
    localityInfo?: {
      administrative?: Array<{
        name?: string;
        adminLevel?: number;
        description?: string;
        isoCode?: string;
      }>;
    };
  };

  const admins = data.localityInfo?.administrative ?? [];
  const cityFromAdmin =
    admins.find((a) => a.adminLevel === 8)?.name ||
    admins.find((a) => /cidade|munic[ií]pio|city|municipality/i.test(a.description ?? ""))?.name ||
    null;

  const city = (data.city || data.locality || cityFromAdmin || "").trim() || null;
  const state =
    toBrazilUf(data.principalSubdivisionCode) ||
    toBrazilUf(admins.find((a) => a.adminLevel === 4)?.isoCode) ||
    toBrazilUf(data.principalSubdivision) ||
    null;

  if (!city || !state) return null;

  const cep = data.postcode ? normalizeCep(data.postcode) : null;
  return {
    city,
    state,
    cep: cep && cep.length === 8 ? cep : null,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Coordenadas inválidas." }, { status: 400 });
  }

  try {
    const place =
      (await reverseViaNominatim(lat, lng)) || (await reverseViaBigDataCloud(lat, lng));

    if (!place) {
      return NextResponse.json({ error: "Cidade não encontrada." }, { status: 404 });
    }

    return NextResponse.json(place);
  } catch {
    return NextResponse.json({ error: "Falha ao identificar a cidade." }, { status: 502 });
  }
}
