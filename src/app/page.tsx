import { ArrowDown, CheckCircle2, FileCheck2, Languages, Mic2 } from "lucide-react";
import { ReporterStudio } from "@/components/reporter-studio";

const steps = [
  {
    number: "01",
    icon: Mic2,
    title: "Speak how you speak",
    copy: "Use Pidgin + English or Yorùbá + English naturally. Sahara transcribes the code-switched speech without asking you to translate yourself first.",
  },
  {
    number: "02",
    icon: Languages,
    title: "Bridge the understanding gap",
    copy: "Ìròyìn is being built to explain difficult information naturally and help turn naturally expressed thoughts into clear standard English.",
  },
  {
    number: "03",
    icon: FileCheck2,
    title: "Verify when it matters",
    copy: "For higher-stakes tasks such as incident reporting, Ìròyìn preserves the source, asks for missing facts, and lets you confirm the final record.",
  },
];

export default function Home() {
  return (
    <>
      <section className="hero-section">
        <div className="site-shell hero-grid">
          <div className="hero-copy">
            <div className="eyebrow"><span /> Code-switching understanding layer</div>
            <h1>Speak how you speak.<br /><em>Understand anything.</em></h1>
            <p className="hero-lede">
              Ìròyìn is built for people who think, learn, and communicate across languages. Speak naturally in Pidgin + English or Yorùbá + English without translating yourself for the machine first.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#try-sahara">Try Sahara live <ArrowDown size={17} /></a>
              <a className="text-link" href="/benchmark">See how we measure meaning</a>
            </div>
            <ul className="assurance-list" aria-label="Product principles">
              <li><CheckCircle2 size={16} /> Natural code-switching first</li>
              <li><CheckCircle2 size={16} /> Meaning matters beyond word accuracy</li>
              <li><CheckCircle2 size={16} /> Verification for higher-stakes outputs</li>
            </ul>
          </div>
          <div id="try-sahara" className="studio-anchor">
            <ReporterStudio />
          </div>
        </div>
      </section>

      <section className="process-section" aria-labelledby="process-heading">
        <div className="site-shell">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Beyond translation</p>
              <h2 id="process-heading">From the language in your head to information you can use.</h2>
            </div>
            <p>Not just language A to language B. Ìròyìn is about preserving meaning across the way people actually speak and understand.</p>
          </div>
          <div className="process-grid">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <article className="process-step" key={step.number}>
                  <div className="step-top"><span>{step.number}</span><Icon size={22} /></div>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="scope-section">
        <div className="site-shell scope-grid">
          <div>
            <p className="section-kicker light">One language layer, different needs</p>
            <h2>Explain. Express. Report.</h2>
          </div>
          <div className="scope-copy">
            <p>
              Explain difficult information in the language mix that clicks. Express a naturally spoken thought in clear standard English. When the task is consequential, switch into a verified reporting flow that keeps the original words and asks before filling gaps.
            </p>
            <a href="/benchmark/methodology">Read the frozen benchmark method <span aria-hidden="true">→</span></a>
          </div>
        </div>
      </section>
    </>
  );
}
