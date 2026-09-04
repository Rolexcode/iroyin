import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Mode = "explain" | "express";
type ExplainStyle = "simple_en" | "pcm_en" | "yo_en";
type ExpressStyle = "clear_en" | "academic_en" | "professional_en";
type OutputStyle = ExplainStyle | ExpressStyle;

type TransformBody = {
  text?: string;
  mode?: Mode;
  languagePair?: string;
  outputStyle?: OutputStyle;
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
  [/\bductility\b/i, "Ductility is how easily a material can bend or stretch without breaking."],
  [/\bstrain hardening\b/i, "Strain hardening is the strengthening that happens as a metal is permanently deformed."],
  [/\bdislocation density\b/i, "Dislocation density describes how many defects exist in the metal's crystal lattice."],
  [/\bcold working\b/i, "Cold working means shaping a metal while it is below its recrystallization temperature."],
  [/\bcrystalline structure\b/i, "Crystalline structure is the ordered arrangement of atoms inside the material."],
  [/\blatency\b/i, "Latency is the delay between an input and the system's response."],
  [/\bslippage\b/i, "Slippage is the difference between an expected trade price and the price actually received."],
  [/\bAPI\b/i, "An API is a defined way for software systems to communicate with one another."],
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

function stripQuestionTail(text: string) {
  return tidy(
    text
      .replace(/\b(abeg|please)\s+(explain|tell me|help me understand)[\s\S]*$/i, "")
      .replace(/\b(explain|tell me|help me understand)\s+(wetin|what)[\s\S]*$/i, ""),
  );
}

function hasColdWorkingConcept(text: string) {
  return /\bcold working\b/i.test(text) && /\b(dislocation|strain hardening|ductility|bend|hard)/i.test(text);
}

function simpleExplanation(text: string) {
  if (hasColdWorkingConcept(text)) {
    return "When a metal is worked while it is still cold, its atoms are forced to move and more defects build up inside the crystal structure. Those defects start blocking one another, so further movement becomes harder. That is why the metal becomes stronger and harder. But because the atoms can no longer move past each other as easily, the metal also loses ductility — it becomes less able to bend or stretch before cracking.";
  }

  const cleanStatement = stripQuestionTail(text);
  const definitions = DEFINITIONS.filter(([pattern]) => pattern.test(text)).map(([, definition]) => definition);

  if (definitions.length) {
    const base = cleanStatement ? `The main point is: ${standardisePidgin(cleanStatement)}` : "Here is the idea in simpler terms.";
    return `${base}\n\n${definitions.join(" ")}`;
  }

  return `The main point is: ${standardisePidgin(cleanStatement || text)}\n\nI can simplify the wording locally, but this prototype does not yet have a general reasoning model for every topic.`;
}

function pidginExplanation(text: string) {
  if (hasColdWorkingConcept(text)) {
    return "As dem dey work the metal when e never hot reach recrystallization temperature, more small defects dey build up inside the metal structure. Those defects dey block movement inside the metal, so e becomes harder and stronger. But na the same reason make e no fit bend or stretch easily again — the metal don lose some ductility, so e fit crack faster when you force am.";
  }

  const simple = simpleExplanation(text);
  return simple
    .replace(/\bThe main point is:/i, "The main thing be say:")
    .replace(/\bHere is the idea in simpler terms\.?/i, "Make we break am down simply.")
    .replace(/\bdoes not yet have\b/gi, "never get")
    .replace(/\bfor every topic\b/gi, "for every kind topic");
}

function yorubaEnglishExplanation(text: string) {
  if (hasColdWorkingConcept(text)) {
    return "Ní ṣókí, when the metal is worked while it is cold, more defects build up inside its crystal structure. Àwọn defects wọ̀nyí make movement inside the metal harder, so the metal becomes stronger and harder. Ṣùgbọ́n because movement is now more restricted, the metal cannot bend or stretch as easily as before. That reduction in its ability to bend or stretch is what we call lower ductility.";
  }

  const simple = simpleExplanation(text);
  return `Ní ṣókí: ${simple}`;
}

function explain(text: string, outputStyle: ExplainStyle) {
  const clean = tidy(text);

  if (isCapabilityQuestion(clean)) {
    if (outputStyle === "pcm_en") {
      return "Ìròyìn dey listen to code-switched speech through Sahara, keep the original transcript visible, then help you understand difficult information, express your thought clearly, or turn a serious account into a verified report. The idea be say you no suppose translate yourself before technology fit understand you.";
    }
    if (outputStyle === "yo_en") {
      return "Ní ṣókí, Ìròyìn uses Sahara to hear code-switched speech, keeps the original transcript visible, and then helps you understand, express, or report what you mean. Kókó náà ni pé you should not have to translate yourself before technology can understand you.";
    }
    return "Ìròyìn listens to code-switched speech through Sahara, keeps the original transcript visible, and then helps you understand difficult information, express your thought more clearly, or turn a higher-stakes account into a verified report. You should not have to translate yourself before the system can work with what you mean.";
  }

  if (outputStyle === "pcm_en") return pidginExplanation(clean);
  if (outputStyle === "yo_en") return yorubaEnglishExplanation(clean);
  return simpleExplanation(clean);
}

function expressAcademic(text: string) {
  const clean = tidy(text);
  if (/\bcold working\b/i.test(clean) && /\b(hard|strong|ductility|bend|dislocation|defect)/i.test(clean)) {
    return "Cold working increases the strength and hardness of a metal through strain hardening, while the accumulation of dislocations within its crystal structure reduces its ductility and therefore its ability to deform without cracking.";
  }
  return standardisePidgin(clean);
}

function expressProfessional(text: string) {
  const clean = standardisePidgin(text);
  return clean
    .replace(/^Please\s+/i, "")
    .replace(/\bright\??$/i, "")
    .trim();
}

function express(text: string, outputStyle: ExpressStyle, languagePair?: string) {
  const clean = tidy(text);
  if (outputStyle === "academic_en") return expressAcademic(clean);
  if (outputStyle === "professional_en") return expressProfessional(clean);

  if (languagePair === "pcm_en" || /\b(wetin|dey|fit|abeg|una|na|dem|sha|abi)\b/i.test(clean)) {
    return standardisePidgin(clean);
  }

  return sentenceCase(clean);
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

    const outputStyle = mode === "explain"
      ? ((body.outputStyle === "pcm_en" || body.outputStyle === "yo_en" || body.outputStyle === "simple_en") ? body.outputStyle : "simple_en")
      : ((body.outputStyle === "academic_en" || body.outputStyle === "professional_en" || body.outputStyle === "clear_en") ? body.outputStyle : "clear_en");

    const result = mode === "explain"
      ? explain(text, outputStyle as ExplainStyle)
      : express(text, outputStyle as ExpressStyle, body.languagePair);

    return NextResponse.json({
      mode,
      result,
      outputStyle,
      engine: "local-prototype-v2",
    });
  } catch {
    return NextResponse.json({ error: { message: "Ìròyìn could not transform that text." } }, { status: 500 });
  }
}
