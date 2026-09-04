import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Mode = "explain" | "express";

type TransformBody = {
  text?: string;
  mode?: Mode;
  languagePair?: string;
};

const PHRASES: Array<[RegExp, string]> = [
  [/\bwetin\b/gi, "what"],
  [/\bweytin\b/gi, "what"],
  [/\buna\b/gi, "you all"],
  [/\babeg\b/gi, "please"],
  [/\bdey\b/gi, "am"],
  [/\bfit\b/gi, "can"],
  [/\bno go\b/gi, "will not"],
  [/\bno be\b/gi, "is not"],
  [/\bna so\b/gi, "that is how"],
  [/\bna\b/gi, "is"],
  [/\bdem\b/gi, "they"],
  [/\bim\b/gi, "he"],
  [/\bhim\b/gi, "he"],
  [/\babi\b/gi, "right"],
  [/\bsha\b/gi, "though"],
  [/\bcon\b/gi, "then"],
  [/\bcome\b/gi, "then"],
  [/\bcommot\b/gi, "leave"],
  [/\bcomot\b/gi, "leave"],
  [/\bmake i\b/gi, "let me"],
  [/\bmake we\b/gi, "let us"],
  [/\bi wan\b/gi, "I want to"],
  [/\bi no\b/gi, "I do not"],
  [/\bi just dey\b/gi, "I am just"],
  [/\byou fit\b/gi, "you can"],
  [/\bgo fit\b/gi, "will be able to"],
  [/\be no\b/gi, "it does not"],
  [/\be dey\b/gi, "it is"],
  [/\bthis thing\b/gi, "this"],
];

const DEFINITIONS: Array<[RegExp, string]> = [
  [/\bductility\b/i, "ductility means how easily a material can stretch or bend without breaking"],
  [/\bstrain hardening\b/i, "strain hardening means the material becomes stronger and harder as it is plastically deformed"],
  [/\bdislocation density\b/i, "dislocation density refers to how many crystal-lattice defects are packed into the material"],
  [/\bcold working\b/i, "cold working means shaping a metal below its recrystallization temperature"],
  [/\bcrystalline structure\b/i, "crystalline structure is the ordered atomic arrangement inside the material"],
  [/\blatency\b/i, "latency is the delay between an input and the system's response"],
  [/\bslippage\b/i, "slippage is the difference between the expected trade price and the price actually received"],
  [/\bAPI\b/i, "an API is a defined way for software systems to communicate with one another"],
];

function tidy(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function sentenceCase(text: string) {
  const clean = tidy(text);
  if (!clean) return clean;
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function standardisePidgin(input: string) {
  let output = input;
  for (const [pattern, replacement] of PHRASES) output = output.replace(pattern, replacement);

  output = output
    .replace(/\bI am just test\b/gi, "I am just testing")
    .replace(/\bI am test\b/gi, "I am testing")
    .replace(/\bto see what you can do now left to you\b/gi, "to see what you can do now. It is up to you")
    .replace(/\bwhat you can do now\b/gi, "what you can do now")
    .replace(/\bjust explain to me\b/gi, "just explain it to me")
    .replace(/\bi\b/g, "I")
    .replace(/\s+/g, " ");

  return sentenceCase(output);
}

function isCapabilityQuestion(text: string) {
  const value = text.toLowerCase();
  return (
    /what.*(you|uroyin|ìròyìn).*(do|fit do|can do)/i.test(value) ||
    /explain.*(yourself|to me)/i.test(value) ||
    /test.*what.*you.*can do/i.test(value)
  );
}

function express(text: string, languagePair?: string) {
  const clean = tidy(text);

  if (languagePair === "pcm_en" || /\b(wetin|dey|fit|abeg|una|na|dem|sha|abi)\b/i.test(clean)) {
    return standardisePidgin(clean);
  }

  return sentenceCase(clean);
}

function explain(text: string, languagePair?: string) {
  const clean = tidy(text);

  if (isCapabilityQuestion(clean)) {
    return "Ìròyìn listens to code-switched speech through Sahara, keeps the original transcript visible, and then helps you do one of three things: understand difficult information, express your thought more clearly, or turn a higher-stakes account into a verified report. The point is that you should not have to translate yourself before the system can work with what you mean.";
  }

  const definitions = DEFINITIONS.filter(([pattern]) => pattern.test(clean)).map(([, definition]) => definition);
  const standard = express(clean, languagePair);

  if (definitions.length) {
    return `In simpler terms: ${standard}\n\nKey idea: ${definitions.join("; ")}.`;
  }

  return `In simpler terms: ${standard}\n\nThe main idea is the same as what was said, but written in a more direct form. If one specific part is confusing, you can record that part and ask Ìròyìn to explain it.`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TransformBody;
    const text = body.text?.trim();
    const mode = body.mode;

    if (!text || text.length < 2) {
      return NextResponse.json({ error: { message: "Add something for Ìròyìn to work with." } }, { status: 400 });
    }
    if (text.length > 8_000) {
      return NextResponse.json({ error: { message: "Keep this transformation under 8,000 characters." } }, { status: 400 });
    }
    if (mode !== "explain" && mode !== "express") {
      return NextResponse.json({ error: { message: "Choose Explain or Express." } }, { status: 400 });
    }

    const result = mode === "explain" ? explain(text, body.languagePair) : express(text, body.languagePair);

    return NextResponse.json({
      mode,
      result,
      engine: "local-prototype-v1",
    });
  } catch {
    return NextResponse.json({ error: { message: "Ìròyìn could not transform that text." } }, { status: 500 });
  }
}
