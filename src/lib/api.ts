import { NextResponse } from "next/server";
import type { ApiErrorBody } from "./types";

export function apiError(
  status: number,
  code: string,
  message: string,
  retryable = false,
  details?: string,
) {
  const body: ApiErrorBody = { error: { code, message, retryable, ...(details ? { details } : {}) } };
  return NextResponse.json(body, { status });
}

export async function readJsonSafely(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text.slice(0, 500) };
  }
}
