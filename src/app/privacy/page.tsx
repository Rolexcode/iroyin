import type { Metadata } from "next";
import { Clock3, EyeOff, Send, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy & safety",
  description: "How Ìròyìn handles recordings, local case data, provider calls, and user verification.",
};

const commitments = [
  { icon: EyeOff, title: "Facts stay grounded", copy: "An extracted fact must point to exact words in the transcript. Missing facts remain missing until you supply them." },
  { icon: Clock3, title: "Local, short-lived cases", copy: "The working case is stored in IndexedDB in this browser and expires after 24 hours. The prototype has no account database." },
  { icon: Send, title: "No automatic submission", copy: "Ìròyìn shows verified official channels, but it never sends a report, email, petition, or complaint on your behalf." },
  { icon: ShieldCheck, title: "Your confirmation is required", copy: "Export stays locked until critical fields are present and you explicitly confirm the report’s accuracy." },
];

export default function PrivacyPage() {
  return (
    <>
      <header className="page-hero compact"><div className="site-shell"><p className="section-kicker">Privacy & safety</p><h1>Your story is not a prompt for invention.</h1><p>Ìròyìn is designed around evidence, minimum necessary clarification, and reporter control.</p></div></header>
      <section className="content-section"><div className="site-shell privacy-layout">
        <div className="privacy-commitments">
          {commitments.map((item) => { const Icon = item.icon; return <article key={item.title}><Icon size={23} /><div><h2>{item.title}</h2><p>{item.copy}</p></div></article>; })}
        </div>
        <aside className="privacy-detail">
          <h2>What leaves your browser</h2>
          <p>When you choose to transcribe, the audio is sent to Sahara by Intron through the Ìròyìn server route. When live structured extraction is configured, the transcript is sent to the pinned OpenAI model through a separate server route. API keys remain server-side.</p>
          <h2>What this prototype does not do</h2>
          <ul><li>Create user accounts</li><li>Store cases in a server database</li><li>Provide legal advice</li><li>Infer missing people, places, dates, amounts, or risks</li><li>Submit to an authority automatically</li></ul>
          <p className="privacy-contact">Before using any linked agency, review its own privacy policy and submission requirements.</p>
        </aside>
      </div></section>
    </>
  );
}
