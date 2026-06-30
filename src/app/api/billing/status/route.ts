import { NextResponse } from "next/server";
import { isStripeConfigured } from "@/lib/supabase/admin";

export async function GET() {
  return NextResponse.json({ configured: isStripeConfigured() });
}
