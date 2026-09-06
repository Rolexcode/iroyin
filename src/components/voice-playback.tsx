"use client";

import { useEffect } from "react";

type VoiceLanguage = "pcm" | "yo" | "en";

type TtsResponse = {
  audioUrl?: string;
  provider?: string;
  voiceLanguage?: string;
  error?: { message?: string };
};

const MAX_SPOKEN_CHARS = 520;

function inferLanguage(text: string): VoiceLanguage {
  const lower = ` ${text.toLowerCase()} `;
  const hasYoruba = /[ẹọṣàáèéìíòóùú]/i.test(text)
    || /\b(ṣe|jẹ|ní|pé|kò|ó|àwọn|rẹ|yẹn|nígbà|nítorí|ṣùgbọ́n|kí|ẹni|ìtumọ̀|tí|ń|wọ́n|ẹ̀|yóò|bá|fún)\b/i.test(text);
  if (hasYoruba) return "yo";

  const pidginTokens = [
    " na ", " dey ", " wetin ", " abeg ", " no go ", " fit ", " wey ", " una ", " dem ",
    " am ", " e go ", " e no ", " make you ", " no be ", " sabi ", " wahala ", " sha ", " don ",
  ];
  if (pidginTokens.some((token) => lower.includes(token))) return "pcm";
  return "en";
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
  return `${(lastSentence > 260 ? candidate.slice(0, lastSentence + 1) : candidate).trim()}`;
}

function browserFallback(text: string, onEnd: () => void) {
  if (!("speechSynthesis" in window)) {
    onEnd();
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find((voice) => /en[-_](NG|GB)/i.test(voice.lang))
    ?? voices.find((voice) => /^en/i.test(voice.lang));
  if (preferred) utterance.voice = preferred;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  window.speechSynthesis.speak(utterance);
}

async function requestVoice(text: string, language: VoiceLanguage): Promise<TtsResponse> {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language }),
  });
  const payload = (await response.json()) as TtsResponse;
  if (!response.ok || !payload.audioUrl) throw new Error(payload.error?.message || "TTS failed");
  return payload;
}

export function VoicePlayback() {
  useEffect(() => {
    let activeAudio: HTMLAudioElement | null = null;
    let activeButton: HTMLButtonElement | null = null;
    let attachedCard: HTMLElement | null = null;
    let disposed = false;
    let prefetchedVoice: Promise<TtsResponse> | null = null;

    const attach = () => {
      const card = document.querySelector<HTMLElement>(".result-card");
      if (!card) return;
      if (activeButton?.isConnected && attachedCard === card) return;
      if (activeButton?.isConnected && attachedCard !== card) activeButton.remove();

      const fullText = card.innerText.trim();
      if (!fullText) return;
      const text = spokenVersion(fullText);
      const language = inferLanguage(fullText);

      card.dataset.voicePlaybackAttached = "true";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button button-secondary";
      button.style.marginTop = "12px";
      button.textContent = language === "yo" ? "🔊 Listen in Yorùbá" : language === "pcm" ? "🔊 Listen in Pidgin" : "🔊 Listen";
      button.setAttribute("aria-label", "Listen to Ìròyìn's response");

      // Start one short TTS request immediately when the answer appears. This avoids
      // making the user wait for a long response to be synthesized after tapping Listen.
      prefetchedVoice = requestVoice(text, language);
      prefetchedVoice.catch(() => undefined);

      let speaking = false;
      const idleLabel = () => language === "yo" ? "🔊 Listen in Yorùbá" : language === "pcm" ? "🔊 Listen in Pidgin" : "🔊 Listen";
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
        button.textContent = "Preparing voice…";

        try {
          const payload = await (prefetchedVoice ?? requestVoice(text, language));
          if (disposed || !payload.audioUrl) return;

          const audio = new Audio(payload.audioUrl);
          activeAudio = audio;
          audio.preload = "auto";
          audio.onended = reset;
          audio.onerror = () => {
            activeAudio = null;
            prefetchedVoice = null;
            if (language === "en") browserFallback(text, reset);
            else {
              speaking = false;
              button.disabled = false;
              button.textContent = "Voice unavailable · tap to retry";
            }
          };
          speaking = true;
          button.disabled = false;
          button.textContent = language === "yo" ? "■ Stop Yorùbá voice" : language === "pcm" ? "■ Stop Pidgin voice" : "■ Stop voice";
          await audio.play();
        } catch {
          if (disposed) return;
          prefetchedVoice = null;
          if (language === "en") {
            speaking = true;
            button.disabled = false;
            button.textContent = "■ Stop (browser voice)";
            browserFallback(text, reset);
          } else {
            speaking = false;
            button.disabled = false;
            button.textContent = "Voice unavailable · tap to retry";
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
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  return null;
}
