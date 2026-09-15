import { ArrowUpRight, BookOpenText, FileCheck2, Languages } from "lucide-react";
import Link from "next/link";
import { ReporterStudio } from "@/components/reporter-studio";

const outcomes = [
  { icon: FileCheck2, title: "Report it", copy: "An incident record you can review, verify and export." },
  { icon: BookOpenText, title: "Understand it", copy: "Difficult ideas, explained in your everyday language." },
  { icon: Languages, title: "Express it", copy: "Your thoughts, in clear, academic or professional English." },
];

export default function Home() {
  return (
    <div className="site-shell workspace-layout">
      <aside className="workspace-intro" aria-labelledby="workspace-title">
        <p className="section-kicker">Made for the way you speak</p>
        <h1 id="workspace-title">Speak naturally.<br /><span>Leave a record you trust.</span></h1>
        <p className="workspace-description">Turn Pidgin-, Yorùbá-, or preview Igbo-English speech into a checked transcript, a clearer explanation, or a verified incident report.</p>
        <div className="outcome-list" aria-label="What you can do after speaking">
          {outcomes.map(({ icon: Icon, title, copy }) => (
            <div className="outcome-item" key={title}>
              <Icon size={19} aria-hidden="true" />
              <div><h2>{title}</h2><p>{copy}</p></div>
            </div>
          ))}
        </div>
        <div className="workspace-footnote">
          <span>Built with Sahara by Intron</span>
          <Link href="/benchmark">Explore the benchmark <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </div>
      </aside>
      <div id="try-sahara" className="studio-anchor"><ReporterStudio /></div>
    </div>
  );
}
