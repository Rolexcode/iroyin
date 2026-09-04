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
  [/\bwetin\b/gi, "what"], [/\bweytin\b/gi, "what"], [/\buna\b/gi, "you all"], [/\babeg\b/gi, "please"],
  [/\bdey\b/gi, "am"], [/\bfit\b/gi, "can"], [/\bno go\b/gi, "will not"], [/\bno be\b/gi, "is not"],
  [/\bna so\b/gi, "that is how"], [/\bna\b/gi, "is"], [/\bdem\b/gi, "they"], [/\bim\b/gi, "he"],
  [/\bhim\b/gi, "he"], [/\babi\b/gi, "right"], [/\bsha\b/gi, "though"], [/\bcon\b/gi, "then"],
  [/\bcommot\b/gi, "leave"], [/\bcomot\b/gi, "leave"], [/\bmake i\b/gi, "let me"], [/\bmake we\b/gi, "let us"],
  [/\bi wan\b/gi, "I want to"], [/\bi no\b/gi, "I do not"], [/\bi just dey\b/gi, "I am just"], [/\byou fit\b/gi, "you can"],
  [/\bgo fit\b/gi, "will be able to"], [/\be no\b/gi, "it does not"], [/\be dey\b/gi, "it is"], [/\bthis thing\b/gi, "this"],
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

function tidy(text: string) { return text.replace(/\s+/g, " ").replace(/\s+([,.!?;:])/g, "$1").trim(); }
function sentenceCase(text: string) { const clean = tidy(text); return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : clean; }

function standardisePidgin(input: string) {
  let output = input;
  for (const [pattern, replacement] of PHRASES) output = output.replace(pattern, replacement);
  return sentenceCase(output.replace(/\bi\b/g, "I").replace(/\s+/g, " "));
}

function isCapabilityQuestion(text: string) {
  return /\b(what|wetin)\b[\s\S]{0,45}\b(you|ìròyìn|iroyin)\b[\s\S]{0,45}\b(do|fit do|can do)\b/i.test(text)
    || /\b(what|wetin)\b[\s\S]{0,30}\bì?ròyìn\b[\s\S]{0,30}\bfor\b/i.test(text);
}

function hasColdWorkingConcept(text: string) { return /\bcold (working|walking)\b/i.test(text) && /\b(dislocation|strain hardening|ductility|bend|hard)/i.test(text); }

function localExplain(text: string, style: ExplainStyle) {
  const clean = tidy(text);
  if (isCapabilityQuestion(clean)) {
    if (style === "pcm_en") return "Ìròyìn dey use Sahara to hear code-switched speech, then help you understand difficult information, express your thought clearly, or make a verified report. The point be say you no need translate yourself before technology fit understand you.";
    if (style === "yo_en") return "Ní ṣókí, Ìròyìn uses Sahara to hear code-switched speech, then helps you understand, express, or report what you mean. You should not have to translate yourself first.";
    return "Ìròyìn uses Sahara to transcribe code-switched speech, then helps you understand difficult information, express your thought clearly, or create a verified report.";
  }
  if (hasColdWorkingConcept(clean)) {
    if (style === "pcm_en") return "As dem dey work the metal while e cold, more defects dey build up inside the crystal structure. Those defects dey block movement inside the metal, so e becomes harder and stronger. But because movement don reduce, the metal no fit bend or stretch as easily again. Na that loss of ability to bend or stretch be lower ductility.";
    if (style === "yo_en") return "Ní ṣókí, when the metal is worked while it is cold, more defects build up inside its crystal structure. Àwọn defects wọ̀nyí block movement, so the metal becomes stronger and harder. Ṣùgbọ́n it cannot bend or stretch as easily again; that is the reduction in ductility.";
    return "When a metal is worked while cold, defects build up inside its crystal structure. Those defects block movement, which makes the metal stronger and harder. The same restriction also makes it less able to bend or stretch before cracking, so its ductility decreases.";
  }
  const definitions = DEFINITIONS.filter(([pattern]) => pattern.test(clean)).map(([, definition]) => definition);
  return definitions.length ? definitions.join(" ") : `The main point is: ${standardisePidgin(clean)}`;
}

function localExpress(text: string, style: ExpressStyle) {
  const clean = tidy(text);
  if (style === "academic_en" && hasColdWorkingConcept(clean)) return "Cold working increases the strength and hardness of a metal through strain hardening, while the accumulation of dislocations within its crystal structure reduces its ductility and therefore its ability to deform without cracking.";
  return standardisePidgin(clean);
}

