"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  BookOpenText,
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
import {
  ACCEPTED_AUDIO_TYPES,
  LANGUAGE_OPTIONS,
  MAX_AUDIO_BYTES,
  MAX_AUDIO_SECONDS,
} from "@/lib/constants";
import type { ApiErrorBody, IroyinCase, LanguagePair } from "@/lib/types";

type StudioView = "capture" | "processing" | "transcript" | "clarify";
type TranscriptProvider = "sahara" | "manual";
type TranscriptionResult = {
  state: "complete" | "processing" | "failed";
  fileId: string | null;
  transcript: string | null;
};

type ReadyTranscript = {
  text: string;
  provider: TranscriptProvider;
  fileId: string | null;
};

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
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(audio.duration) ? audio.duration : null);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
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
      setError("This browser cannot record audio here. Upload an audio file instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined);
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const extension = mimeType.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioFile(new File([blob], `iroyin-recording-${Date.now()}.${extension}`, { type: mimeType }));
      };
      recorder.start(500);
      setRecordingSeconds(0);
      setIsRecording(true);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((current) => {
          if (current + 1 >= MAX_AUDIO_SECONDS) {
            queueMicrotask(stopRecording);
            return MAX_AUDIO_SECONDS;
          }
          return current + 1;
        });
      }, 1000);
    } catch {
      setError("Microphone access was not available. Allow access or upload an existing recording.");
    }
  };

  const chooseFile = async (file: File | null) => {
    setError(null);
    if (!file) return;
    if (file.size > MAX_AUDIO_BYTES) {
      setError("That file is larger than 25 MB. Choose a shorter or smaller recording.");
      return;
    }
    if (file.type && !ACCEPTED_AUDIO_TYPES.includes(file.type)) {
      setError("Use WAV, MP3, MP4, M4A, OGG, WebM, or FLAC audio.");
      return;
    }
    const duration = await audioDuration(file);
    if (duration && duration > MAX_AUDIO_SECONDS + 0.5) {
      setError("Recordings must be two minutes or shorter.");
      return;
    }
    setAudioFile(file);
  };

  const finishCase = async (created: IroyinCase) => {
    await saveCase(created);
    if (created.missingCriticalFields.length) {
      setCaseFile(created);
      setView("clarify");
      setProcessingLabel("");
      return;
    }
    router.push(`/report/${encodeURIComponent(created.caseId)}/review`);
  };

  const structureTranscript = async (transcript: ReadyTranscript) => {
    setView("processing");
    setProcessingLabel("Finding reportable facts and checking the gaps…");
    const response = await fetch("/api/incidents/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript: transcript.text,
        languagePair,
        transcriptProvider: transcript.provider,
        transcriptFileId: transcript.fileId ?? undefined,
      }),
    });
    const payload = (await response.json()) as { caseFile?: IroyinCase } & ApiErrorBody;
    if (!response.ok || !payload.caseFile) throw new Error(errorMessage(payload, "The transcript could not be structured."));
    await finishCase(payload.caseFile);
  };

  const pollTranscription = async (fileId: string): Promise<TranscriptionResult> => {
    for (let attempt = 0; attempt < 45; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      const response = await fetch(`/api/transcriptions/status?fileId=${encodeURIComponent(fileId)}`, { cache: "no-store" });
      const payload = (await response.json()) as TranscriptionResult & ApiErrorBody;
      if (!response.ok && response.status !== 202) throw new Error(errorMessage(payload, "Could not check the transcript status."));
      if (payload.state !== "processing") return payload;
      setProcessingLabel(`Sahara is still listening carefully… ${attempt + 1}`);
    }
    throw new Error("Sahara is taking longer than expected. Please try again in a moment.");
  };

  const submitAudio = async () => {
    if (!audioFile) return;
    setError(null);
    setView("processing");
    setProcessingLabel("Sending your recording to Sahara…");
    try {
      const form = new FormData();
      form.append("audio", audioFile);
      form.append("languagePair", languagePair);
      const response = await fetch("/api/transcriptions", { method: "POST", body: form });
      let payload = (await response.json()) as TranscriptionResult & Partial<ApiErrorBody>;
      if (!response.ok && response.status !== 202) throw new Error(errorMessage(payload, "Sahara could not process this recording."));
      if (payload.state === "processing") {
        if (!payload.fileId) throw new Error("Sahara queued the recording without a file reference.");
        payload = await pollTranscription(payload.fileId);
      }
      if (payload.state !== "complete" || !payload.transcript) throw new Error("Sahara did not return a usable transcript.");
      setReadyTranscript({ text: payload.transcript, provider: "sahara", fileId: payload.fileId });
      setView("transcript");
      setProcessingLabel("");
    } catch (caught) {
      setView("capture");
      setError(caught instanceof Error ? caught.message : "Something went wrong while processing the recording.");
    }
  };

  const submitManualTranscript = () => {
    if (manualTranscript.trim().length < 3) {
      setError("Enter a short transcript before continuing.");
      return;
    }
    setError(null);
    setReadyTranscript({ text: manualTranscript.trim(), provider: "manual", fileId: null });
    setView("transcript");
  };

  const resetCapture = () => {
    setReadyTranscript(null);
    setCaseFile(null);
    setAudioFile(null);
    setError(null);
    setView("capture");
  };

  const loadDemo = async () => {
    setError(null);
    const demo = createDemoCase();
    await saveCase(demo);
    setCaseFile(demo);
    setView("clarify");
  };

  const submitClarification = async () => {
    if (!caseFile || !answer.trim()) return;
    const clarification = nextClarification(caseFile);
    if (!clarification) {
      router.push(`/report/${encodeURIComponent(caseFile.caseId)}/review`);
      return;
    }
    setError(null);
    try {
      const response = await fetch("/api/incidents/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseFile, field: clarification.field, question: clarification.question, answer }),
      });
      const payload = (await response.json()) as { caseFile?: IroyinCase } & ApiErrorBody;
      if (!response.ok || !payload.caseFile) throw new Error(errorMessage(payload, "That detail could not be saved."));
      await saveCase(payload.caseFile);
      setAnswer("");
      setCaseFile(payload.caseFile);
      if (!nextClarification(payload.caseFile)) router.push(`/report/${encodeURIComponent(payload.caseFile.caseId)}/review`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That detail could not be saved.");
    }
  };

  const clarification = caseFile ? nextClarification(caseFile) : null;
  const activeStep = view === "capture" ? 1 : view === "processing" ? 2 : view === "transcript" ? 3 : 4;

  return (
    <section className="studio" aria-label="Understand code-switched speech" aria-live="polite">
      <div className="studio-header">
        <p className="studio-title">Speak to Ìròyìn</p>
        <span className={`status-pill ${caseFile?.transcriptProvider === "demo" ? "demo" : ""}`}>
          <span className="status-dot" /> {caseFile?.transcriptProvider === "demo" ? "Guided demo" : "Sahara ready"}
        </span>
      </div>
      <div className="studio-body">
        <div className="studio-progress" aria-label={`Step ${activeStep} of 4`}>
          {[1, 2, 3, 4].map((step) => <span key={step} className={`progress-step ${step <= activeStep ? "active" : ""}`} />)}
        </div>

        {view === "processing" && (
          <div className="processing">
            <div>
              <div className="processing-ring" aria-hidden="true" />
              <h2>{readyTranscript ? "Preparing your report" : "Listening to how you speak"}</h2>
              <p>{processingLabel}</p>
            </div>
          </div>
        )}

        {view === "capture" && (
          <>
            <h2>Speak how you speak</h2>
            <p className="studio-intro">Mix languages naturally. Ìròyìn will show you what Sahara heard before deciding what happens next.</p>
            <label className="field-label" htmlFor="language-pair">Language mix in this recording</label>
            <select id="language-pair" className="select" value={languagePair} onChange={(event) => setLanguagePair(event.target.value as LanguagePair)}>
              {LANGUAGE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>

            <div className="capture-area">
              <button
                className={`mic-button ${isRecording ? "recording" : ""}`}
                onClick={isRecording ? stopRecording : startRecording}
                type="button"
                aria-label={isRecording ? "Stop recording" : "Start recording"}
                title={isRecording ? "Stop recording" : "Start recording"}
              >
                {isRecording ? <Square size={24} fill="currentColor" /> : <Mic size={27} />}
              </button>
              <p className="capture-title">{isRecording ? `Recording · ${recordingSeconds}s` : "Tap to record"}</p>
              <p className="capture-help">Maximum 2 minutes. You control when it is sent.</p>
            </div>

            <div className="or-divider">or upload</div>
            <input
              ref={fileInputRef}
              className="sr-only"
              type="file"
              accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm,.flac"
              onChange={(event) => void chooseFile(event.target.files?.[0] ?? null)}
            />
            {audioFile ? (
              <div className="file-row">
                <div className="file-meta"><FileAudio size={21} /><div><strong>{audioFile.name}</strong><span>{formatBytes(audioFile.size)}</span></div></div>
                <button className="button button-quiet" type="button" onClick={() => setAudioFile(null)} title="Remove audio"><Trash2 size={16} /> Remove</button>
              </div>
            ) : (
              <button className="button button-secondary button-full" type="button" onClick={() => fileInputRef.current?.click()}>
                <Paperclip size={17} /> Choose an audio file
              </button>
            )}

            {error && <div className="notice error" role="alert"><AlertCircle size={17} /> <span>{error}</span></div>}
            <div className="studio-actions">
              <button className="button button-primary button-full" type="button" disabled={!audioFile || isRecording} onClick={() => void submitAudio()}>
                Transcribe with Sahara <ArrowRight size={17} />
              </button>
              <button className="demo-trigger" type="button" onClick={() => void loadDemo()}>Try the existing report demo</button>
              <button className="demo-trigger" type="button" onClick={() => setManualOpen((open) => !open)}>{manualOpen ? "Hide transcript option" : "Or paste text / a transcript"}</button>
            </div>
            {manualOpen && (
              <div className="clarification-card">
                <label className="field-label" htmlFor="manual-transcript">Text or transcript</label>
                <textarea id="manual-transcript" className="text-area" value={manualTranscript} onChange={(event) => setManualTranscript(event.target.value)} placeholder="Paste something you want Ìròyìn to work with…" />
                <button className="button button-dark button-full" type="button" onClick={submitManualTranscript}>Continue <ArrowRight size={17} /></button>
              </div>
            )}
            <p className="privacy-note"><LockKeyhole size={15} /> Audio is sent only when you continue. Report cases stay in this browser and expire after 24 hours.</p>
          </>
        )}

        {view === "transcript" && readyTranscript && (
          <>
            <p className="section-kicker">What I heard</p>
            <h2>Does this still mean what you meant?</h2>
            <p className="studio-intro">Check the raw transcript first. Ìròyìn will not silently turn it into a report.</p>
            <blockquote className="transcript-preview">“{readyTranscript.text}”</blockquote>
            <p className="micro-copy">Transcript source: {readyTranscript.provider === "sahara" ? "Sahara by Intron" : "Manually supplied text"}</p>

            <div className="clarification-card">
              <span className="question-label">What do you need?</span>
              <div className="studio-actions">
                <button className="button button-secondary button-full" type="button" disabled title="Explain is the next transformation being wired in">
                  <BookOpenText size={17} /> Explain this
                </button>
                <button className="button button-secondary button-full" type="button" disabled title="Express is the next transformation being wired in">
                  <Languages size={17} /> Express this clearly
                </button>
                <button className="button button-primary button-full" type="button" onClick={() => void structureTranscript(readyTranscript)}>
                  <FileCheck2 size={17} /> Make a verified report
                </button>
              </div>
              <p className="micro-copy">Explain and Express are shown as the next product paths; only Report enters the incident clarification workflow in this build.</p>
            </div>

            {error && <div className="notice error" role="alert"><AlertCircle size={17} /> <span>{error}</span></div>}
            <button className="demo-trigger" type="button" onClick={resetCapture}><RotateCcw size={15} /> Record something else</button>
          </>
        )}

        {view === "clarify" && caseFile && clarification && (
          <>
            <h2>One detail needs you</h2>
            <p className="studio-intro">This is the verified-report path. We found the incident, but we will not guess a critical fact.</p>
            <blockquote className="transcript-preview">“{caseFile.transcript}”</blockquote>
            <div className="clarification-card">
              <span className="question-label">Missing critical information</span>
              <h3>{clarification.question}</h3>
              <label className="field-label" htmlFor="clarification-answer">Your answer</label>
              <input id="clarification-answer" className="text-input" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Add only the missing detail" autoFocus />
              <p className="micro-copy">Question {caseFile.clarifications.length + 1} of at most 3</p>
              {error && <div className="notice error" role="alert"><AlertCircle size={17} /> <span>{error}</span></div>}
              <button className="button button-primary button-full" type="button" disabled={!answer.trim()} onClick={() => void submitClarification()}>
                Save detail & continue <ArrowRight size={17} />
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
