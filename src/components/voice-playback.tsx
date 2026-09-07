"use client";

import { useEffect } from "react";

type VoiceLanguage = "pcm" | "yo" | "en";
type QueueResponse = { textId?: string; error?: { message?: string }; voiceLanguage?: string; state?: string };
type StatusResponse = { state?: "processing" | "ready" | "failed"; error?: { message?: string }; upstreamStatus?: string };
type PreparedVoice = { kind: "audio"; url: string } | { kind: "job"; textId: string };

const MAX_SPOKEN_CHARS = 300;

function inferLanguage(text: string): VoiceLanguage {
  const lower = ` ${text.toLowerCase()} `;
  const hasYoruba = /[ẹọṣàáèéìíòóùú]/i.test(text) || /\b(ṣe|jẹ|ní|pé|kò|ó|àwọn|rẹ|yẹn|nígbà|nítorí|ṣùgbọ́n|kí|ẹni|ìtumọ̀|tí|ń|wọ́n|ẹ̀|yóò|bá|fún)\b/i.test(text);
  if (hasYoruba) return "yo";
  const pidginTokens = [" na ", " dey ", " wetin ", " abeg ", " no go ", " fit ", " wey ", " una ", " dem ", " am ", " e go ", " e no ", " make you ", " no be ", " sabi ", " wahala ", " sha ", " don "];
  if (pidginTokens.some((token) => lower.includes(token))) return "pcm";
  return "en";
}

function selectedLanguage(card: HTMLElement, text: string): VoiceLanguage {
  const style = card.dataset.outputStyle;
  if (style === "pcm_en") return "pcm";
  if (style === "yo_en") return "yo";
  if (style === "simple_en" || style === "clear_en" || style === "academic_en" || style === "professional_en") return "en";
  return inferLanguage(text);
}

