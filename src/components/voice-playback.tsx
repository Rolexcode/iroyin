"use client";

import { useEffect } from "react";

type VoiceLanguage = "pcm" | "yo" | "en";
type TtsResponse = { audioUrl?: string; error?: { message?: string } };
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
  return text.replace(/\*\*/g, "").replace(/^[#>-]+\s*/gm, "").replace(/^\s*\d+[.)]\s*/gm, "").replace(/\s+/g, " ").trim();
}

function splitForSpeech(text: string) {
  const clean = cleanForSpeech(text);
  if (!clean) return [];
  const chunks: string[] = [];
  let remaining = clean;
  while (remaining.length > MAX_SPOKEN_CHARS) {
    const candidate = remaining.slice(0, MAX_SPOKEN_CHARS + 1);
    const punctuationBreak = Math.max(candidate.lastIndexOf(". "), candidate.lastIndexOf("? "), candidate.lastIndexOf("! "), candidate.lastIndexOf("; "), candidate.lastIndexOf(", "));
    const wordBreak = candidate.lastIndexOf(" ");
    const breakAt = punctuationBreak >= 45 ? punctuationBreak + 1 : wordBreak >= 45 ? wordBreak : MAX_SPOKEN_CHARS;
    const chunk = remaining.slice(0, breakAt).trim();
    if (chunk) chunks.push(chunk);
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

async function requestNativeVoice(text: string, language: VoiceLanguage) {
  const response = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, language }), cache: "no-store" });
  const payload = (await response.json()) as TtsResponse;
  if (!response.ok || !payload.audioUrl) throw new Error(payload.error?.message || "Voice generation failed");
  return payload.audioUrl;
}

async function requestNativeVoiceWithRetry(text: string, language: VoiceLanguage) {
  try { return await requestNativeVoice(text, language); }
  catch {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return requestNativeVoice(text, language);
  }
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
      if (activeAudio) { activeAudio.pause(); activeAudio.removeAttribute("src"); activeAudio.load(); }
      activeAudio = null;
    };

    const attach = () => {
      const card = document.querySelector<HTMLElement>(".result-card");
      if (!card || (activeButton?.isConnected && attachedCard === card)) return;
      stop();
      activeButton?.remove();

      const fullText = card.innerText.trim();
      const chunks = splitForSpeech(fullText);
      if (!chunks.length) return;
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
        button.textContent = `Preparing ${name} voice…`;

        try {
          // Intron currently needs short clips. Generate them concurrently rather than
          // waiting for 1, then 2, then 3... while preserving their playback order.
          const urls = await Promise.all(chunks.map((chunk) => requestNativeVoiceWithRetry(chunk, language)));
          if (disposed || run !== playbackRun) return;

          const audio = new Audio();
          activeAudio = audio;
          audio.preload = "auto";
          let index = 0;

          const finish = () => {
            activeAudio = null;
            button.disabled = false;
            button.textContent = `▶ Listen in ${name}`;
          };

          const playCurrent = async () => {
            if (disposed || run !== playbackRun || index >= urls.length) { if (index >= urls.length) finish(); return; }
            button.disabled = false;
            button.textContent = urls.length > 1 ? `■ Stop ${name} voice · ${index + 1}/${urls.length}` : `■ Stop ${name} voice`;
            audio.src = urls[index];
            audio.load();
            await audio.play();
          };

          audio.onended = () => {
            if (disposed || run !== playbackRun) return;
            index += 1;
            if (index >= urls.length) { finish(); return; }
            void playCurrent().catch(() => { finish(); });
          };
          audio.onerror = () => { if (run === playbackRun) finish(); };
          await playCurrent();
        } catch (error) {
          if (disposed || run !== playbackRun || !button.isConnected) return;
          stop();
          button.disabled = false;
          button.textContent = `Voice unavailable · retry`;
          button.title = error instanceof Error ? error.message : "Voice unavailable";
        }
      });
    };

    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    attach();
    return () => { disposed = true; observer.disconnect(); stop(); activeButton?.remove(); };
  }, []);

  return null;
}
