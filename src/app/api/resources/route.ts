import { NextResponse } from "next/server";
import { z } from "zod";
import { VERIFIED_RESOURCES } from "@/data/resources";
import { apiError } from "@/lib/api";

const scenarioSchema = z.enum(["tenancy_housing", "infrastructure_hazard", "workplace_public_service"]);

export async function GET(request: Request) {
  const scenario = new URL(request.url).searchParams.get("scenario");
  const parsed = scenarioSchema.safeParse(scenario);
  if (!parsed.success) return apiError(400, "invalid_scenario", "Choose one of the supported report categories.");
  return NextResponse.json({
    resources: VERIFIED_RESOURCES.filter((resource) => resource.scenario === parsed.data).slice(0, 3),
    disclaimer: "These are official information or complaint channels, not endorsements or legal advice. Ìròyìn never submits automatically.",
  });
}
