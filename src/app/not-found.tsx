import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return <div className="workspace-state"><FileQuestion size={34} /><h1>That page is not here</h1><p>The link may be incomplete or the local case may have expired.</p><Link className="button button-primary" href="/">Return home</Link></div>;
}
