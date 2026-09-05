"use client";

import { useEffect } from "react";

type TtsResponse = {
  audioUrl?: string;
  provider?: string;
  voiceLanguage?: string;
  error?: { message?: string };
};

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

export function VoicePlayback() {
  useEffect(() => {
    let activeAudio: HTMLAudioElement | null = null;
    let activeButton: HTMLButtonElement | null = null;
    let attachedCard: HTMLElement | null = null;
    let disposed = false;

    const attach = () => {
      const card = document.querySelector<HTMLElement>(".result-card");
      if (!card) return;
      if (activeButton?.isConnected && attachedCard === card) return;
      if (activeButton?.isConnected && attachedCard !== card) activeButton.remove();

      const text = card.innerText.trim();
      if (!text) return;

      card.dataset.voicePlaybackAttached = "true";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button button-secondary";
      button.style.marginTop = "12px";
      button.textContent = "🔊 Listen";
      button.setAttribute("aria-label", "Listen to Ìròyìn's response");

      let speaking = false;
      const reset = () => {
        speaking = false;
        button.disabled = false;
        button.textContent = "🔊 Listen";
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
        button.textContent = "Generating local voice…";

        try {
          const response = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          });
          const payload = (await response.json()) as TtsResponse;
          if (!response.ok || !payload.audioUrl) throw new Error(payload.error?.message || "TTS failed");
          if (disposed) return;

          const audio = new Audio(payload.audioUrl);
          activeAudio = audio;
          audio.onended = reset;
          audio.onerror = () => {
            activeAudio = null;
            browserFallback(text, reset);
          };
          speaking = true;
          button.disabled = false;
          button.textContent = payload.voiceLanguage === "yo" ? "■ Stop Yorùbá voice" : payload.voiceLanguage === "pcm" ? "■ Stop Pidgin voice" : "■ Stop voice";
          await audio.play();
        } catch {
          if (disposed) return;
          speaking = true;
          button.disabled = false;
          button.textContent = "■ Stop (browser voice)";
          browserFallback(text, reset);
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
