"use client";

import { useEffect } from "react";

export function VoicePlayback() {
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const attach = () => {
      const card = document.querySelector<HTMLElement>(".result-card");
      if (!card || card.dataset.voicePlaybackAttached === "true") return;

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
        button.textContent = "🔊 Listen";
      };

      button.addEventListener("click", () => {
        if (speaking) {
          window.speechSynthesis.cancel();
          reset();
          return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1;

        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find((voice) => /en[-_](NG|GB)/i.test(voice.lang))
          ?? voices.find((voice) => /^en/i.test(voice.lang));
        if (preferred) utterance.voice = preferred;

        utterance.onend = reset;
        utterance.onerror = reset;
        speaking = true;
        button.textContent = "■ Stop";
        window.speechSynthesis.speak(utterance);
      });

      card.insertAdjacentElement("afterend", button);
    };

    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    attach();

    return () => {
      observer.disconnect();
      window.speechSynthesis.cancel();
    };
  }, []);

  return null;
}
