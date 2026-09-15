# Responsible AI statement

Ìròyìn helps a person turn code-switched speech into something they can understand, express, or use as the first draft of a public-service incident report. It is an assistive record-making tool, not an authority.

## Human control

- Sahara's original transcript remains visible before any downstream action.
- A reporter can correct transcription errors; the original and corrected versions remain distinguishable.
- Extracted report facts show their transcript evidence when evidence exists.
- Missing critical details trigger clarification rather than silent guessing.
- A report cannot be marked verified while required fields are missing.
- The reporter must review and explicitly verify the record.
- Ìròyìn never files a complaint, sends an email, or contacts an institution automatically.

## Inclusion

Ìròyìn lets a person begin in Pidgin–English or Yorùbá–English rather than requiring formal English at the point of capture. The interface separates speech recognition from the user's chosen output: the same checked transcript can be explained in a familiar language mix or expressed in a formal register without implying that one way of speaking is more valid than another. The prototype is explicit that two supported pairs do not represent all Nigerian or African speech communities; additional languages require community-informed testing and native-speaker evaluation before release.

## Data handling

- Audio is sent to Sahara only after the user chooses to transcribe.
- API keys remain in server-side environment variables and are never placed in client bundles or benchmark artifacts.
- Report cases and audio blobs are stored in IndexedDB in the current browser, not in an Ìròyìn account database.
- Local case records expire after 24 hours.
- Public benchmark artifacts must not contain private audio, real complainant data, consent records, or secret keys.
- The custom benchmark permits only acted recordings with recorded consent.

## Safety boundaries

Ìròyìn does not determine whether an allegation is true, provide legal advice, replace emergency services, or guarantee that an official channel is current. It preserves uncertainty and negation in the record and labels channel suggestions as informational. Reporters should re-check important names, dates, amounts, locations, and urgent-risk details before export or submission.

## Model and language limitations

The prototype currently supports Pidgin–English and Yorùbá–English speech input. Speech recognition and semantic transformation can mishear, mistranslate, omit, or over-normalize language. Deterministic incident extraction is intentionally conservative but can still miss facts or classify them incorrectly. Explain/Express may use a hosted Groq model; if unavailable, a limited local fallback is used and labelled by the returned engine.

## Evaluation integrity

The benchmark protocol requires the same audio and human reference for every ASR provider, provider-blind downstream evaluation, explicit failures, immutable raw outputs, audio hashes, license/consent gates, and recorded model settings. The full benchmark is not presented as complete until all corpus and annotation gates pass. The current public pilot is labelled `n=1` and is not generalized beyond its single clip.
