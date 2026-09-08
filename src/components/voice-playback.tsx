"use client";

import { useEffect } from "react";

type VoiceLanguage = "pcm" | "yo" | "en";
type TtsResponse = {
  audioUrl?: string;
  provider?: string;
  voiceLanguage?: VoiceLanguage;
  error?: { message?: string };
  stage?: string;
};

const MAX_SPOKEN_CHARS = 300;

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
  const lastSentence = Math.max(candidate.lastIndexOf(". "), candidate.lastIndexOf("? "), candidate.lastIndexOf("! "));
  return (lastSentence > 140 ? candidate.slice(0, lastSentence + 1) : candidate).trim();
}

export function VoicePlayback() {
  useEffect(() => {
    let activeAudio: HTMLAudioElement | null = null;
    let activeButton: HTMLButtonElement | null = null;
    let attachedCard: HTMLElement | null = null;
    let disposed = false;

    const stop = () => {
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
      let audioUrl: string | null = null;

      button.addEventListener("click", async () => {
        if (activeAudio && !activeAudio.paused) {
          stop();
          button.textContent = `▶ Listen in ${languageName}`;
          return;
        }

        try {
          if (!audioUrl) {
            button.disabled = true;
            button.textContent = `Generating ${languageName} voice…`;
            const response = await fetch("/api/tts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text, language }),
              cache: "no-store",
            });
            const payload = (await response.json().catch(() => ({}))) as TtsResponse;
            if (!response.ok || !payload.audioUrl) {
              const stage = payload.stage ? ` · ${payload.stage}` : "";
              throw new Error(`${payload.error?.message || `Voice request failed (${response.status})`}${stage}`);
            }
            audioUrl = payload.audioUrl;
          }

          if (disposed || !audioUrl) return;
          const audio = new Audio(audioUrl);
          activeAudio = audio;
          audio.preload = "auto";
          audio.onended = () => {
            activeAudio = null;
            if (button.isConnected) button.textContent = `▶ Listen in ${languageName}`;
          };
          audio.onerror = () => {
            activeAudio = null;
            audioUrl = null;
            if (button.isConnected) {
              button.disabled = false;
              button.textContent = "Audio could not play · retry";
              button.title = "Intron generated a voice URL, but the browser could not play it.";
            }
          };
          button.disabled = false;
          button.textContent = `■ Stop ${languageName} voice`;
          await audio.play();
        } catch (error) {
          if (disposed || !button.isConnected) return;
          stop();
          const message = error instanceof Error ? error.message : "Voice unavailable";
          button.disabled = false;
          button.textContent = "Voice unavailable · retry";
          button.title = message;
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
      activeButton?.remove();
    };
  }, []);

  return null;
}
