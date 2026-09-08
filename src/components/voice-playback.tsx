"use client";

import { useEffect } from "react";

type VoiceLanguage = "pcm" | "yo" | "en";

const MAX_SPOKEN_CHARS = 95;

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
  const clean = text
    .replace(/\*\*/g, "")
    .replace(/^[#>-]+\s*/gm, "")
    .replace(/^\s*\d+[.)]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= MAX_SPOKEN_CHARS) return clean;
  const candidate = clean.slice(0, MAX_SPOKEN_CHARS);
  const lastBreak = Math.max(candidate.lastIndexOf(". "), candidate.lastIndexOf("? "), candidate.lastIndexOf("! "), candidate.lastIndexOf(", "), candidate.lastIndexOf("; "));
  return (lastBreak > 45 ? candidate.slice(0, lastBreak + 1) : candidate).trim();
}

async function responseMessage(response: Response) {
  try {
    const payload = await response.clone().json() as { error?: { message?: string }; stage?: string; upstreamHttpStatus?: number };
    const stage = payload.stage ? ` · ${payload.stage}` : "";
    const upstream = payload.upstreamHttpStatus ? ` · upstream ${payload.upstreamHttpStatus}` : "";
    return `${payload.error?.message || `Voice request failed (${response.status})`}${stage}${upstream}`;
  } catch {
    return `Voice request failed (${response.status})`;
  }
}

function browserSpeakEnglish(text: string, button: HTMLButtonElement) {
  if (!("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-NG";
  utterance.rate = 0.92;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find((voice) => /en[-_](NG)/i.test(voice.lang))
    ?? voices.find((voice) => /en[-_](GB)/i.test(voice.lang))
    ?? voices.find((voice) => /^en/i.test(voice.lang));
  if (preferred) utterance.voice = preferred;
  utterance.onend = () => { if (button.isConnected) button.textContent = "▶ Listen again"; };
  utterance.onerror = () => { if (button.isConnected) button.textContent = "Voice unavailable · retry"; };
  button.textContent = "■ Stop voice";
  window.speechSynthesis.speak(utterance);
  return true;
}

export function VoicePlayback() {
  useEffect(() => {
    let activeAudio: HTMLAudioElement | null = null;
    let activeButton: HTMLButtonElement | null = null;
    let attachedCard: HTMLElement | null = null;
    let cachedObjectUrl: string | null = null;
    let disposed = false;

    const clearObjectUrl = () => {
      if (cachedObjectUrl) URL.revokeObjectURL(cachedObjectUrl);
      cachedObjectUrl = null;
    };

    const stop = () => {
      window.speechSynthesis?.cancel();
      if (!activeAudio) return;
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio = null;
    };

    const attach = () => {
      const card = document.querySelector<HTMLElement>(".result-card");
      if (!card) return;
      if (activeButton?.isConnected && attachedCard === card) return;

      stop();
      clearObjectUrl();
      if (activeButton?.isConnected) activeButton.remove();

      const fullText = card.innerText.trim();
      if (!fullText) return;
      const text = spokenVersion(fullText);
      const language = selectedLanguage(card, fullText);
      const languageName = language === "yo" ? "Yorùbá" : language === "pcm" ? "Pidgin" : "English";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "button button-secondary";
      button.style.marginTop = "12px";
      button.textContent = `▶ Listen in ${languageName}`;
      button.setAttribute("aria-label", `Play ${languageName} voice`);
      card.insertAdjacentElement("afterend", button);

      activeButton = button;
      attachedCard = card;

      button.addEventListener("click", async () => {
        if (activeAudio && !activeAudio.paused) {
          stop();
          button.textContent = `▶ Listen in ${languageName}`;
          return;
        }

        try {
          if (!cachedObjectUrl) {
            button.disabled = true;
            button.textContent = `Generating native ${languageName} voice…`;
            const response = await fetch("/api/tts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text, language }),
              cache: "no-store",
            });
            if (!response.ok) throw new Error(await responseMessage(response));

            const provider = response.headers.get("x-iroyin-voice-provider");
            const returnedLanguage = response.headers.get("x-iroyin-voice-language");
            if (provider !== "intron") throw new Error("Native Intron voice was not returned.");
            if (returnedLanguage && returnedLanguage !== language) throw new Error("Voice language did not match the selected output.");

            const contentType = response.headers.get("content-type") || "";
            if (!contentType.toLowerCase().startsWith("audio/")) throw new Error("Voice service returned an invalid audio response.");
            const blob = await response.blob();
            if (!blob.size) throw new Error("Voice service returned an empty audio file.");
            cachedObjectUrl = URL.createObjectURL(blob);
          }

          if (disposed || !cachedObjectUrl) return;
          const audio = new Audio(cachedObjectUrl);
          activeAudio = audio;
          audio.preload = "auto";
          audio.onended = () => {
            activeAudio = null;
            if (button.isConnected) button.textContent = `▶ Listen in ${languageName}`;
          };
          audio.onerror = () => {
            activeAudio = null;
            clearObjectUrl();
            if (!button.isConnected) return;
            button.disabled = false;
            if (language === "en" && browserSpeakEnglish(text, button)) {
              button.title = "Intron audio could not play, so Ìròyìn used the device English voice.";
            } else {
              button.textContent = `Native ${languageName} voice unavailable · retry`;
              button.title = `Ìròyìn will not substitute a generic device voice for ${languageName}.`;
            }
          };
          button.disabled = false;
          button.textContent = `■ Stop ${languageName} voice`;
          await audio.play();
        } catch (error) {
          if (disposed || !button.isConnected) return;
          stop();
          clearObjectUrl();
          const message = error instanceof Error ? error.message : "Voice unavailable";
          button.disabled = false;
          if (language === "en" && browserSpeakEnglish(text, button)) {
            button.title = `Intron unavailable (${message}). Using device English voice.`;
          } else {
            button.textContent = `Native ${languageName} voice unavailable · retry`;
            button.title = message;
          }
        }
      });
    };

    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    attach();

    return () => {
      disposed = true;
      observer.disconnect();
      stop();
      clearObjectUrl();
      activeButton?.remove();
    };
  }, []);

  return null;
}
