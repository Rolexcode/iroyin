import { ArrowUpRight, BookOpenText, FileCheck2, Languages } from "lucide-react";
import Link from "next/link";
import { ReporterStudio } from "@/components/reporter-studio";

const outcomes = [
  { icon: BookOpenText, title: "Understand it", copy: "Difficult ideas, explained in your everyday language." },
  { icon: Languages, title: "Express it", copy: "Your thoughts, in clear, academic or professional English." },
  { icon: FileCheck2, title: "Report it", copy: "An incident record you can review, verify and export." },
];

export default function Home() {
  return (
    <div className="site-shell workspace-layout">
      <aside className="workspace-intro" aria-labelledby="workspace-title">
        <p className="section-kicker">Made for the way you speak</p>
        <h1 id="workspace-title">Your words.<br /><span>Still your meaning.</span></h1>
        <p className="workspace-description">Move from mixed-language speech to a clearer understanding. No need to translate yourself first.</p>
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
