"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <div className="workspace-state"><AlertCircle size={34} /><h1>Something interrupted this page</h1><p>Your locally saved report has not been submitted. Try loading this view again.</p><button className="button button-primary" onClick={retry}><RefreshCw size={16} /> Try again</button></div>;
}
