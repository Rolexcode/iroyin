"use client";

import { useEffect } from "react";

type VoiceLanguage = "pcm" | "yo" | "en";
type QueueResponse = { textId?: string; error?: { message?: string }; voiceLanguage?: string; state?: string; stage?: string };
type StatusResponse = { state?: "processing" | "ready" | "failed"; error?: { message?: string }; upstreamStatus?: string };
type PreparedVoice = { kind: "audio"; url: string } | { kind: "job"; textId: string };

const MAX_SPOKEN_CHARS = 300;

function inferLanguage(text: string): VoiceLanguage {
  const lower = ` ${text.toLowerCase()} `;
  const hasYoruba = /[ẹọṣàáèéìíòóùú]/i.test(text) || /\b(ṣe|jẹ|ní|pé|kò|ó|àwọn|rẹ|yẹn|nígbà|nítorí|ṣùgbọ́n|kí|ẹni|ìtumọ̀|tí|ń|wọ́n|ẹ̀|yóò|bá|fún)\b/i.test(text);
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

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestVoice(text: string, language: VoiceLanguage): Promise<PreparedVoice> {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language }),
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") || "";
  if (response.ok && contentType.startsWith("audio/")) {
    const blob = await response.blob();
    if (!blob.size) throw new Error("Voice service returned an empty audio file.");
    return { kind: "audio", url: URL.createObjectURL(blob) };
  }

  const payload = (await response.json().catch(() => ({}))) as QueueResponse;
  if (!response.ok || !payload.textId) {
    const stage = payload.stage ? ` · ${payload.stage}` : "";
    throw new Error(`${payload.error?.message || `Voice request failed (${response.status})`}${stage}`);
  }
  return { kind: "job", textId: payload.textId };
}

async function waitUntilReady(textId: string): Promise<void> {
  const started = Date.now();
  let attempt = 0;
  while (Date.now() - started < 150_000) {
    if (attempt > 0) await sleep(attempt < 8 ? 750 : 1800);
    const response = await fetch(`/api/tts/status?textId=${encodeURIComponent(textId)}`, { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as StatusResponse;
    if (!response.ok) throw new Error(payload.error?.message || `Voice status failed (${response.status})`);
    if (payload.state === "ready") return;
    if (payload.state === "failed") throw new Error(payload.error?.message || "Intron could not generate this voice.");
    attempt += 1;
  }
  throw new Error("Intron voice is still processing.");
}

async function fetchAudioBlob(textId: string): Promise<string> {
  const response = await fetch(`/api/tts/audio?textId=${encodeURIComponent(textId)}`, { cache: "no-store" });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message || `Audio fetch failed (${response.status})`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("audio/")) throw new Error("Voice service returned a non-audio response.");
  const blob = await response.blob();
  if (!blob.size) throw new Error("Voice service returned an empty audio file.");
  return URL.createObjectURL(blob);
}

async function prepareVoice(text: string, language: VoiceLanguage): Promise<string> {
  const prepared = await requestVoice(text, language);
  if (prepared.kind === "audio") return prepared.url;
  await waitUntilReady(prepared.textId);
  return fetchAudioBlob(prepared.textId);
}

export function VoicePlayback() {
  useEffect(() => {
    let activeAudio: HTMLAudioElement | null = null;
    let activeButton: HTMLButtonElement | null = null;
    let attachedCard: HTMLElement | null = null;
    let objectUrl: string | null = null;
    let disposed = false;

    const releaseUrl = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    };

    const stop = () => {
      if (activeAudio) {
        activeAudio.pause();
        activeAudio.currentTime = 0;
        activeAudio = null;
      }
    };

    const attach = () => {
      const card = document.querySelector<HTMLElement>(".result-card");
      if (!card) return;
      if (activeButton?.isConnected && attachedCard === card) return;

      stop();
      releaseUrl();
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
      button.disabled = true;
      button.textContent = `Preparing ${languageName} voice…`;
      button.setAttribute("aria-label", `Play ${languageName} voice`);
      button.title = "Generating voice with Intron";
      card.insertAdjacentElement("afterend", button);

      activeButton = button;
      attachedCard = card;

      // Generate and fully load the audio before enabling Play. On Android Chrome,
      // audio.play() must happen directly inside a user click; awaiting a network
      // request first can lose the browser's user-activation permission.
      prepareVoice(text, language)
        .then((url) => {
          if (disposed || !button.isConnected || attachedCard !== card) {
            URL.revokeObjectURL(url);
            return;
          }
          releaseUrl();
          objectUrl = url;
          const audio = new Audio(url);
          audio.preload = "auto";
          audio.load();
          activeAudio = audio;
          button.disabled = false;
          button.textContent = `▶ Play ${languageName} voice`;
          button.title = "Voice ready";
        })
        .catch((error) => {
          if (disposed || !button.isConnected) return;
          const message = error instanceof Error ? error.message : "Voice unavailable";
          button.disabled = false;
          button.textContent = "Voice unavailable · retry";
          button.title = message;
        });

      button.addEventListener("click", () => {
        if (!objectUrl) {
          button.disabled = true;
          button.textContent = `Preparing ${languageName} voice…`;
          prepareVoice(text, language)
            .then((url) => {
              if (disposed || !button.isConnected) {
                URL.revokeObjectURL(url);
                return;
              }
              releaseUrl();
              objectUrl = url;
              activeAudio = new Audio(url);
              activeAudio.preload = "auto";
              activeAudio.load();
              button.disabled = false;
              button.textContent = `▶ Play ${languageName} voice`;
              button.title = "Voice ready — tap Play";
            })
            .catch((error) => {
              if (disposed || !button.isConnected) return;
              const message = error instanceof Error ? error.message : "Voice unavailable";
              button.disabled = false;
              button.textContent = "Voice unavailable · retry";
              button.title = message;
            });
          return;
        }

        if (activeAudio && !activeAudio.paused) {
          activeAudio.pause();
          activeAudio.currentTime = 0;
          button.textContent = `▶ Play ${languageName} voice`;
          return;
        }

        const audio = activeAudio ?? new Audio(objectUrl);
        activeAudio = audio;
        audio.onended = () => {
          if (button.isConnected) button.textContent = `▶ Play ${languageName} voice`;
        };
        audio.onerror = () => {
          if (button.isConnected) {
            button.textContent = "Audio could not play · retry";
            button.title = "The generated audio could not be played on this device.";
          }
        };

        // Deliberately no await before play(): this stays in the user's tap event.
        const playPromise = audio.play();
        button.textContent = `■ Stop ${languageName} voice`;
        if (playPromise) {
          playPromise.catch((error) => {
            if (!button.isConnected) return;
            const message = error instanceof Error ? error.message : "Playback was blocked";
            button.textContent = `▶ Play ${languageName} voice`;
            button.title = message;
          });
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
      releaseUrl();
      activeButton?.remove();
    };
  }, []);

  return null;
}
