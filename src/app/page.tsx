import { ArrowDown, CheckCircle2, FileCheck2, Languages, Mic2 } from "lucide-react";
import { ReporterStudio } from "@/components/reporter-studio";

const steps = [
  { number: "01", icon: Mic2, title: "Speak naturally", copy: "Start in Pidgin + English or Yorùbá + English. Sahara handles the code-switched speech before Ìròyìn does anything with the meaning." },
  { number: "02", icon: Languages, title: "Choose the job", copy: "Explain something difficult, express your thought in clear standard English, or move into a higher-stakes reporting workflow." },
  { number: "03", icon: FileCheck2, title: "Keep meaning accountable", copy: "The original transcript stays visible. When facts matter, Ìròyìn asks instead of silently filling a gap." },
];

export default function Home() {
  return <>
    <section className="hero-section">
      <div className="site-shell hero-grid">
        <div className="hero-copy">
          <div className="eyebrow"><span /> Built for code-switched speech</div>
          <h1>Your words.<br /><em>Still your meaning.</em></h1>
          <p className="hero-lede">Ìròyìn helps people move between natural mixed-language speech and information they can actually use — without forcing them to translate themselves first.</p>
          <div className="hero-actions"><a className="button button-primary" href="#try-sahara">Try Ìròyìn <ArrowDown size={17} /></a><a className="text-link" href="/benchmark">View the benchmark</a></div>
          <ul className="assurance-list" aria-label="Product principles"><li><CheckCircle2 size={16} /> Pidgin + English</li><li><CheckCircle2 size={16} /> Yorùbá + English</li><li><CheckCircle2 size={16} /> Sahara-powered speech</li></ul>
        </div>
        <div id="try-sahara" className="studio-anchor"><ReporterStudio /></div>
      </div>
    </section>

    <section className="process-section" aria-labelledby="process-heading">
      <div className="site-shell">
        <div className="section-heading-row"><div><p className="section-kicker">One voice. Three useful outcomes.</p><h2 id="process-heading">Speech recognition is only the first step.</h2></div><p>Ìròyìn keeps the transcript visible, then lets the user decide what the words need to become.</p></div>
        <div className="process-grid">{steps.map((step) => { const Icon = step.icon; return <article className="process-step" key={step.number}><div className="step-top"><span>{step.number}</span><Icon size={22} /></div><h3>{step.title}</h3><p>{step.copy}</p></article>; })}</div>
      </div>
    </section>

    <section className="scope-section"><div className="site-shell scope-grid"><div><p className="section-kicker light">Beyond transcription</p><h2>Explain. Express. Report.</h2></div><div className="scope-copy"><p>Understand difficult information in a form that clicks. Turn a naturally spoken thought into clear standard English. And when the stakes are higher, preserve the source and verify the facts before creating a record.</p><a href="/benchmark/methodology">Read the benchmark methodology <span aria-hidden="true">→</span></a></div></div></section>
  </>;
}
