"use client";

import { useEffect } from "react";

type VoiceLanguage = "pcm" | "yo" | "en";

type TtsResponse = {
  audioUrl?: string;
  provider?: string;
  voiceLanguage?: string;
  error?: { message?: string };
};

const MAX_VOICE_CHUNK = 220;

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

function chunkText(text: string): string[] {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return [];
  if (compact.length <= MAX_VOICE_CHUNK) return [compact];

  const sentences = compact.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) ?? [compact];
  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const sentence of sentences) {
    if (sentence.length > MAX_VOICE_CHUNK) {
      pushCurrent();
      const words = sentence.split(" ");
      let partial = "";
      for (const word of words) {
        const next = partial ? `${partial} ${word}` : word;
        if (next.length > MAX_VOICE_CHUNK && partial) {
          chunks.push(partial);
          partial = word;
        } else {
          partial = next;
        }
      }
      if (partial) chunks.push(partial);
      continue;
    }

    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length > MAX_VOICE_CHUNK) {
      pushCurrent();
      current = sentence;
    } else {
      current = next;
    }
  }

  pushCurrent();
  return chunks;
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
    let firstChunkVoice: Promise<TtsResponse> | null = null;

    const attach = () => {
      const card = document.querySelector<HTMLElement>(".result-card");
      if (!card) return;
      if (activeButton?.isConnected && attachedCard === card) return;
      if (activeButton?.isConnected && attachedCard !== card) activeButton.remove();

      const text = card.innerText.trim();
      if (!text) return;
      const language = inferLanguage(text);
      const chunks = chunkText(text);
      if (!chunks.length) return;

      card.dataset.voicePlaybackAttached = "true";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button button-secondary";
      button.style.marginTop = "12px";
      button.textContent = language === "yo" ? "🔊 Listen in Yorùbá" : language === "pcm" ? "🔊 Listen in Pidgin" : "🔊 Listen";
      button.setAttribute("aria-label", "Listen to Ìròyìn's response");

      // Generate only the first short chunk immediately. Shorter TTS requests return faster,
      // while the remaining chunks can be generated in parallel once playback starts.
      firstChunkVoice = requestVoice(chunks[0], language);
      firstChunkVoice.catch(() => undefined);

      let speaking = false;
      let stopped = false;

      const idleLabel = () => language === "yo" ? "🔊 Listen in Yorùbá" : language === "pcm" ? "🔊 Listen in Pidgin" : "🔊 Listen";
      const stopLabel = () => language === "yo" ? "■ Stop Yorùbá voice" : language === "pcm" ? "■ Stop Pidgin voice" : "■ Stop voice";

      const reset = () => {
        speaking = false;
        stopped = false;
        button.disabled = false;
        button.textContent = idleLabel();
      };

      const playChunk = async (payload: TtsResponse): Promise<void> => {
        if (disposed || stopped || !payload.audioUrl) return;
        await new Promise<void>((resolve, reject) => {
          const audio = new Audio(payload.audioUrl);
          activeAudio = audio;
          audio.preload = "auto";
          audio.onended = () => {
            activeAudio = null;
            resolve();
          };
          audio.onerror = () => {
            activeAudio = null;
            reject(new Error("Audio playback failed"));
          };
          void audio.play().catch(reject);
        });
      };

      button.addEventListener("click", async () => {
        if (speaking) {
          stopped = true;
          activeAudio?.pause();
          activeAudio = null;
          if ("speechSynthesis" in window) window.speechSynthesis.cancel();
          reset();
          return;
        }

        speaking = true;
        stopped = false;
        button.disabled = false;
        button.textContent = "Preparing first words…";

        try {
          const firstPayload = await (firstChunkVoice ?? requestVoice(chunks[0], language));
          if (disposed || stopped) return;

          button.textContent = stopLabel();

          // Start all remaining requests just before playback begins. They generate while
          // the user is already hearing the first chunk, hiding most of the provider latency.
          const remaining = chunks.slice(1).map((chunk) => requestVoice(chunk, language));

          await playChunk(firstPayload);
          for (const voicePromise of remaining) {
            if (disposed || stopped) return;
            const payload = await voicePromise;
            await playChunk(payload);
          }

          if (!stopped) reset();
        } catch {
          if (disposed || stopped) return;
          firstChunkVoice = null;
          if (language === "en") {
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
