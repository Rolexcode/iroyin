"use client";

import { useEffect } from "react";

type VoiceLanguage = "pcm" | "yo" | "en";
type TtsResponse = {
  audioUrl?: string;
  provider?: string;
  voiceLanguage?: VoiceLanguage;
  voiceAccent?: string;
  error?: { message?: string };
};

const MAX_SPOKEN_CHARS = 95;

function inferLanguage(text: string): VoiceLanguage {
  const lower = ` ${text.toLowerCase()} `;
  if (/[ẹọṣàáèéìíòóùú]/i.test(text)) return "yo";
  const pidgin = [" na ", " dey ", " wetin ", " abeg ", " no go ", " fit ", " wey ", " una ", " dem ", " am ", " e go ", " e no ", " no be ", " sabi ", " don "];
  return pidgin.some((token) => lower.includes(token)) ? "pcm" : "en";
}

function selectedLanguage(card: HTMLElement, text: string): VoiceLanguage {
  const style = card.dataset.outputStyle;
  if (style === "pcm_en") return "pcm";
  if (style === "yo_en") return "yo";
  if (["simple_en", "clear_en", "academic_en", "professional_en"].includes(style || "")) return "en";
  return inferLanguage(text);
}

function spokenVersion(text: string) {
  const clean = text.replace(/\*\*/g, "").replace(/^[#>-]+\s*/gm, "").replace(/^\s*\d+[.)]\s*/gm, "").replace(/\s+/g, " ").trim();
  if (clean.length <= MAX_SPOKEN_CHARS) return clean;
  const candidate = clean.slice(0, MAX_SPOKEN_CHARS);
  const lastBreak = Math.max(candidate.lastIndexOf(". "), candidate.lastIndexOf("? "), candidate.lastIndexOf("! "), candidate.lastIndexOf(", "), candidate.lastIndexOf("; "));
  return (lastBreak > 45 ? candidate.slice(0, lastBreak + 1) : candidate).trim();
}

function browserFallback(text: string, language: VoiceLanguage, button: HTMLButtonElement) {
  if (!("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language === "yo" ? "yo-NG" : "en-NG";
  utterance.rate = 0.92;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find((voice) => voice.lang.toLowerCase() === utterance.lang.toLowerCase())
    ?? voices.find((voice) => /en[-_](NG|GB)/i.test(voice.lang))
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
    let disposed = false;

    const stop = () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      activeAudio?.pause();
      activeAudio = null;
    };

    const attach = () => {
      const card = document.querySelector<HTMLElement>(".result-card");
      if (!card) return;
      if (activeButton?.isConnected && attachedCard === card) return;
      stop();
      activeButton?.remove();

      const fullText = card.innerText.trim();
      if (!fullText) return;
      const text = spokenVersion(fullText);
      const language = selectedLanguage(card, fullText);
      const name = language === "yo" ? "Yorùbá" : language === "pcm" ? "Pidgin" : "English";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "button button-secondary";
      button.style.marginTop = "12px";
      button.textContent = `▶ Listen in ${name}`;
      card.insertAdjacentElement("afterend", button);
      activeButton = button;
      attachedCard = card;

      button.addEventListener("click", async () => {
        if (activeAudio && !activeAudio.paused) {
          stop();
          button.textContent = `▶ Listen in ${name}`;
          return;
        }

        button.disabled = true;
        button.textContent = `Generating ${name} voice…`;

        try {
          const response = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, language }),
            cache: "no-store",
          });
          const payload = (await response.json()) as TtsResponse;
          if (!response.ok || !payload.audioUrl) throw new Error(payload.error?.message || "Voice generation failed");
          if (disposed) return;

          const audio = new Audio(payload.audioUrl);
          activeAudio = audio;
          audio.preload = "auto";
          audio.onended = () => {
            activeAudio = null;
            if (button.isConnected) button.textContent = `▶ Listen in ${name}`;
          };
          audio.onerror = () => {
            activeAudio = null;
            if (!button.isConnected) return;
            browserFallback(text, language, button);
          };
          button.disabled = false;
          button.textContent = `■ Stop ${name} voice`;
          await audio.play();
        } catch (error) {
          if (disposed || !button.isConnected) return;
          stop();
          button.disabled = false;
          const fallback = browserFallback(text, language, button);
          button.title = fallback
            ? "Intron voice could not play; using the device voice so the demo still has audio."
            : (error instanceof Error ? error.message : "Voice unavailable");
          if (!fallback) button.textContent = "Voice unavailable · retry";
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