function spokenVersion(text: string) {
  const clean = text
    .replace(/\*\*/g, "")
    .replace(/^[#>-]+\s*/gm, "")
    .replace(/^\s*\d+[.)]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= MAX_SPOKEN_CHARS) return clean;
  const candidate = clean.slice(0, MAX_SPOKEN_CHARS);
  const lastSentence = Math.max(candidate.lastIndexOf(". "), candidate.lastIndexOf("? "), candidate.lastIndexOf("! "));
  return `${(lastSentence > 140 ? candidate.slice(0, lastSentence + 1) : candidate).trim()}`;
}

function browserFallback(text: string, language: VoiceLanguage, onEnd: () => void) {
  if (!("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.92;
  utterance.lang = language === "yo" ? "yo-NG" : language === "pcm" ? "en-NG" : "en-NG";
  const voices = window.speechSynthesis.getVoices();
  const preferred = language === "yo"
    ? voices.find((voice) => /^yo/i.test(voice.lang))
    : voices.find((voice) => /en[-_](NG|GB)/i.test(voice.lang)) ?? voices.find((voice) => /^en/i.test(voice.lang));
  if (preferred) utterance.voice = preferred;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  window.speechSynthesis.speak(utterance);
  return true;
}

async function sleep(ms: number) { await new Promise((resolve) => setTimeout(resolve, ms)); }

async function requestVoice(text: string, language: VoiceLanguage): Promise<PreparedVoice> {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language }),
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") || "";
  if (response.ok && contentType.startsWith("audio/")) {
    const blob = await response.blob();
    if (!blob.size) throw new Error("Voice service returned an empty audio file.");
    return { kind: "audio", url: URL.createObjectURL(blob) };
  }

  const payload = await response.json().catch(() => ({})) as QueueResponse;
  if (!response.ok || !payload.textId) throw new Error(payload.error?.message || `Voice request failed (${response.status})`);
  return { kind: "job", textId: payload.textId };
}

async function waitUntilReady(textId: string, onProgress?: (status: string) => void): Promise<void> {
  const started = Date.now();
  let attempt = 0;
  while (Date.now() - started < 150_000) {
    if (attempt > 0) await sleep(attempt < 8 ? 750 : 1800);
    const response = await fetch(`/api/tts/status?textId=${encodeURIComponent(textId)}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({})) as StatusResponse;
    if (!response.ok) throw new Error(payload.error?.message || `Voice status failed (${response.status})`);
    if (payload.state === "ready") return;
    if (payload.state === "failed") throw new Error(payload.error?.message || "Intron could not generate this voice.");
    onProgress?.(payload.upstreamStatus || "PROCESSING");
    attempt += 1;
  }
  throw new Error("Intron voice is still processing.");
}

async function fetchAudioBlob(textId: string): Promise<string> {
  const response = await fetch(`/api/tts/audio?textId=${encodeURIComponent(textId)}`, { cache: "no-store" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message || `Audio fetch failed (${response.status})`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("audio/")) throw new Error("Voice service returned a non-audio response.");
  const blob = await response.blob();
  if (!blob.size) throw new Error("Voice service returned an empty audio file.");
  return URL.createObjectURL(blob);
}

export function VoicePlayback() {
  useEffect(() => {
    let activeAudio: HTMLAudioElement | null = null;
    let activeButton: HTMLButtonElement | null = null;
    let attachedCard: HTMLElement | null = null;
    let disposed = false;
    let preparation: Promise<string> | null = null;
    let objectUrl: string | null = null;

    const releaseUrl = () => { if (objectUrl) URL.revokeObjectURL(objectUrl); objectUrl = null; };

    const attach = () => {
      const card = document.querySelector<HTMLElement>(".result-card");
      if (!card) return;
      if (activeButton?.isConnected && attachedCard === card) return;
      if (activeButton?.isConnected && attachedCard !== card) activeButton.remove();

      const fullText = card.innerText.trim();
      if (!fullText) return;
      const text = spokenVersion(fullText);
      const language = selectedLanguage(card, fullText);
      const idleLabel = () => language === "yo" ? "🔊 Listen in Yorùbá" : language === "pcm" ? "🔊 Listen in Pidgin" : "🔊 Listen";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "button button-secondary";
      button.style.marginTop = "12px";
      button.textContent = idleLabel();
      button.setAttribute("aria-label", "Listen to Ìròyìn's response");

      const prepare = async () => {
        const prepared = await requestVoice(text, language);
        if (prepared.kind === "audio") {
          releaseUrl();
          objectUrl = prepared.url;
          return objectUrl;
        }
        await waitUntilReady(prepared.textId, (status) => {
          if (!disposed && button.isConnected && button.disabled) button.title = `Intron: ${status}`;
        });
        const url = await fetchAudioBlob(prepared.textId);
        releaseUrl();
        objectUrl = url;
        return url;
      };

      // Warm the provider in the background, but never disable the control for
      // minutes. A user can tap immediately; the same promise is reused.
      preparation = prepare();
      preparation.then(() => {
        if (!disposed && button.isConnected) { button.disabled = false; button.textContent = idleLabel(); button.title = "Voice ready"; }
      }).catch((error) => {
        if (!disposed && button.isConnected) {
          const message = error instanceof Error ? error.message : "Voice unavailable";
          button.disabled = false;
          button.textContent = "🔊 Listen (device fallback available)";
          button.title = `Intron voice unavailable: ${message}`;
        }
      });

      let speaking = false;
      const reset = () => { speaking = false; button.disabled = false; button.textContent = idleLabel(); };

      button.addEventListener("click", async () => {
        if (speaking) {
          activeAudio?.pause(); activeAudio = null;
          if ("speechSynthesis" in window) window.speechSynthesis.cancel();
          reset(); return;
        }

        button.disabled = true;
        button.textContent = "Loading voice…";
        try {
          if (!preparation) preparation = prepare();
          const url = await Promise.race([
            preparation,
            sleep(12_000).then(() => { throw new Error("Intron is still preparing the voice."); }),
          ]);
          if (disposed) return;
          const audio = new Audio(url);
          activeAudio = audio;
          audio.preload = "auto";
          audio.onended = reset;
          audio.onerror = () => {
            activeAudio = null;
            const fallback = browserFallback(text, language, reset);
            if (!fallback) { button.disabled = false; button.textContent = "Audio could not play · retry"; }
          };
          speaking = true;
          button.disabled = false;
          button.textContent = language === "yo" ? "■ Stop Yorùbá voice" : language === "pcm" ? "■ Stop Pidgin voice" : "■ Stop voice";
          await audio.play();
        } catch {
          if (disposed) return;
          const fallback = browserFallback(text, language, reset);
          if (fallback) {
            speaking = true;
            button.disabled = false;
            button.textContent = language === "yo" ? "■ Stop device Yorùbá voice" : language === "pcm" ? "■ Stop device Pidgin voice" : "■ Stop device voice";
          } else {
            speaking = false;
            button.disabled = false;
            button.textContent = "Voice unavailable · retry";
          }
        }
      });

      card.insertAdjacentElement("afterend", button);
      activeButton = button;
      attachedCard = card;
    };

    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    attach();
    return () => {
      disposed = true;
      observer.disconnect();
      activeAudio?.pause();
      releaseUrl();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);
  return null;
}