function styleInstruction(mode: Mode, style: OutputStyle) {
  if (mode === "explain") {
    if (style === "pcm_en") return "Explain in natural Nigerian Pidgin mixed with clear English. Keep technical terms only where useful and explain them in the same response.";
    if (style === "yo_en") return "Explain in a genuinely natural Yorùbá-English mix. Yorùbá must be visibly present throughout the answer, not just in one opening phrase. Use normal Yorùbá words and diacritics where appropriate, while keeping technical terms in English when that is clearer. Do not switch into Nigerian Pidgin unless the source itself must be quoted.";
    return "Explain in plain, simple English suitable for a student. Focus on causal meaning, not dictionary definitions.";
  }
  if (style === "academic_en") return "Rewrite the speaker's intended meaning in concise academic English suitable for an assignment or classroom explanation.";
  if (style === "professional_en") return "Rewrite the speaker's intended meaning in polished professional English suitable for formal communication.";
  return "Rewrite the speaker's intended meaning in clear natural English without making it unnecessarily formal.";
}

function hasYorubaSignal(text: string) {
  const value = text.toLowerCase();
  return /[áàéèẹíìóòọúùṣńǹ]/i.test(value)
    || /\b(ní|pé|àwọn|ṣùgbọ́n|nítorí|ìdí|kí|nígbà|ẹ̀rọ|ìtumọ̀|rọrùn|kókó|wọ́n|ó|jẹ́|sílẹ̀|lára|báyìí)\b/i.test(value);
}

async function callGroq(text: string, mode: Mode, outputStyle: OutputStyle, correction?: string) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      temperature: 0.2,
      max_completion_tokens: 500,
      reasoning_effort: "low",
      messages: [
        {
          role: "system",
          content: `You are the semantic transformation layer inside Ìròyìn, a Nigerian code-switching voice product. Your job is to preserve the speaker's intended meaning while making it easier to understand or express. ${styleInstruction(mode, outputStyle)}\n\nImportant rules:\n- Return only the transformed answer, no headings or meta-commentary.\n- Do not answer a different question just because the transcript contains phrases like 'explain am to me'.\n- The transcript may contain small ASR errors. Infer an obvious correction only when surrounding context strongly supports it; never invent facts.\n- Preserve numbers, names, negation, uncertainty and the speaker's actual intent.\n- For Explain, teach the concept rather than merely paraphrasing it.\n- For Express, remove the request for explanation and express the underlying thought itself when that is clearly what the speaker is trying to say.${correction ? `\n- ${correction}` : ""}`,
        },
        { role: "user", content: text },
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Groq transform failed with ${response.status}`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return payload.choices?.[0]?.message?.content?.trim() || null;
}

async function groqTransform(text: string, mode: Mode, outputStyle: OutputStyle) {
  let result = await callGroq(text, mode, outputStyle);
  if (result && outputStyle === "yo_en" && !hasYorubaSignal(result)) {
    result = await callGroq(text, mode, outputStyle, "Your previous attempt did not follow the requested Yorùbá-English register. This answer must contain substantial, natural Yorùbá alongside English across the explanation and must not default to Pidgin-English.");
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TransformBody;
    const text = body.text?.trim();
    const mode = body.mode;

    if (!text || text.length < 2) return NextResponse.json({ error: { message: "Add something for Ìròyìn to work with." } }, { status: 400 });
    if (text.length > 8_000) return NextResponse.json({ error: { message: "Keep this transformation under 8,000 characters." } }, { status: 400 });
    if (mode !== "explain" && mode !== "express") return NextResponse.json({ error: { message: "Choose Explain or Express." } }, { status: 400 });

    const outputStyle: OutputStyle = mode === "explain"
      ? ((body.outputStyle === "pcm_en" || body.outputStyle === "yo_en" || body.outputStyle === "simple_en") ? body.outputStyle : "simple_en")
      : ((body.outputStyle === "academic_en" || body.outputStyle === "professional_en" || body.outputStyle === "clear_en") ? body.outputStyle : "clear_en");

    let result: string | null = null;
    let engine = "local-prototype-v2";

    try {
      result = await groqTransform(text, mode, outputStyle);
      if (result) engine = "groq-gpt-oss-120b";
    } catch (error) {
      console.error("Groq transform unavailable; falling back locally", error);
    }

    if (!result) {
      result = mode === "explain"
        ? localExplain(text, outputStyle as ExplainStyle)
        : localExpress(text, outputStyle as ExpressStyle);
    }

    return NextResponse.json({ mode, result, outputStyle, engine });
  } catch {
    return NextResponse.json({ error: { message: "Ìròyìn could not transform that text." } }, { status: 500 });
  }
}