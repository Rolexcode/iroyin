import { ArrowDown, CheckCircle2, FileCheck2, Mic2, Route } from "lucide-react";
import { ReporterStudio } from "@/components/reporter-studio";

const steps = [
  {
    number: "01",
    icon: Mic2,
    title: "Speak naturally",
    copy: "Record or upload in Pidgin + English or Yorùbá + English. Sahara keeps the code-switching intact.",
  },
  {
    number: "02",
    icon: FileCheck2,
    title: "Check the facts",
    copy: "Every extracted fact points back to your words. If something critical is missing, Ìròyìn asks only for that detail.",
  },
  {
    number: "03",
    icon: Route,
    title: "Take the next step",
    copy: "Confirm the report, export a clean copy, and choose from a small set of verified official channels.",
  },
];

export default function Home() {
  return (
    <>
      <section className="hero-section">
        <div className="site-shell hero-grid">
          <div className="hero-copy">
            <div className="eyebrow"><span /> Voice-first civic reporting</div>
            <h1>Say what happened.<br /><em>Keep every fact.</em></h1>
            <p className="hero-lede">
              Ìròyìn turns code-switched speech into a structured incident report you can inspect, correct, verify, and take to the right channel.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#report">Start a report <ArrowDown size={17} /></a>
              <a className="text-link" href="/benchmark">See how we measure accuracy</a>
            </div>
            <ul className="assurance-list" aria-label="Product assurances">
              <li><CheckCircle2 size={16} /> No facts invented</li>
              <li><CheckCircle2 size={16} /> Nothing submitted automatically</li>
              <li><CheckCircle2 size={16} /> Local case data expires in 24 hours</li>
            </ul>
          </div>
          <div id="report" className="studio-anchor">
            <ReporterStudio />
          </div>
        </div>
      </section>

      <section className="process-section" aria-labelledby="process-heading">
        <div className="site-shell">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">One focused workflow</p>
              <h2 id="process-heading">From voice note to usable record</h2>
            </div>
            <p>Interactive where accuracy needs it. Quiet everywhere else.</p>
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
            <p className="section-kicker light">Built for the first mile</p>
            <h2>A clear record before the bureaucracy begins.</h2>
          </div>
          <div className="scope-copy">
            <p>
              Ìròyìn currently supports tenancy and housing, public infrastructure hazards, and workplace or public-service complaints. That narrow scope keeps routing useful and verifiable.
            </p>
            <a href="/benchmark/methodology">Read the frozen product and benchmark method <span aria-hidden="true">→</span></a>
          </div>
        </div>
      </section>
    </>
  );
}
