import { NextResponse } from "next/server";
import artifact from "@/data/benchmark-results.json";

export async function GET() {
  return NextResponse.json(artifact, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
