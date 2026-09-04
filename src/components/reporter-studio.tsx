"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  BookOpenText,
  Check,
  FileAudio,
  FileCheck2,
  Languages,
  LockKeyhole,
  Mic,
  Paperclip,
  RotateCcw,
  Square,
  Trash2,
} from "lucide-react";
import { createDemoCase } from "@/lib/demo-data";
import { nextClarification } from "@/lib/incident";
import { clearExpiredCases, saveCase } from "@/lib/storage";
import { ACCEPTED_AUDIO_TYPES, LANGUAGE_OPTIONS, MAX_AUDIO_BYTES, MAX_AUDIO_SECONDS } from "@/lib/constants";
import type { ApiErrorBody, IroyinCase, LanguagePair } from "@/lib/types";

type StudioView = "capture" | "processing" | "transcript" | "result" | "clarify";
type TranscriptProvider = "sahara" | "manual";
type TransformMode = "explain" | "express";
type TranscriptionResult = { state: "complete" | "processing" | "failed"; fileId: string | null; transcript: string | null };
type ReadyTranscript = { text: string; provider: TranscriptProvider; fileId: string | null };
type TransformResult = { mode: TransformMode; result: string; engine: string };

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function errorMessage(payload: unknown, fallback: string) {
  return (payload as ApiErrorBody | null)?.error?.message ?? fallback;
}

async function audioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Number.isFinite(audio.duration) ? audio.duration : null); };
    audio.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    audio.src = url;
  });
}

