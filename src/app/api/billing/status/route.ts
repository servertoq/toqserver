import { NextResponse } from "next/server";
import { isMercadoPagoConfigured } from "@/lib/billing/mercadopago";

export async function GET() {
  return NextResponse.json({
    configured: isMercadoPagoConfigured(),
    provider: "mercadopago",
  });
}
