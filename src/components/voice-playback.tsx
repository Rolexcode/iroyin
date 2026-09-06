"use client";

import { useEffect } from "react";

type VoiceLanguage = "pcm" | "yo" | "en";

const MAX_SPOKEN_CHARS = 420;

function inferLanguage(text: string): VoiceLanguage {
  const lower = ` ${text.toLowerCase()} `;
  const hasYoruba = /[ẹọṣàáèéìíòóùú]/i.test(text)
    || /\b(ṣe|jẹ|ní|pé|kò|ó|àwọn|rẹ|yẹn|nígbà|nítorí|ṣùgbọ́n|kí|ẹni|ìtumọ̀|tí|ń|wọ́n|ẹ̀|yóò|bá|fún)\b/i.test(text);
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
  const clean = text.replace(/\*\*/g, "").replace(/^[#>-]+\s*/gm, "").replace(/^\s*\d+[.)]\s*/gm, "").replace(/\s+/g, " ").trim();
  if (clean.length <= MAX_SPOKEN_CHARS) return clean;
  const candidate = clean.slice(0, MAX_SPOKEN_CHARS);
  const lastSentence = Math.max(candidate.lastIndexOf(". "), candidate.lastIndexOf("? "), candidate.lastIndexOf("! "));
  return (lastSentence > 180 ? candidate.slice(0, lastSentence + 1) : candidate).trim();
}

function browserFallback(text: string, onEnd: () => void) {
  if (!("speechSynthesis" in window)) return onEnd();
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find((voice) => /en[-_](NG|GB)/i.test(voice.lang)) ?? voices.find((voice) => /^en/i.test(voice.lang));
  if (preferred) utterance.voice = preferred;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  window.speechSynthesis.speak(utterance);
}

async function requestVoice(text: string, language: VoiceLanguage): Promise<{ url: string; elapsedMs: number }> {
  const startedAt = performance.now();
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language }),
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string }; stage?: string } | null;
    const detail = payload?.error?.message || `Voice request failed (${response.status})`;
    throw new Error(payload?.stage ? `${detail} · ${payload.stage}` : detail);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("audio/")) throw new Error("Voice service returned a non-audio response.");
  const blob = await response.blob();
  if (!blob.size) throw new Error("Voice service returned an empty audio file.");
  return { url: URL.createObjectURL(blob), elapsedMs: Math.round(performance.now() - startedAt) };
}

export function VoicePlayback() {
  useEffect(() => {
    let activeAudio: HTMLAudioElement | null = null;
    let activeButton: HTMLButtonElement | null = null;
    let attachedCard: HTMLElement | null = null;
    let disposed = false;
    let voicePromise: Promise<{ url: string; elapsedMs: number }> | null = null;
    let objectUrl: string | null = null;

    const releaseUrl = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    };

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

      let speaking = false;
      const reset = () => {
        speaking = false;
        button.disabled = false;
        button.textContent = idleLabel();
      };

      button.addEventListener("click", async () => {
        if (speaking) {
          activeAudio?.pause();
          activeAudio = null;
          if ("speechSynthesis" in window) window.speechSynthesis.cancel();
          reset();
          return;
        }

        button.disabled = true;
        button.textContent = "Generating voice…";
        try {
          voicePromise ??= requestVoice(text, language);
          const generated = await voicePromise;
          if (disposed) {
            URL.revokeObjectURL(generated.url);
            return;
          }
          releaseUrl();
          objectUrl = generated.url;
          const audio = new Audio(objectUrl);
          activeAudio = audio;
          audio.preload = "auto";
          audio.onended = reset;
          audio.onerror = () => {
            activeAudio = null;
            voicePromise = null;
            releaseUrl();
            button.disabled = false;
            button.textContent = "Audio could not play · retry";
          };
          speaking = true;
          button.disabled = false;
          button.textContent = language === "yo" ? "■ Stop Yorùbá voice" : language === "pcm" ? "■ Stop Pidgin voice" : "■ Stop voice";
          await audio.play();
        } catch (error) {
          if (disposed) return;
          voicePromise = null;
          const message = error instanceof Error ? error.message : "Voice unavailable";
          if (language === "en" && message.includes("temporarily unavailable")) {
            speaking = true;
            button.disabled = false;
            button.textContent = "■ Stop (browser voice)";
            browserFallback(text, reset);
          } else {
            speaking = false;
            button.disabled = false;
            button.textContent = `Voice error · ${message.slice(0, 70)}`;
            button.title = message;
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