export function ReporterStudio() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [view, setView] = useState<StudioView>("capture");
  const [languagePair, setLanguagePair] = useState<LanguagePair>("pcm_en");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [processingLabel, setProcessingLabel] = useState("Sending your recording to Sahara…");
  const [readyTranscript, setReadyTranscript] = useState<ReadyTranscript | null>(null);
  const [transformResult, setTransformResult] = useState<TransformResult | null>(null);
  const [caseFile, setCaseFile] = useState<IroyinCase | null>(null);
  const [answer, setAnswer] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualTranscript, setManualTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void clearExpiredCases();
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    setIsRecording(false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const startRecording = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser cannot record audio here. Upload an audio file instead."); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined);
      chunksRef.current = []; streamRef.current = stream; recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const extension = mimeType.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioFile(new File([blob], `iroyin-recording-${Date.now()}.${extension}`, { type: mimeType }));
      };
      recorder.start(500); setRecordingSeconds(0); setIsRecording(true);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((current) => {
        if (current + 1 >= MAX_AUDIO_SECONDS) { queueMicrotask(stopRecording); return MAX_AUDIO_SECONDS; }
        return current + 1;
      }), 1000);
    } catch { setError("Microphone access was not available. Allow access or upload an existing recording."); }
  };

  const chooseFile = async (file: File | null) => {
    setError(null); if (!file) return;
    if (file.size > MAX_AUDIO_BYTES) { setError("That file is larger than 25 MB. Choose a shorter or smaller recording."); return; }
    if (file.type && !ACCEPTED_AUDIO_TYPES.includes(file.type)) { setError("Use WAV, MP3, MP4, M4A, OGG, WebM, or FLAC audio."); return; }
    const duration = await audioDuration(file);
    if (duration && duration > MAX_AUDIO_SECONDS + 0.5) { setError("Recordings must be two minutes or shorter."); return; }
    setAudioFile(file);
  };

  const finishCase = async (created: IroyinCase) => {
    await saveCase(created);
    if (created.missingCriticalFields.length) { setCaseFile(created); setView("clarify"); setProcessingLabel(""); return; }
    router.push(`/report/${encodeURIComponent(created.caseId)}/review`);
  };

  const structureTranscript = async (transcript: ReadyTranscript) => {
    setView("processing"); setProcessingLabel("Finding reportable facts and checking the gaps…"); setError(null);
    try {
      const response = await fetch("/api/incidents/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript: transcript.text, languagePair, transcriptProvider: transcript.provider, transcriptFileId: transcript.fileId ?? undefined }) });
      const payload = (await response.json()) as { caseFile?: IroyinCase } & ApiErrorBody;
      if (!response.ok || !payload.caseFile) throw new Error(errorMessage(payload, "The transcript could not be structured."));
      await finishCase(payload.caseFile);
    } catch (caught) { setView("transcript"); setError(caught instanceof Error ? caught.message : "The transcript could not be structured."); }
  };

  const transformTranscript = async (mode: TransformMode) => {
    if (!readyTranscript) return;
    setError(null); setView("processing"); setProcessingLabel(mode === "explain" ? "Making the meaning easier to follow…" : "Turning your thought into clear standard English…");
    try {
      const response = await fetch("/api/transform", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: readyTranscript.text, mode, languagePair }) });
      const payload = (await response.json()) as Partial<TransformResult> & ApiErrorBody;
      if (!response.ok || !payload.result || !payload.mode || !payload.engine) throw new Error(errorMessage(payload, "Ìròyìn could not transform that text."));
      setTransformResult(payload as TransformResult); setView("result"); setProcessingLabel("");
    } catch (caught) { setView("transcript"); setError(caught instanceof Error ? caught.message : "Ìròyìn could not transform that text."); }
  };

  const pollTranscription = async (fileId: string): Promise<TranscriptionResult> => {
    for (let attempt = 0; attempt < 45; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      const response = await fetch(`/api/transcriptions/status?fileId=${encodeURIComponent(fileId)}`, { cache: "no-store" });
      const payload = (await response.json()) as TranscriptionResult & ApiErrorBody;
      if (!response.ok && response.status !== 202) throw new Error(errorMessage(payload, "Could not check the transcript status."));
      if (payload.state !== "processing") return payload;
      setProcessingLabel(`Sahara is still listening… ${attempt + 1}`);
    }
    throw new Error("Sahara is taking longer than expected. Please try again in a moment.");
  };

  const submitAudio = async () => {
    if (!audioFile) return;
    setError(null); setView("processing"); setProcessingLabel("Sending your recording to Sahara…");
    try {
      const form = new FormData(); form.append("audio", audioFile); form.append("languagePair", languagePair);
      const response = await fetch("/api/transcriptions", { method: "POST", body: form });
      let payload = (await response.json()) as TranscriptionResult & Partial<ApiErrorBody>;
      if (!response.ok && response.status !== 202) throw new Error(errorMessage(payload, "Sahara could not process this recording."));
      if (payload.state === "processing") { if (!payload.fileId) throw new Error("Sahara queued the recording without a file reference."); payload = await pollTranscription(payload.fileId); }
      if (payload.state !== "complete" || !payload.transcript) throw new Error("Sahara did not return a usable transcript.");
      setReadyTranscript({ text: payload.transcript, provider: "sahara", fileId: payload.fileId }); setView("transcript"); setProcessingLabel("");
    } catch (caught) { setView("capture"); setError(caught instanceof Error ? caught.message : "Something went wrong while processing the recording."); }
  };

  const submitManualTranscript = () => {
    if (manualTranscript.trim().length < 3) { setError("Enter a short transcript before continuing."); return; }
    setError(null); setReadyTranscript({ text: manualTranscript.trim(), provider: "manual", fileId: null }); setView("transcript");
  };

  const resetCapture = () => { setReadyTranscript(null); setTransformResult(null); setCaseFile(null); setAudioFile(null); setError(null); setView("capture"); };

  const loadDemo = async () => { setError(null); const demo = createDemoCase(); await saveCase(demo); setCaseFile(demo); setView("clarify"); };

  const submitClarification = async () => {
    if (!caseFile || !answer.trim()) return;
    const clarification = nextClarification(caseFile);
    if (!clarification) { router.push(`/report/${encodeURIComponent(caseFile.caseId)}/review`); return; }
    setError(null);
    try {
      const response = await fetch("/api/incidents/clarify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseFile, field: clarification.field, question: clarification.question, answer }) });
      const payload = (await response.json()) as { caseFile?: IroyinCase } & ApiErrorBody;
      if (!response.ok || !payload.caseFile) throw new Error(errorMessage(payload, "That detail could not be saved."));
      await saveCase(payload.caseFile); setAnswer(""); setCaseFile(payload.caseFile);
      if (!nextClarification(payload.caseFile)) router.push(`/report/${encodeURIComponent(payload.caseFile.caseId)}/review`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "That detail could not be saved."); }
  };

  const clarification = caseFile ? nextClarification(caseFile) : null;
  const activeStep = view === "capture" ? 1 : view === "processing" ? 2 : view === "transcript" ? 3 : 4;

  return (
    <section className="studio" aria-label="Understand code-switched speech" aria-live="polite">
      <div className="studio-header">
        <div><p className="studio-title">Ìròyìn Voice</p><span className="studio-subtitle">Powered by Sahara speech recognition</span></div>
        <span className={`status-pill ${caseFile?.transcriptProvider === "demo" ? "demo" : ""}`}><span className="status-dot" /> {caseFile?.transcriptProvider === "demo" ? "Demo" : "Live"}</span>
      </div>
      <div className="studio-body">
        <div className="studio-progress" aria-label={`Step ${activeStep} of 4`}>{[1, 2, 3, 4].map((step) => <span key={step} className={`progress-step ${step <= activeStep ? "active" : ""}`} />)}</div>

        {view === "processing" && <div className="processing"><div><div className="processing-ring" aria-hidden="true" /><h2>Working with your words</h2><p>{processingLabel}</p></div></div>}

        {view === "capture" && <>
          <p className="section-kicker">Start with your voice</p>
          <h2>No need to translate yourself first.</h2>
          <p className="studio-intro">Speak naturally in the language mix that comes to you. You decide what Ìròyìn does after Sahara transcribes it.</p>
          <label className="field-label" htmlFor="language-pair">Speech mix</label>
          <select id="language-pair" className="select" value={languagePair} onChange={(event) => setLanguagePair(event.target.value as LanguagePair)}>{LANGUAGE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select>
          <div className="capture-area">
            <button className={`mic-button ${isRecording ? "recording" : ""}`} onClick={isRecording ? stopRecording : startRecording} type="button" aria-label={isRecording ? "Stop recording" : "Start recording"}>{isRecording ? <Square size={23} fill="currentColor" /> : <Mic size={27} />}</button>
            <p className="capture-title">{isRecording ? `Recording · ${recordingSeconds}s` : "Tap to speak"}</p>
            <p className="capture-help">Up to 2 minutes</p>
          </div>
          <div className="or-divider">or</div>
          <input ref={fileInputRef} className="sr-only" type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm,.flac" onChange={(event) => void chooseFile(event.target.files?.[0] ?? null)} />
          {audioFile ? <div className="file-row"><div className="file-meta"><FileAudio size={21} /><div><strong>{audioFile.name}</strong><span>{formatBytes(audioFile.size)}</span></div></div><button className="button button-quiet" type="button" onClick={() => setAudioFile(null)}><Trash2 size={16} /> Remove</button></div> : <button className="button button-secondary button-full" type="button" onClick={() => fileInputRef.current?.click()}><Paperclip size={17} /> Upload audio</button>}
          {error && <div className="notice error" role="alert"><AlertCircle size={17} /> <span>{error}</span></div>}
          <div className="studio-actions"><button className="button button-primary button-full" type="button" disabled={!audioFile || isRecording} onClick={() => void submitAudio()}>Transcribe with Sahara <ArrowRight size={17} /></button><button className="demo-trigger" type="button" onClick={() => setManualOpen((open) => !open)}>{manualOpen ? "Close text input" : "Use text instead"}</button><button className="demo-trigger" type="button" onClick={() => void loadDemo()}>Open verified-report demo</button></div>
          {manualOpen && <div className="clarification-card"><label className="field-label" htmlFor="manual-transcript">Text or transcript</label><textarea id="manual-transcript" className="text-area" value={manualTranscript} onChange={(event) => setManualTranscript(event.target.value)} placeholder="Paste something you want to understand or express…" /><button className="button button-dark button-full" type="button" onClick={submitManualTranscript}>Continue <ArrowRight size={17} /></button></div>}
          <p className="privacy-note"><LockKeyhole size={15} /> Audio is sent only when you continue. Report cases stay in this browser and expire after 24 hours.</p>
        </>}

        {view === "transcript" && readyTranscript && <>
          <p className="section-kicker">Sahara transcript</p>
          <h2>First, keep the original meaning visible.</h2>
          <p className="studio-intro">Read what Sahara heard. Then choose the job you actually need.</p>
          <blockquote className="transcript-preview">{readyTranscript.text}</blockquote>
          <p className="micro-copy">Source · {readyTranscript.provider === "sahara" ? "Sahara by Intron" : "Text input"}</p>
          <div className="task-grid">
            <button className="task-card" type="button" onClick={() => void transformTranscript("explain")}><BookOpenText size={20} /><span><strong>Explain</strong><small>Make the meaning easier to understand</small></span><ArrowRight size={17} /></button>
            <button className="task-card" type="button" onClick={() => void transformTranscript("express")}><Languages size={20} /><span><strong>Express</strong><small>Say the same thought in clear standard English</small></span><ArrowRight size={17} /></button>
            <button className="task-card report-task" type="button" onClick={() => void structureTranscript(readyTranscript)}><FileCheck2 size={20} /><span><strong>Report</strong><small>Build a verified record for a higher-stakes event</small></span><ArrowRight size={17} /></button>
          </div>
          {error && <div className="notice error" role="alert"><AlertCircle size={17} /> <span>{error}</span></div>}
          <button className="demo-trigger restart-link" type="button" onClick={resetCapture}><RotateCcw size={15} /> Start again</button>
        </>}

        {view === "result" && readyTranscript && transformResult && <>
          <div className="result-heading"><span className="result-icon"><Check size={18} /></span><div><p className="section-kicker">{transformResult.mode === "explain" ? "Explained" : "Expressed clearly"}</p><h2>{transformResult.mode === "explain" ? "Here’s the meaning." : "Same thought. Clearer form."}</h2></div></div>
          <div className="result-card"><p>{transformResult.result}</p></div>
          <div className="source-strip"><span>Original</span><p>{readyTranscript.text}</p></div>
          <p className="prototype-note">Prototype transformation · no paid LLM call. The benchmark remains focused on speech and downstream meaning preservation.</p>
          <div className="result-actions"><button className="button button-secondary" type="button" onClick={() => setView("transcript")}>Choose another action</button><button className="button button-primary" type="button" onClick={resetCapture}>Start over</button></div>
        </>}

        {view === "clarify" && caseFile && clarification && <>
          <p className="section-kicker">Verified report</p><h2>One fact needs you.</h2><p className="studio-intro">This is the report path. Ìròyìn will not invent a critical detail.</p><blockquote className="transcript-preview">{caseFile.transcript}</blockquote>
          <div className="clarification-card"><span className="question-label">Missing critical information</span><h3>{clarification.question}</h3><label className="field-label" htmlFor="clarification-answer">Your answer</label><input id="clarification-answer" className="text-input" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Add only the missing detail" autoFocus /><p className="micro-copy">Question {caseFile.clarifications.length + 1} of at most 3</p>{error && <div className="notice error" role="alert"><AlertCircle size={17} /> <span>{error}</span></div>}<button className="button button-primary button-full" type="button" disabled={!answer.trim()} onClick={() => void submitClarification()}>Save detail & continue <ArrowRight size={17} /></button></div>
        </>}
      </div>
    </section>
  );
}
