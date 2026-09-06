"use client";

import { useEffect } from "react";

type VoiceLanguage = "pcm" | "yo" | "en";

type TtsResponse = {
  audioUrl?: string;
  provider?: string;
  voiceLanguage?: string;
  error?: { message?: string };
};

function inferLanguage(text: string): VoiceLanguage {
  const lower = ` ${text.toLowerCase()} `;
  const hasYoruba = /[ẹọṣàáèéìíòóùú]/i.test(text)
    || /\b(ṣe|jẹ|ní|pé|kò|ó|àwọn|rẹ|yẹn|nígbà|nítorí|ṣùgbọ́n|kí|ẹni|ìtumọ̀|tí|ń|wọ́n|ẹ̀|yóò|bá|fún)\b/i.test(text);
  if (hasYoruba) return "yo";

  const pidginTokens = [
    " na ", " dey ", " wetin ", " abeg ", " no go ", " fit ", " wey ", " una ", " dem ",
    " am ", " e go ", " e no ", " make you ", " no be ", " sabi ", " wahala ", " sha ",
    " don ", " go fit ", " why e ", " how e ", " for this ",
  ];
  const hits = pidginTokens.filter((token) => lower.includes(token)).length;
  if (hits >= 1) return "pcm";

  return "en";
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
  if (!response.ok || !payload.audioUrl) {
    throw new Error(payload.error?.message || "TTS failed");
  }
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

      const text = card.innerText.trim();
      if (!text) return;
      const language = inferLanguage(text);

      card.dataset.voicePlaybackAttached = "true";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button button-secondary";
      button.style.marginTop = "12px";
      button.textContent = language === "yo" ? "🔊 Listen in Yorùbá" : language === "pcm" ? "🔊 Listen in Pidgin" : "🔊 Listen";
      button.setAttribute("aria-label", "Listen to Ìròyìn's response");

      // Start generating as soon as the result appears so the audio is usually ready
      // by the time the user taps Listen.
      prefetchedVoice = requestVoice(text, language);
      prefetchedVoice.catch(() => undefined);

      let speaking = false;
      const reset = () => {
        speaking = false;
        button.disabled = false;
        button.textContent = language === "yo" ? "🔊 Listen in Yorùbá" : language === "pcm" ? "🔊 Listen in Pidgin" : "🔊 Listen";
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
            if (language === "en") {
              browserFallback(text, reset);
            } else {
              button.textContent = "Voice unavailable · try again";
              button.disabled = false;
              speaking = false;
              prefetchedVoice = null;
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
