# Three-provider code-switching pilot

Date: 15 September 2026
Status: exploratory pilot (`n=1`), not the frozen 60-clip benchmark

## Result

One licensed Pidgin–English AfriSwitch clip was sent unchanged to Sahara by Intron, Groq-hosted Whisper large-v3, and Deepgram Nova-3. Sahara produced the lowest error on every accuracy metric measured for this clip.

| Provider | Normalized WER | Normalized CER | Switch-window WER | Latency |
| --- | ---: | ---: | ---: | ---: |
| Sahara by Intron | **20.00%** | **10.46%** | **11.11%** | 8.63 s |
| Whisper large-v3 (Groq) | 23.33% | 11.11% | 22.22% | **3.22 s** |
| Deepgram Nova-3 | 56.67% | 32.68% | 66.67% | 3.97 s |

Raw WER/CER, before the protocol's punctuation and orthographic normalization:

| Provider | Raw WER | Raw CER |
| --- | ---: | ---: |
| Sahara by Intron | **43.33%** | **14.56%** |
| Whisper large-v3 (Groq) | 56.67% | 17.09% |
| Deepgram Nova-3 | 106.67% | 43.67% |

Lower is better for every metric in both tables. Latency is wall-clock client time and includes network conditions; it is descriptive, not a controlled throughput measurement.

## Test item

- Dataset: [`intronhealth/AfriSwitch`](https://huggingface.co/datasets/intronhealth/AfriSwitch)
- Config/split: `pidgin` / `test`
- Source filename: `IUl9bk19QlE_chunk_524000-535344_48.wav`
- Duration: 11.344 seconds
- Local test filename: `afriswitch-pidgin-smoke.wav`
- Audio SHA-256: `ac4ee5abbf3848787022d5e13226387e0b33ac717d5daf8a8ff1bd3f845e3ace`
- License basis: CC BY-NC-SA 4.0, as stated by the AfriSwitch dataset card
- Human reference: `People Redemption Council, PRC dis one dis one dis one all na soldier go, soldier come, all na name and name no change anything. You know, so that's the thing`
- Tagged English span: `[[EN]]You know, so that's the thing[[/EN]]`
- Switch-token boundary indices: `[24, 30]`

The dataset card describes AfriSwitch as a human-transcribed, evaluation-only test benchmark. It defines `transcription` as the verbatim human transcript and `transcription_tagged` as the same transcript with English spans annotated.

## Provider outputs and settings

### Sahara by Intron

```text
People redemption council, PRC this one this one this one soldier go soldier come all na name and name no change anything you know so that's the thing so
```

- Language input: `pcm`
- Corrections: enabled by the Sahara endpoint
- Terminal status: `FILE_TRANSCRIBED`

### Groq-hosted Whisper large-v3

```text
People redemption council, PRC, this one, this one, this one, all now soldier go soldier come. All now name and name no change anything. You know so and that's the thing so
```

- Model: `whisper-large-v3`
- Response format: JSON
- Temperature: `0`
- Language hint: none
- Prompt: none

### Deepgram Nova-3

```text
People redemption council, PRC. This one, this one, this one. All now. So they are go. So they are come. All the name. And name no change anything. Mhmm. You know? So and and and that that's the thing. So
```

- Model: `nova-3`
- Smart format: disabled
- Punctuation: enabled
- Diarization: disabled
- Language hint: none
- Provider confidence: `0.9038086`

## Method

All providers received the same WAV bytes. No provider-specific transcript correction or prompt was used. WER and CER use the repository's frozen scoring code. Normalized scoring applies the same provider-neutral normalization to the reference and each hypothesis. Switch-window WER scores tokens around the human-annotated language-switch boundaries with radius three.

No critical-entity F1 or Report Integrity Score is reported because this AfriSwitch utterance is not one of the designed incident-report clips and has no human reference-slot annotation.

## Limitation and full-benchmark status

This is a smoke-test-sized result. `n=1` is enough to prove that all three adapters can process the same code-switched clip and that the scoring pipeline works; it is **not** enough to claim that one model is generally better.

The frozen benchmark expects 60 clips: 36 stratified AfriSwitch utterances and 24 consented acted incident clips. It remains `not_run`. Repeated attempts to fetch the gated Pidgin and Yorùbá dataset shards reached Hugging Face successfully but stalled at the backing CDN before audio bytes were transferred. No missing result has been estimated or filled with synthetic data.
