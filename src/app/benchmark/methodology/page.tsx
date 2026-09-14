import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Cloud, FileLock2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Benchmark methodology",
  description: "The amended v1.1 Ìròyìn benchmark protocol, scoring rules, and provenance requirements.",
};

const weights = [
  ["Event or action", 5], ["Negation", 5], ["Amount, quantity, or count", 5], ["Actor or affected person", 5],
  ["Incident type", 4], ["Location", 4], ["Time, date, or duration", 3], ["Urgency or risk", 3], ["Other context or evidence", 1],
] as const;

export default function MethodologyPage() {
  return (
    <div className="site-shell methodology-shell">
      <Link href="/benchmark" className="back-link"><ArrowLeft size={16} /> Benchmark lab</Link>
      <header className="methodology-header">
        <p className="section-kicker">Amended protocol · v1.1</p>
        <h1>Measure the transcript.<br />Then measure what it changes.</h1>
        <p>The protocol was committed and tagged before any benchmark inference. Any benchmark-affecting change requires a new version and a separate result set.</p>
      </header>

      <div className="methodology-layout">
        <aside className="methodology-nav" aria-label="On this page">
          <span>On this page</span>
          <a href="#question">Research question</a><a href="#corpus">Corpus</a><a href="#models">Models</a><a href="#ris">Integrity score</a><a href="#oracle">Oracle baseline</a><a href="#provenance">Provenance</a>
        </aside>
        <article className="methodology-content">
          <section id="question">
            <span className="method-number">01</span><h2>Research question</h2>
            <p>How much report-critical meaning survives when the same Nigerian code-switched incident audio is transcribed by Sahara, Whisper large-v3 through Groq, or Deepgram Nova-3 and then passed through one frozen extraction pipeline?</p>
            <div className="method-rule"><FileLock2 size={19} /><p><strong>Provider-blind extraction.</strong> The extractor receives a transcript, not the provider name. The schema, model snapshot, and instructions are identical for all systems and the human oracle.</p></div>
          </section>

          <section id="corpus">
            <span className="method-number">02</span><h2>Corpus and deterministic selection</h2>
            <p>The v1 corpus contains 36 official <a href="https://huggingface.co/datasets/intronhealth/AfriSwitch" target="_blank" rel="noreferrer">AfriSwitch</a> utterances and 24 consented, acted incident clips. No real complainant data is permitted.</p>
            <ul className="method-list">
              <li><CheckCircle2 size={16} /> AfriSwitch: 18 Pidgin–English and 18 Yorùbá–English, duration 3–30 seconds, at least one switch point.</li>
              <li><CheckCircle2 size={16} /> Stratified within each language by CMI tertile and short/long duration; three samples per stratum; seed 260903.</li>
              <li><CheckCircle2 size={16} /> Custom: eight clips each for housing, infrastructure, and workplace/public-service complaints.</li>
              <li><CheckCircle2 size={16} /> Audio is normalized once to mono 16 kHz signed 16-bit PCM WAV, then hashed. No denoising or silence trimming.</li>
            </ul>
          </section>

          <section id="models">
            <span className="method-number">03</span><h2>Frozen ASR systems</h2>
            <div className="model-method-grid">
              <article><span>01</span><h3>Sahara</h3><p>Intron Voice API. Language input <code>pcm</code> or <code>yo</code>; corrections enabled in the benchmark adapter.</p><a href="https://docs.voice.intron.io/docs/stt/supported-languages" target="_blank" rel="noreferrer">Official language codes</a></article>
              <article><span>02</span><h3>Whisper large-v3 · Groq</h3><p><code>whisper-large-v3</code> through Groq's hosted transcription API, JSON response, temperature 0, no prompt or language hint.</p><a href="https://console.groq.com/docs/speech-to-text" target="_blank" rel="noreferrer">Groq speech-to-text docs</a></article>
              <article><span>03</span><h3>Deepgram Nova-3</h3><p><code>nova-3</code>, smart formatting and diarization disabled, punctuation enabled, no language hint.</p><a href="https://developers.deepgram.com/docs/models-overview" target="_blank" rel="noreferrer">Deepgram model docs</a></article>
            </div>
            <div className="compute-note"><Cloud size={21} /><p><strong>Compute-location amendment.</strong> Whisper may execute locally or in a reproducible Colab, Kaggle, or cloud GPU environment. Location is metadata—not a protocol change—only when revision, decoding, preprocessing, dependencies, and audio hashes remain identical.</p></div>
          </section>

          <section id="ris">
            <span className="method-number">04</span><h2>Report Integrity Score</h2>
            <p>RIS is frozen before results. Each human-annotated reference slot receives full credit only if the normalized meaning is correct and the evidence quote occurs verbatim in the evaluated transcript. There is no partial credit.</p>
            <div className="weight-table">
              {weights.map(([label, weight]) => <div key={label}><span>{label}</span><strong>{weight}</strong></div>)}
            </div>
            <div className="formula"><span>RIS</span><code>100 × Σ(correct slot weights) / Σ(reference slot weights)</code></div>
          </section>

          <section id="oracle">
            <span className="method-number">05</span><h2>Human-transcript oracle</h2>
            <p>The human transcript passes through the same extractor. This yields oracle RIS. For every ASR output, integrity loss is <code>oracle RIS − provider RIS</code>, without clamping. That makes “ASR failed” distinguishable from “extraction failed.”</p>
          </section>

          <section id="provenance">
            <span className="method-number">06</span><h2>Artifact provenance</h2>
            <p>Every run records the protocol tag and commit, environment and dependency versions, compute location, model revisions, provider settings, input hashes, raw and normalized transcripts, extracted JSON, per-clip metrics, aggregate metrics, failures, and latency.</p>
            <p>The public interface reads generated aggregate artifacts only. Failed clips remain in the denominator; values are never copied into UI source code.</p>
            <div className="protocol-hash"><span>Amendment</span><code>benchmark/config/protocol.v1.1-amendment.json</code><span>Results state</span><code>not_run</code></div>
          </section>
        </article>
      </div>
    </div>
  );
}
