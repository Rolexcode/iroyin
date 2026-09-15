import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Mode = "explain" | "express";
type ExplainStyle = "simple_en" | "pcm_en" | "yo_en";
type ExpressStyle = "clear_en" | "academic_en" | "professional_en";
type OutputStyle = ExplainStyle | ExpressStyle;
type TransformBody = { text?: string; mode?: Mode; languagePair?: string; outputStyle?: OutputStyle };
type GroqResult = { text: string; model: string };

const GROQ_MODELS = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile"] as const;

const PHRASES: Array<[RegExp, string]> = [
  [/\bwetin\b/gi,"what"],[/\bweytin\b/gi,"what"],[/\buna\b/gi,"you all"],[/\babeg\b/gi,"please"],[/\bdey\b/gi,"am"],[/\bfit\b/gi,"can"],[/\bno go\b/gi,"will not"],[/\bno be\b/gi,"is not"],[/\bna so\b/gi,"that is how"],[/\bna\b/gi,"is"],[/\bdem\b/gi,"they"],[/\bim\b/gi,"he"],[/\bhim\b/gi,"he"],[/\babi\b/gi,"right"],[/\bsha\b/gi,"though"],[/\bcon\b/gi,"then"],[/\bcommot\b/gi,"leave"],[/\bcomot\b/gi,"leave"],[/\bmake i\b/gi,"let me"],[/\bmake we\b/gi,"let us"],[/\bi wan\b/gi,"I want to"],[/\bi no\b/gi,"I do not"],[/\bi just dey\b/gi,"I am just"],[/\byou fit\b/gi,"you can"],[/\bgo fit\b/gi,"will be able to"],[/\be no\b/gi,"it does not"],[/\be dey\b/gi,"it is"],[/\bthis thing\b/gi,"this"],
];

function tidy(text:string){return text.replace(/\s+/g," ").replace(/\s+([,.!?;:])/g,"$1").trim()}
function sentenceCase(text:string){const clean=tidy(text);return clean?clean.charAt(0).toUpperCase()+clean.slice(1):clean}
function standardisePidgin(input:string){let output=input;for(const [pattern,replacement] of PHRASES)output=output.replace(pattern,replacement);return sentenceCase(output.replace(/\bi\b/g,"I").replace(/\s+/g," "))}
function isCapabilityQuestion(text:string){return /\b(what|wetin)\b[\s\S]{0,45}\b(you|ìròyìn|iroyin)\b[\s\S]{0,45}\b(do|fit do|can do)\b/i.test(text)||/\b(what|wetin)\b[\s\S]{0,30}\bì?ròyìn\b[\s\S]{0,30}\bfor\b/i.test(text)}
function hasColdWorkingConcept(text:string){return /\bcold (working|walking)\b/i.test(text)&&/\b(dislocation|strain hardening|ductility|bend|hard)/i.test(text)}

function localKnownExplanation(text:string,style:ExplainStyle){
  const clean=tidy(text);
  if(isCapabilityQuestion(clean)){
    if(style==="pcm_en")return "Ìròyìn dey use Sahara to hear code-switched speech, then help you understand difficult information, express your thought clearly, or make a verified report. The point be say you no need translate yourself before technology fit understand you.";
    if(style==="yo_en")return "Ní ṣókí, Ìròyìn uses Sahara to hear code-switched speech, then helps you understand, express, or report what you mean. O kò ní láti translate ara rẹ first kí technology tó lè understand you.";
    return "Ìròyìn uses Sahara to transcribe code-switched speech, then helps you understand difficult information, express your thought clearly, or create a verified report.";
  }
  if(hasColdWorkingConcept(clean)){
    if(style==="pcm_en")return "As dem dey work the metal while e cold, more defects dey build up inside the crystal structure. Those defects dey block movement inside the metal, so e becomes harder and stronger. But because movement don reduce, the metal no fit bend or stretch as easily again. Na that loss of ability to bend or stretch be lower ductility.";
    if(style==="yo_en")return "Ní ṣókí, when the metal is worked while it is cold, more defects build up inside its crystal structure. Àwọn defects wọ̀nyí block movement, so the metal becomes stronger and harder. Ṣùgbọ́n it cannot bend or stretch as easily again; ìyẹn ni reduction in ductility.";
    return "When a metal is worked while cold, defects build up inside its crystal structure. Those defects block movement, which makes the metal stronger and harder. The same restriction also makes it less able to bend or stretch before cracking, so its ductility decreases.";
  }
  return null;
}

function localExpress(text:string){return standardisePidgin(tidy(text))}

function styleInstruction(mode:Mode,style:OutputStyle){
  if(mode==="explain"){
    const teaching = "EXPLANATION QUALITY: Answer the speaker's actual question. Explain WHY or HOW the idea works, not merely what the transcript says. Use a simple causal chain, then one concrete everyday example when useful. Define unfamiliar terms briefly. Do not just paraphrase, translate, or repeat the input.";
    if(style==="pcm_en")return `${teaching} OUTPUT REGISTER: Nigerian Pidgin + English. Explain naturally in Nigerian Pidgin mixed with clear English. Do not answer in Yorùbá.`;
    if(style==="yo_en")return `${teaching} OUTPUT REGISTER: Yorùbá + English. Write a natural bilingual explanation with substantial Yorùbá throughout every paragraph and English technical terms where useful. NEVER use Nigerian Pidgin words or grammar (for example dey, wetin, abeg, fit, una, dem, go, no be). The language of the input must not override this requested output register.`;
    return `${teaching} OUTPUT REGISTER: Simple English only. Explain in plain English suitable for a student.`;
  }
  if(style==="academic_en")return "OUTPUT REGISTER: Academic English only. Rewrite concisely for an assignment or classroom.";
  if(style==="professional_en")return "OUTPUT REGISTER: Professional English only. Rewrite for formal communication.";
  return "OUTPUT REGISTER: Clear English only. Rewrite naturally without unnecessary formality.";
}

