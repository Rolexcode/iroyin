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

function cleanForSpeech(text: string) {
  return text
    .replace(/\*\*/g, "")
    .replace(/^[#>-]+\s*/gm, "")
    .replace(/^\s*\d+[.)]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitForSpeech(text: string) {
  const clean = cleanForSpeech(text);
  if (!clean) return [];

  const chunks: string[] = [];
  let remaining = clean;

  while (remaining.length > MAX_SPOKEN_CHARS) {
    const candidate = remaining.slice(0, MAX_SPOKEN_CHARS + 1);
    const punctuationBreak = Math.max(
      candidate.lastIndexOf(". "),
      candidate.lastIndexOf("? "),
      candidate.lastIndexOf("! "),
      candidate.lastIndexOf("; "),
      candidate.lastIndexOf(", "),
    );
    const wordBreak = candidate.lastIndexOf(" ");
    const breakAt = punctuationBreak >= 45 ? punctuationBreak + 1 : wordBreak >= 45 ? wordBreak : MAX_SPOKEN_CHARS;
    const chunk = remaining.slice(0, breakAt).trim();
    if (chunk) chunks.push(chunk);
    remaining = remaining.slice(breakAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
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

async function requestNativeVoice(text: string, language: VoiceLanguage) {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language }),
    cache: "no-store",
  });
  const payload = (await response.json()) as TtsResponse;
  if (!response.ok || !payload.audioUrl) throw new Error(payload.error?.message || "Voice generation failed");
  return payload.audioUrl;
}

function playAudio(audio: HTMLAudioElement) {
  return new Promise<void>((resolve, reject) => {
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error("Generated audio could not play"));
    audio.play().catch(reject);
  });
}

export function VoicePlayback() {
  useEffect(() => {
    let activeAudio: HTMLAudioElement | null = null;
    let activeButton: HTMLButtonElement | null = null;
    let attachedCard: HTMLElement | null = null;
    let disposed = false;
    let playbackRun = 0;

    const stop = () => {
      playbackRun += 1;
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
      const chunks = splitForSpeech(fullText);
      if (!chunks.length) return;
      const cleanText = cleanForSpeech(fullText);
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
          button.disabled = false;
          return;
        }

        const run = ++playbackRun;
        button.disabled = true;
        button.textContent = `Generating ${name} voice…`;

        try {
          let nextUrlPromise: Promise<string> | null = requestNativeVoice(chunks[0], language);

          for (let i = 0; i < chunks.length; i += 1) {
            const audioUrl = await nextUrlPromise;
            if (disposed || run !== playbackRun) return;

            nextUrlPromise = i + 1 < chunks.length
              ? requestNativeVoice(chunks[i + 1], language)
              : null;

            const audio = new Audio(audioUrl);
            activeAudio = audio;
            audio.preload = "auto";
            button.disabled = false;
            button.textContent = chunks.length > 1
              ? `■ Stop ${name} voice · ${i + 1}/${chunks.length}`
              : `■ Stop ${name} voice`;

            await playAudio(audio);
            if (disposed || run !== playbackRun) return;
            activeAudio = null;
          }

          if (button.isConnected && run === playbackRun) {
            button.textContent = `▶ Listen in ${name}`;
            button.disabled = false;
          }
        } catch (error) {
          if (disposed || run !== playbackRun || !button.isConnected) return;
          stop();
          button.disabled = false;
          const fallback = browserFallback(cleanText, language, button);
          button.title = fallback
            ? "Intron voice could not complete; using the device voice so the demo still has audio."
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
