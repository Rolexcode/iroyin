"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clipboard,
  Download,
  ExternalLink,
  FileText,
  PencilLine,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { applyFactCorrection, formatPlainTextReport, verifyCase } from "@/lib/incident";
import { loadCase, saveCase } from "@/lib/storage";
import { SCENARIOS } from "@/lib/constants";
import type { ApiErrorBody, IroyinCase, VerifiedResource } from "@/lib/types";

function getError(payload: unknown, fallback: string) {
  return (payload as ApiErrorBody | null)?.error?.message ?? fallback;
}

export function ReviewWorkspace({ caseId }: { caseId: string }) {
  const [caseFile, setCaseFile] = useState<IroyinCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [resources, setResources] = useState<VerifiedResource[]>([]);
  const [editingTranscript, setEditingTranscript] = useState(false);
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    void loadCase(caseId).then((stored) => {
      if (!active) return;
      setCaseFile(stored);
      setTranscriptDraft(stored?.transcript ?? "");
      setLoading(false);
    });
    return () => { active = false; };
  }, [caseId]);

  useEffect(() => {
    if (!caseFile || caseFile.verification.status !== "verified") return;
    void fetch(`/api/resources?scenario=${caseFile.scenario}`)
      .then(async (response) => {
        const payload = (await response.json()) as { resources?: VerifiedResource[] } & ApiErrorBody;
        if (!response.ok) throw new Error(getError(payload, "Could not load official channels."));
        setResources(payload.resources ?? []);
      })
      .catch(() => setMessage({ kind: "error", text: "The report is verified, but official channels could not be loaded." }));
  }, [caseFile]);

  const persist = async (updated: IroyinCase) => {
    setCaseFile(updated);
    await saveCase(updated);
  };

  const correctFact = async (factId: string, value: string) => {
    if (!caseFile) return;
    const fact = caseFile.facts.find((item) => item.id === factId);
    if ((fact?.value ?? "") === value.trim()) return;
    await persist(applyFactCorrection(caseFile, factId, value));
    setConfirmed(false);
    setMessage({ kind: "success", text: "Correction saved locally. Please review before confirming." });
  };

  const reExtractTranscript = async () => {
    if (!caseFile || transcriptDraft.trim().length < 3) return;
    setBusy("transcript");
    setMessage(null);
    try {
      const response = await fetch("/api/incidents/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcriptDraft.trim(),
          languagePair: caseFile.languagePair,
          transcriptProvider: "manual",
          transcriptFileId: caseFile.transcriptFileId,
        }),
      });
      const payload = (await response.json()) as { caseFile?: IroyinCase } & ApiErrorBody;
      if (!response.ok || !payload.caseFile) throw new Error(getError(payload, "Could not re-structure the corrected transcript."));
      const updated: IroyinCase = {
        ...payload.caseFile,
        caseId: caseFile.caseId,
        createdAt: caseFile.createdAt,
        expiresAt: caseFile.expiresAt,
        updatedAt: new Date().toISOString(),
      };
      await persist(updated);
      setEditingTranscript(false);
      setConfirmed(false);
      setMessage({ kind: "success", text: "Transcript correction saved and facts re-structured." });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Could not re-structure the transcript." });
    } finally {
      setBusy(null);
    }
  };

  const confirmReport = async () => {
    if (!caseFile || caseFile.missingCriticalFields.length) return;
    setBusy("verify");
    try {
      const verified = verifyCase(caseFile);
      await persist(verified);
      setMessage({ kind: "success", text: "Report verified. Export and official next-step channels are now available." });
    } finally {
      setBusy(null);
    }
  };

  const copyReport = async () => {
    if (!caseFile) return;
    await navigator.clipboard.writeText(formatPlainTextReport(caseFile));
    setMessage({ kind: "success", text: "Report copied to your clipboard." });
  };

  const exportPdf = async () => {
    if (!caseFile) return;
    setBusy("pdf");
    setMessage(null);
    try {
      const response = await fetch("/api/reports/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseFile }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as ApiErrorBody;
        throw new Error(getError(payload, "Could not export this report."));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${caseFile.caseId}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage({ kind: "success", text: "PDF prepared. Check your downloads." });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Could not export this report." });
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="workspace-state"><div className="processing-ring" /><p>Opening your local report…</p></div>;
  }

  if (!caseFile) {
    return (
      <div className="workspace-state">
        <FileText size={34} />
        <h1>This report is not in this browser</h1>
        <p>It may have expired after 24 hours, or the link was opened on a different device.</p>
        <Link className="button button-primary" href="/#report">Start a new report</Link>
      </div>
    );
  }

  const verified = caseFile.verification.status === "verified";

  return (
    <div className="site-shell review-shell">
      <div className="review-topbar">
        <Link href="/#report" className="back-link"><ArrowLeft size={16} /> New report</Link>
        <div className="case-reference"><span>Case reference</span><strong>{caseFile.caseId}</strong></div>
      </div>

      <div className="review-heading">
        <div>
          <p className="section-kicker">Review before you act</p>
          <h1>Your incident, structured.</h1>
          <p>Correct anything that is wrong. A changed fact is clearly marked and must be confirmed again.</p>
        </div>
        <span className={`status-pill ${verified ? "" : "demo"}`}><span className="status-dot" /> {verified ? "Reporter verified" : "Needs verification"}</span>
      </div>

      {message && <div className={`notice ${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>{message.kind === "error" ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}<span>{message.text}</span></div>}

      <div className="review-grid">
        <div className="review-main">
          <section className="review-panel summary-panel">
            <div className="panel-title-row">
              <div><span className="panel-number">01</span><h2>Report summary</h2></div>
              <span className="category-label">{SCENARIOS[caseFile.scenario].label}</span>
            </div>
            <p className="report-summary">{caseFile.summary}</p>
          </section>

          <section className="review-panel">
            <div className="panel-title-row">
              <div><span className="panel-number">02</span><h2>Reported facts</h2></div>
              <span className="panel-helper">Edit in place</span>
            </div>
            <div className="fact-list">
              {caseFile.facts.map((fact) => (
                <div className={`fact-row ${!fact.value && fact.critical ? "missing" : ""}`} key={fact.id}>
                  <div className="fact-label-line">
                    <label htmlFor={fact.id}>{fact.label}{fact.critical && <span aria-label="Critical field"> *</span>}</label>
                    <span className={`fact-state ${fact.status}`}>{fact.status}</span>
                  </div>
                  <input
                    id={fact.id}
                    className="fact-input"
                    defaultValue={fact.value ?? ""}
                    placeholder={fact.critical ? "Required before verification" : "Not provided"}
                    onBlur={(event) => void correctFact(fact.id, event.target.value)}
                  />
                  {fact.evidence ? <p className="evidence-line"><span>Source</span> “{fact.evidence.quote}”</p> : <p className="evidence-line user-supplied"><span>Source</span> {fact.status === "clarified" ? "Reporter clarification" : fact.status === "corrected" ? "Reporter correction" : "Not present in transcript"}</p>}
                </div>
              ))}
            </div>
          </section>

          <section className="review-panel transcript-panel">
            <div className="panel-title-row">
              <div><span className="panel-number">03</span><h2>Original transcript</h2></div>
              <button className="inline-action" type="button" onClick={() => setEditingTranscript((value) => !value)}><PencilLine size={15} /> {editingTranscript ? "Cancel edit" : "Correct transcript"}</button>
            </div>
            {editingTranscript ? (
              <>
                <textarea className="text-area transcript-editor" value={transcriptDraft} onChange={(event) => setTranscriptDraft(event.target.value)} />
                <p className="field-help">Saving re-runs extraction so every evidence span matches the corrected words.</p>
                <button className="button button-dark" type="button" disabled={busy === "transcript" || transcriptDraft.trim() === caseFile.transcript} onClick={() => void reExtractTranscript()}>
                  {busy === "transcript" ? <RefreshCw className="spin-icon" size={16} /> : <Check size={16} />} Save & re-structure
                </button>
              </>
            ) : <blockquote>“{caseFile.transcript}”</blockquote>}
            <p className="provider-note">Transcript source: {caseFile.transcriptProvider === "sahara" ? "Sahara by Intron" : caseFile.transcriptProvider === "demo" ? "Guided demo fixture" : "Manually supplied transcript"} · Extraction: {caseFile.extractionMode === "openai" ? "pinned structured model" : caseFile.extractionMode === "local_rules" ? "deterministic local fallback" : "demo fixture"}</p>
          </section>
        </div>

        <aside className="review-aside">
          <section className={`verification-panel ${verified ? "verified" : ""}`}>
            <ShieldCheck size={26} />
            <h2>{verified ? "Report verified" : "Confirm this record"}</h2>
            {caseFile.missingCriticalFields.length > 0 ? (
              <div className="missing-warning"><AlertCircle size={17} /><span>{caseFile.missingCriticalFields.length} critical {caseFile.missingCriticalFields.length === 1 ? "detail is" : "details are"} still missing. Add {caseFile.missingCriticalFields.map((field) => field.replaceAll("_", " ")).join(", ")}.</span></div>
            ) : verified ? (
              <p>Confirmed by the reporter on {new Date(caseFile.verification.verifiedAt ?? "").toLocaleString("en-NG")}.</p>
            ) : (
              <label className="confirmation-check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I confirm this report is accurate to the best of my knowledge.</span></label>
            )}
            {!verified && <button className="button button-primary button-full" type="button" disabled={!confirmed || caseFile.missingCriticalFields.length > 0 || busy === "verify"} onClick={() => void confirmReport()}>{busy === "verify" ? "Confirming…" : "Verify report"} <Check size={16} /></button>}
            {verified && (
              <div className="export-actions">
                <button className="button button-dark button-full" type="button" disabled={busy === "pdf"} onClick={() => void exportPdf()}><Download size={16} /> {busy === "pdf" ? "Preparing PDF…" : "Download PDF"}</button>
                <button className="button button-secondary button-full" type="button" onClick={() => void copyReport()}><Clipboard size={16} /> Copy text</button>
              </div>
            )}
            <p className="aside-fineprint">Verification unlocks export. It does not submit this report.</p>
          </section>

          <section className="routing-panel">
            <span className="panel-number">04</span>
            <h2>Official next steps</h2>
            {!verified ? (
              <p>Verify the report to see up to three official channels matched to this incident category.</p>
            ) : resources.length ? (
              <div className="resource-list">
                {resources.map((resource) => (
                  <article className="resource-item" key={resource.id}>
                    <p className="resource-org">{resource.organization}</p>
                    <h3>{resource.name}</h3>
                    <p>{resource.description}</p>
                    <a href={resource.channelUrl} target={resource.channelUrl.startsWith("http") ? "_blank" : undefined} rel="noreferrer">{resource.channelLabel} <ExternalLink size={14} /></a>
                    <span>Verified {resource.verifiedOn} · {resource.coverage}</span>
                  </article>
                ))}
              </div>
            ) : <p>Loading verified channels…</p>}
            <div className="no-submit-note"><AlertCircle size={16} /> Ìròyìn never sends your report to an agency. You choose the channel and submit it yourself.</div>
          </section>
        </aside>
      </div>
    </div>
  );
}
