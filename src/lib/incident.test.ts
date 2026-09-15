import { describe, expect, it } from "vitest";
import { iroyinCaseSchema } from "./case-schema";
import { createDemoCase } from "./demo-data";
import { applyClarification, applyFactCorrection, evidenceFor, verifyCase } from "./incident";

describe("incident evidence and verification", () => {
  it("locates an evidence quote without changing the source casing", () => {
    expect(evidenceFor("Cable dey BURN near am", "cable dey burn")).toEqual({
      quote: "Cable dey BURN",
      start: 0,
      end: 14,
    });
  });

  it("turns a missing critical answer into a clarified fact", () => {
    const clarified = applyClarification(
      createDemoCase(),
      "location",
      "Where exactly did this happen?",
      "12 Akin Street, Lagos",
    );

    expect(clarified.missingCriticalFields).toEqual([]);
    expect(clarified.stage).toBe("review");
    expect(clarified.facts.find((fact) => fact.field === "location")).toMatchObject({
      value: "12 Akin Street, Lagos",
      status: "clarified",
      evidence: null,
    });
    expect(() => verifyCase(clarified)).not.toThrow();
  });

  it("refuses to verify while a required fact is missing", () => {
    expect(() => verifyCase(createDemoCase())).toThrow("critical details");
  });

  it("invalidates verification after a reporter correction", () => {
    const clarified = applyClarification(
      createDemoCase(),
      "location",
      "Where exactly did this happen?",
      "12 Akin Street, Lagos",
    );
    const verified = verifyCase(clarified);
    const fact = verified.facts.find((item) => item.field === "location");
    expect(fact).toBeDefined();

    const corrected = applyFactCorrection(verified, fact!.id, "14 Akin Street, Lagos");
    expect(corrected.verification.status).toBe("unverified");
    expect(corrected.stage).toBe("review");
  });

  it("accepts a complete in-browser case and rejects malformed input", () => {
    expect(iroyinCaseSchema.safeParse(createDemoCase()).success).toBe(true);
    expect(iroyinCaseSchema.safeParse({ verification: { status: "verified" } }).success).toBe(false);
  });
});
