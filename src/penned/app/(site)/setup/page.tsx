"use client";

import { useEffect, useState } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";
import { Container, PageHeader } from "@/components/ui/Section";
import { Uploader, type UploadedFile } from "@/components/ui/Uploader";
import { PagePreview } from "@/components/ui/PagePreview";
import { defaultLayout } from "@/lib/pricing";
import { demoUser, samplePreviewText, type HandwritingProfile } from "@/lib/mock";
import { SHEET_LINES } from "@/lib/engine/sheet.ts";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { live, myStyles, uploadStyle } from "@/lib/api";

type Phase = "upload" | "analysing" | "error" | "preview" | "saved";

const stages = ["Finding the lines on your page", "Separating each letter and number", "Measuring slant, size and spacing", "Building your handwriting style"];

const tips = [
  "Use the pen you'd like us to write with: blue or black, gel or ballpoint.",
  "Write on plain white paper, in your normal everyday handwriting.",
  "Write each line on its own line, three times over, so we see how your letters vary.",
  "Keep letters separate, not joined, so we can learn each one.",
  "Photograph from straight above in good light, with no shadows.",
];

export default function SetupPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [phase, setPhase] = useState<Phase>("upload");
  const [progress, setProgress] = useState(0);
  const [name, setName] = useState("Arjun – Black Ink");
  const [nameError, setNameError] = useState<string>();
  const [ink, setInk] = useState<"blue" | "black">("black");
  const [liveProfiles, setLiveProfiles] = useState<HandwritingProfile[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const profiles: HandwritingProfile[] = live ? (liveProfiles ?? []) : demoUser.handwritingProfiles;

  const loadLive = () =>
    myStyles()
      .then((rows) =>
        setLiveProfiles(
          rows.map((r) => ({
            id: r.id,
            name: r.name,
            createdAt: r.created_at.slice(0, 10),
            ink: r.ink,
            status: r.status === "ready" ? "ready" : r.status === "needs_rescan" ? "needs_rescan" : "processing",
          })),
        ),
      )
      .catch(() => setLiveProfiles([]));

  useEffect(() => {
    if (live) loadLive();
  }, []);

  // Live: the real scan goes to Supabase and an admin reviews every letter in the portal.
  const submitLive = async () => {
    const f = files[0]?.file;
    if (!f) return;
    setUploading(true);
    setUploadError(null);
    try {
      await uploadStyle(f, name.trim() || `My handwriting – ${ink === "blue" ? "Blue" : "Black"} Ink`, ink);
      setSubmitted(true);
      setFiles([]);
      loadLive();
    } catch (e) {
      setUploadError(e instanceof Error && e.message.includes("log in") ? "Please log in first, then upload your sheet." : "Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (phase !== "analysing") return;
    setProgress(0);
    const started = Date.now();
    const total = 4200;
    const t = setInterval(() => {
      const p = Math.min(100, ((Date.now() - started) / total) * 100);
      setProgress(p);
      if (p >= 100) {
        clearInterval(t);
        // Demo: very small photos are treated as too blurry to read.
        setPhase(files[0] && files[0].size < 40 * 1024 ? "error" : "preview");
      }
    }, 80);
    return () => clearInterval(t);
  }, [phase, files]);

  const stageIndex = Math.min(stages.length - 1, Math.floor((progress / 100) * stages.length));

  const reset = () => {
    setFiles([]);
    setPhase("upload");
  };

  const save = () => {
    if (!name.trim()) {
      setNameError("Give this style a name so you can pick it when ordering.");
      return;
    }
    setNameError(undefined);
    setPhase("saved");
  };

  return (
    <Container className="max-w-4xl">
      <PageHeader
        title="Set up your handwriting"
        body="Write one line on paper, take a photo, and we'll learn your style. You only do this once per pen."
      />

      {/* Existing profiles */}
      <section aria-labelledby="profiles" className="mb-10">
        <h2 id="profiles" className="text-sm font-medium text-ink">
          Your handwriting styles
        </h2>
        {profiles.length === 0 ? (
          <p className="mt-3 text-sm text-muted">You haven&apos;t set up a style yet. Start below.</p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {profiles.map((p) => (
              <li key={p.id}>
                <Card className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className={cn("font-hand text-2xl leading-none", p.ink === "black" ? "text-pen-black" : "text-pen-blue")}>{p.name}</p>
                    <p className="mt-2 text-xs text-muted">Created {formatDate(p.createdAt)}</p>
                  </div>
                  {p.status === "ready" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-success/20 bg-[#EEF6F1] px-2.5 py-0.5 text-xs font-medium text-success">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                      Ready
                    </span>
                  ) : (
                    <span className={cn("text-xs font-medium", p.status === "needs_rescan" ? "text-danger" : "text-muted")}>
                      {p.status === "needs_rescan" ? "Rescan needed" : "In review"}
                    </span>
                  )}
                </Card>
              </li>
            ))}
            {phase === "saved" && (
              <li className="animate-slide-up">
                <Card className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className={cn("font-hand text-2xl leading-none", ink === "blue" ? "text-pen-blue" : "text-pen-black")}>{name}</p>
                    <p className="mt-2 text-xs text-muted">Created just now</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-success/20 bg-[#EEF6F1] px-2.5 py-0.5 text-xs font-medium text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                    Ready
                  </span>
                </Card>
              </li>
            )}
          </ul>
        )}
      </section>

      {phase === "saved" ? (
        <Card className="animate-fade-in p-6 sm:p-8">
          <p className="font-hand text-4xl text-accent">Saved.</p>
          <h2 className="mt-3 text-lg font-semibold">&ldquo;{name}&rdquo; is ready to use</h2>
          <p className="mt-1 text-[15px] text-muted">Pick it when you place your next order.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <LinkButton href="/order">Start an order</LinkButton>
            <Button variant="secondary" onClick={reset}>
              Add another style
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_1fr]">
          {/* Step 1: pangram */}
          <Card className="p-5 sm:p-6">
            <p className="text-xs font-medium text-muted">Step 1</p>
            <h2 className="mt-1 text-base font-semibold">Write these lines on paper</h2>
            <blockquote className="mt-4 rounded-xl border border-line bg-paper p-4 text-[17px] leading-relaxed tracking-wide text-ink">
              {SHEET_LINES.map((l) => (
                <span key={l} className="block">{l}</span>
              ))}
            </blockquote>
            <ul className="mt-5 space-y-2.5 text-sm text-muted">
              {tips.map((t) => (
                <li key={t} className="flex gap-2.5">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </Card>

          {/* Step 2: upload / analyse / preview */}
          <Card className="p-5 sm:p-6">
            <p className="text-xs font-medium text-muted">Step 2</p>
            <h2 className="mt-1 text-base font-semibold">
              {phase === "preview" ? "Here's your style" : "Photograph it"}
            </h2>

            {phase === "upload" && (
              <div className="mt-4 space-y-4">
                <Uploader
                  label="Upload a photo of your page"
                  hint="JPG, PNG or HEIC, up to 20 MB"
                  files={files}
                  onAdd={(f) => setFiles(f.slice(0, 1))}
                  onRemove={() => setFiles([])}
                  allowPdf={false}
                  multiple={false}
                  camera
                />
                <fieldset>
                  <legend className="text-sm font-medium text-ink">Ink you wrote with</legend>
                  <div className="mt-2 flex gap-2">
                    {(["blue", "black"] as const).map((c) => (
                      <label
                        key={c}
                        className={cn(
                          "flex flex-1 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm capitalize focus-within:ring-2 focus-within:ring-accent",
                          ink === c ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface",
                        )}
                      >
                        <input
                          type="radio"
                          name="ink"
                          value={c}
                          checked={ink === c}
                          onChange={() => {
                            setInk(c);
                            setName(`Arjun – ${c === "blue" ? "Blue" : "Black"} Ink`);
                          }}
                          className="sr-only"
                        />
                        <span className={cn("h-3 w-3 rounded-full", c === "blue" ? "bg-pen-blue" : "bg-pen-black")} aria-hidden="true" />
                        {c}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {submitted && (
                  <Alert tone="success" title="Sheet uploaded">
                    We check every letter by hand, usually within an hour. Your style shows as Ready above once it&apos;s approved.
                  </Alert>
                )}
                {uploadError && <Alert tone="error">{uploadError}</Alert>}
                <Button
                  fullWidth
                  disabled={files.length === 0}
                  loading={uploading}
                  onClick={() => (live ? submitLive() : setPhase("analysing"))}
                >
                  {live ? "Upload for review" : "Analyse my handwriting"}
                </Button>
              </div>
            )}

            {phase === "analysing" && (
              <div className="mt-6 animate-fade-in" role="status" aria-live="polite">
                <p className="text-[15px] font-medium text-ink">Analysing your handwriting...</p>
                <p className="mt-1 text-sm text-muted">{stages[stageIndex]}</p>
                <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label="Analysis progress">
                  <div className="h-full rounded-full bg-accent transition-[width] duration-100" style={{ width: `${progress}%` }} />
                </div>
                <ol className="mt-6 space-y-2 text-sm">
                  {stages.map((s, i) => (
                    <li key={s} className={cn("flex items-center gap-2.5", i < stageIndex ? "text-ink" : i === stageIndex ? "text-ink" : "text-muted/70")}>
                      <span
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded-full border text-[10px]",
                          i < stageIndex ? "border-accent bg-accent text-white" : i === stageIndex ? "border-accent" : "border-line",
                        )}
                        aria-hidden="true"
                      >
                        {i < stageIndex ? "✓" : ""}
                      </span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {phase === "error" && (
              <div className="mt-4 animate-fade-in space-y-4">
                <Alert tone="error" title="We couldn't read enough letters">
                  The photo looks too small or blurry. Retake it from straight above in good light, filling the frame with the page.
                </Alert>
                <Button fullWidth onClick={reset}>
                  Upload a new photo
                </Button>
              </div>
            )}

            {phase === "preview" && (
              <div className="mt-4 animate-fade-in space-y-5">
                <PagePreview
                  className="mx-auto max-w-[280px]"
                  text={`# Preview\n${samplePreviewText}`}
                  layout={{ ...defaultLayout, ink, pageSize: "a6", marginMm: 10, lineSpacing: 1.1 }}
                  paper="ruled-notebook"
                  caption="Your cloned style, shown on a ruled card"
                />
                <Input
                  label="Name this style"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  error={nameError}
                  hint="You'll choose it by this name when ordering."
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button onClick={save} className="sm:flex-1">
                    Looks like me, save it
                  </Button>
                  <Button variant="secondary" onClick={reset}>
                    Try another photo
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </Container>
  );
}
