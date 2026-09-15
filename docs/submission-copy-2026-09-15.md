# Ìròyìn submission copy

## One-line pitch

Ìròyìn turns Nigerian code-switched speech into a report the speaker can inspect, correct, verify, and use.

## Short description

Ìròyìn is a voice-first public-service reporting assistant built on Sahara by Intron. People can speak naturally in Pidgin–English or Yorùbá–English, review exactly what Sahara heard, and choose to understand the meaning, express it more clearly, or structure it as an incident report. High-stakes reports preserve source evidence, ask for missing critical facts, require human verification, export to text or PDF, and show relevant official channels without submitting anything automatically.

## Full description

Many public complaints begin as a spoken account, but formal systems expect a polished written form. For people who naturally code-switch, that can mean translating themselves, changing how they speak, and remembering exact details under stress. Important facts can be lost before the complaint is even written.

Ìròyìn is a voice-first public-service reporting assistant for Nigerian code-switched speech. A person records or uploads Pidgin–English or Yorùbá–English audio. Sahara by Intron transcribes that natural speech, and Ìròyìn immediately shows the transcript for review instead of treating model output as unquestionable truth.

From the checked transcript, the speaker can choose one of three paths. Explain makes difficult language easier to understand. Express rewrites the same thought in clear, academic, or professional English. Report structures a higher-stakes account into an incident record. The report flow links extracted facts back to transcript evidence, identifies missing critical details, asks targeted clarification, allows corrections, and requires the reporter to verify the final record. Only then can they copy it, export a PDF, or view matched official channels. Ìròyìn never submits a complaint automatically.

Sahara is not a decorative API in this flow. It is the first-mile speech layer that lets users begin in the language mix that comes naturally. Ìròyìn elevates that transcript into a transparent, user-controlled record while preserving the original words and provenance.

The application is a working Next.js prototype deployed on Vercel. API keys stay server-side. Report cases remain in the current browser and expire after 24 hours. The repository also contains a frozen, reproducible benchmark pipeline comparing Sahara, Groq-hosted Whisper large-v3, and Deepgram Nova-3. The full 60-clip run is still pending because the gated AfriSwitch audio download stalled upstream; we therefore publish only an honest one-clip integration pilot. On that clip, Sahara achieved the lowest normalized word error rate, character error rate, and switch-window error of the three systems. We explicitly label the result `n=1` and make no general superiority claim.

Ìròyìn shows how African speech technology can do more than produce text: it can help a person leave a record they understand and trust.

## Links

- Live prototype: https://iroyin.vercel.app
- Public source: https://github.com/Rolexcode/iroyin
- Responsible AI: https://github.com/Rolexcode/iroyin/blob/main/docs/responsible-ai.md
- Pilot benchmark: https://github.com/Rolexcode/iroyin/blob/main/docs/pilot-benchmark-2026-09-15.md
- Demo video: **ADD VIDEO URL BEFORE SUBMITTING**

## Demo script (about 2 minutes 40 seconds)

### 0:00–0:20 — Problem

“A public complaint often begins as speech, not a polished form. If you naturally mix Pidgin or Yorùbá with English, many systems make you translate yourself before they can help. That is where facts get lost.”

### 0:20–0:35 — Solution

“This is Ìròyìn: a voice-first reporting assistant built on Sahara by Intron. You speak naturally, check what the model heard, and decide what happens next.”

### 0:35–1:15 — Sahara transcription

Record or upload the prepared code-switched demo clip. Select the matching speech mix and press **Transcribe with Sahara**.

“The audio goes through our server to Sahara. Ìròyìn does not hide the model output: it shows the original transcript and lets the speaker correct a misheard word before anything higher-stakes happens.”

Briefly show **Explain** and **Express**.

### 1:15–2:05 — Verified report

Choose **Report**, or use the built-in verified-report demo if network latency is risky.

“For a report, deterministic extraction finds only what is supported by the transcript. Each fact keeps its evidence. Missing critical details become questions, not guesses. The reporter can correct the facts, confirm the record, and only then export text or PDF.”

Show the evidence line, verification control, PDF/copy controls, and official channels.

“Ìròyìn suggests official next steps, but it never submits on the person's behalf.”

### 2:05–2:30 — Benchmark evidence

Open the pilot benchmark table.

“We also built a reproducible three-provider benchmark pipeline. The full 60-clip run is still pending an upstream dataset transfer, so we do not pretend it is complete. In our one-clip integration pilot, all three adapters worked, and Sahara had the lowest normalized WER, CER, and switch-window error. It is `n=1`, so this is evidence of the pipeline and a promising result—not a broad superiority claim.”

### 2:30–2:40 — Close

“Ìròyìn turns the way people already speak into a record they can inspect, correct, and trust. Speak naturally. Leave a record you trust.”

## Recording checklist

- Use a prepared, non-sensitive code-switched clip.
- Close unrelated tabs and notifications.
- Set browser zoom so transcript evidence and buttons are readable.
- Preload the app and the benchmark report.
- Keep the built-in verified-report demo ready in case an external API is slow.
- Show the live URL in the address bar once.
- Do not show `.env.local`, API keys, terminal secrets, private audio, or consent records.
- Record at 1080p when possible; verify the final audio before upload.