function yorubaScore(text:string){const matches=text.match(/[áàéèẹíìóòọúùṣńǹ]|\b(ní|pé|àwọn|ṣùgbọ́n|nítorí|ìdí|kí|nígbà|ìtumọ̀|rọrùn|kókó|wọ́n|jẹ́|báyìí|ìyẹn|fún|lára|ara|sílẹ̀)\b/gi);return matches?.length??0}
function hasPidginSignal(text:string){return /\b(dey|wetin|abeg|fit|una|dem|wey|sabi|wahala|no be|e no|e go|don|na)\b/i.test(text)}
function followsStyle(text:string,style:OutputStyle){if(style==="yo_en")return yorubaScore(text)>=4&&!hasPidginSignal(text);if(style==="pcm_en")return hasPidginSignal(text);return true}

async function callGroqModel(text:string,mode:Mode,outputStyle:OutputStyle,model:string,correction?:string):Promise<string|null>{
  const apiKey=process.env.GROQ_API_KEY;
  if(!apiKey)return null;

  const body: Record<string, unknown> = {
    model,
    temperature:0.15,
    max_completion_tokens:650,
    messages:[
      {role:"system",content:`You are the semantic explanation and rewriting layer inside Ìròyìn, a Nigerian code-switching voice product. Preserve the speaker's intended meaning while making it genuinely easier to understand or express. ${styleInstruction(mode,outputStyle)}\n\nRules:\n- Obey OUTPUT REGISTER exactly; it is chosen by the user after transcription.\n- Return only the transformed answer, no headings or meta-commentary.\n- Small ASR errors may exist; correct only when context strongly supports it.\n- Never invent facts. Preserve numbers, names, negation and uncertainty.\n- If the user asks a question, answer that question directly.\n- For Explain, teach the concept with reasoning and relationships; a restatement of the transcript is NOT an explanation.\n- For Express, express the underlying thought clearly.${correction?`\n- ${correction}`:""}`},
      {role:"user",content:text}
    ]
  };
  if(model.startsWith("openai/gpt-oss"))body.reasoning_effort="low";

  const response=await fetch("https://api.groq.com/openai/v1/chat/completions",{
    method:"POST",
    headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},
    body:JSON.stringify(body),
    cache:"no-store"
  });

  if(!response.ok){
    const detail=(await response.text()).slice(0,500);
    console.error(`Groq transform failed: ${model} ${response.status}`,detail);
    throw new Error(`Groq transform failed with ${response.status}`);
  }

  const payload=await response.json() as {choices?:Array<{message?:{content?:string}}>};
  return payload.choices?.[0]?.message?.content?.trim()||null;
}

async function callGroq(text:string,mode:Mode,outputStyle:OutputStyle,correction?:string):Promise<GroqResult|null>{
  if(!process.env.GROQ_API_KEY)return null;
  for(const model of GROQ_MODELS){
    try{
      const result=await callGroqModel(text,mode,outputStyle,model,correction);
      if(result)return {text:result,model};
    }catch(error){
      console.error(`Ìròyìn transform model unavailable: ${model}`,error);
    }
  }
  return null;
}

async function groqTransform(text:string,mode:Mode,outputStyle:OutputStyle):Promise<GroqResult|null>{
  let result=await callGroq(text,mode,outputStyle);
  if(result&&!followsStyle(result.text,outputStyle)){
    const correction=outputStyle==="yo_en"?"Regenerate from scratch. The user explicitly selected Yorùbá + English. Use substantial natural Yorùbá throughout, mixed with English where useful, and use ZERO Nigerian Pidgin.":outputStyle==="pcm_en"?"Regenerate from scratch in natural Nigerian Pidgin + English as explicitly selected by the user.":"Regenerate and obey the requested output register exactly.";
    result=await callGroq(text,mode,outputStyle,correction);
  }
  return result&&followsStyle(result.text,outputStyle)?result:null;
}

export async function POST(request:Request){
  try{
    const body=(await request.json()) as TransformBody;
    const text=body.text?.trim();
    const mode=body.mode;
    if(!text||text.length<2)return NextResponse.json({error:{message:"Add something for Ìròyìn to work with."}},{status:400});
    if(text.length>8000)return NextResponse.json({error:{message:"Keep this transformation under 8,000 characters."}},{status:400});
    if(mode!=="explain"&&mode!=="express")return NextResponse.json({error:{message:"Choose Explain or Express."}},{status:400});

    const outputStyle:OutputStyle=mode==="explain"?((body.outputStyle==="pcm_en"||body.outputStyle==="yo_en"||body.outputStyle==="simple_en")?body.outputStyle:"simple_en"):((body.outputStyle==="academic_en"||body.outputStyle==="professional_en"||body.outputStyle==="clear_en")?body.outputStyle:"clear_en");

    const groq=await groqTransform(text,mode,outputStyle);
    if(groq){
      return NextResponse.json({mode,result:groq.text,outputStyle,engine:`groq:${groq.model}`});
    }

    if(mode==="explain"){
      const known=localKnownExplanation(text,outputStyle as ExplainStyle);
      if(known)return NextResponse.json({mode,result:known,outputStyle,engine:"local-known-fallback"});
      return NextResponse.json({error:{message:"The explanation engine is temporarily unavailable. Please retry in a moment."}},{status:503});
    }

    return NextResponse.json({mode,result:localExpress(text),outputStyle,engine:"local-express-fallback"});
  }catch(error){
    console.error("Ìròyìn transform route failed",error);
    return NextResponse.json({error:{message:"Ìròyìn could not transform that text."}},{status:500});
  }
}
