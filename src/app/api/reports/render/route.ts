import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { formatPlainTextReport } from "@/lib/incident";
import type { IroyinCase } from "@/lib/types";

export const runtime = "nodejs";

const requestSchema = z.object({ caseFile: z.record(z.string(), z.unknown()) });

function safePdfText(value: string) {
  return value
    .replaceAll("₦", "NGN ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\n]/g, "?");
}

function wrapText(text: string, max = 88) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      if (`${line} ${word}`.trim().length > max && line) {
        lines.push(line);
        line = word;
      } else {
        line = `${line} ${word}`.trim();
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_json", "Send a valid report request.");
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "invalid_report", "A structured case is required.");
  const caseFile = parsed.data.caseFile as IroyinCase;
  if (caseFile.verification?.status !== "verified") {
    return apiError(409, "verification_required", "Confirm the report before exporting it.");
  }
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let page = document.addPage([595.28, 841.89]);
  let y = 786;
  const margin = 54;

  page.drawText("IROYIN", { x: margin, y, size: 22, font: bold, color: rgb(0.10, 0.13, 0.12) });
  page.drawText("Verified incident record", { x: margin, y: y - 22, size: 9, font: regular, color: rgb(0.35, 0.39, 0.37) });
  page.drawLine({ start: { x: margin, y: y - 38 }, end: { x: 541, y: y - 38 }, thickness: 1, color: rgb(0.85, 0.35, 0.22) });
  y -= 65;

  for (const line of wrapText(safePdfText(formatPlainTextReport(caseFile)))) {
    if (y < 55) {
      page = document.addPage([595.28, 841.89]);
      y = 786;
    }
    const isHeading = ["IROYIN INCIDENT REPORT", "SUMMARY", "REPORTED FACTS"].includes(line);
    page.drawText(line, {
      x: margin,
      y,
      size: isHeading ? 10.5 : 9.5,
      font: isHeading ? bold : regular,
      color: rgb(0.12, 0.14, 0.13),
    });
    y -= line ? 15 : 9;
  }
  const bytes = await document.save();
  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${caseFile.caseId || "iroyin-report"}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
