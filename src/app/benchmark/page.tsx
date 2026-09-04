import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Beaker, Database, FileLock2, Gauge, ShieldCheck } from "lucide-react";
import artifact from "@/data/benchmark-results.json";

export const metadata: Metadata = {
  title: "Benchmark lab",
  description: "A frozen, reproducible evaluation of code-switched speech recognition and report integrity.",
};

const metricCards = [
  { icon: Gauge, label: "Speech accuracy", title: "WER, CER & switch-window WER", copy: "Standard errors plus a tighter view around every annotated language switch." },
  { icon: ShieldCheck, label: "Meaning preserved", title: "Report Integrity Score", copy: "A frozen weighted score for incident facts, negation, people, amounts, place, time, and risk." },
  { icon: Beaker, label: "Failure isolated", title: "Human-transcript oracle", copy: "The same extractor sees the human transcript, separating recognition mistakes from extraction mistakes." },
];

export default function BenchmarkPage() {
  const complete = artifact.status === "complete";
  return (
    <>
      <section className="benchmark-hero">
        <div className="site-shell benchmark-hero-grid">
          <div>
            <p className="section-kicker light">Benchmark lab</p>
            <h1>Accuracy that follows the facts.</h1>
            <p>We test whether a voice system preserves the details a real incident report depends on—not only whether the words look similar.</p>
            <div className="benchmark-actions">
              <Link href="/benchmark/methodology" className="button button-primary">Read methodology <ArrowRight size={16} /></Link>
              <a href="https://huggingface.co/datasets/intronhealth/AfriSwitch" target="_blank" rel="noreferrer" className="light-link">View AfriSwitch source</a>
            </div>
          </div>
          <div className="protocol-ticket">
            <div className="ticket-top"><FileLock2 size={20} /><span>Protocol lock</span></div>
            <strong>v1.0</strong>
            <dl>
              <div><dt>State</dt><dd>Frozen before inference</dd></div>
              <div><dt>Tag</dt><dd>benchmark-protocol-v1.0</dd></div>
              <div><dt>Expected corpus</dt><dd>60 clips</dd></div>
            </dl>
          </div>
        </div>
      </section>

      <section className="benchmark-body">
        <div className="site-shell">
          <div className={`run-status ${complete ? "complete" : "pending"}`}>
            <div>
              <span className="status-pill demo"><span className="status-dot" /> {complete ? "Results published" : "Inference not run"}</span>
              <h2>{complete ? "Generated results" : "No benchmark numbers yet—and none are invented."}</h2>
              <p>{complete ? "These values were loaded from the generated aggregate artifact." : "The interface is connected to the result artifact, currently marked not_run. Values appear only after all validation gates pass."}</p>
            </div>
            <div className="run-count"><strong>{artifact.corpus.completedClips}</strong><span>of {artifact.corpus.expectedClips} clips completed</span></div>
          </div>

          <div className="benchmark-section-heading">
            <div><p className="section-kicker">Three complementary views</p><h2>What the evaluation measures</h2></div>
            <p>The headline result is never a single WER number.</p>
          </div>
          <div className="metric-card-grid">
            {metricCards.map((metric) => {
              const Icon = metric.icon;
              return <article className="metric-card" key={metric.title}><Icon size={21} /><span>{metric.label}</span><h3>{metric.title}</h3><p>{metric.copy}</p></article>;
            })}
          </div>

          <section className="comparison-section" aria-labelledby="comparison-title">
            <div className="comparison-heading">
              <div><p className="section-kicker">Same audio. Same rules.</p><h2 id="comparison-title">Model comparison</h2></div>
              <div className="artifact-label"><Database size={16} /> Loaded from <code>benchmark-results.json</code></div>
            </div>
            <div className="table-wrap">
              <table className="comparison-table">
                <thead><tr><th>ASR system</th><th>Normalized WER</th><th>Switch-window WER</th><th>Critical entity F1</th><th>Report integrity</th></tr></thead>
                <tbody>
                  {artifact.providers.map((provider) => (
                    <tr key={provider.id}>
                      <th scope="row">{provider.label}</th>
                      <td colSpan={4}><span className="awaiting">Awaiting validated run</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="corpus-section">
            <div className="corpus-intro"><p className="section-kicker">Corpus design</p><h2>60 clips, two kinds of evidence</h2><p>A representative official subset tests language switching. Carefully acted incident clips test the fields the product must preserve.</p></div>
            <div className="corpus-bars">
              <div className="corpus-row"><div><strong>36</strong><span>AfriSwitch utterances</span></div><div className="bar-track"><span style={{ width: "60%" }} /></div><small>18 Pidgin–English · 18 Yorùbá–English</small></div>
              <div className="corpus-row custom"><div><strong>24</strong><span>Acted incident clips</span></div><div className="bar-track"><span style={{ width: "40%" }} /></div><small>8 clips in each supported scenario</small></div>
            </div>
          </section>
        </div>
      </section>
    </>
  );
}
