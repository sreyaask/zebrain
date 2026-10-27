import "server-only"; // build fails if a browser page ever imports this (keeps keys off the client)
import { gzipSync } from "node:zlib";
import { requireKeys } from "./admin";

// Pro training on Zebrain's RunPod GPUs (REST API: docs.runpod.io/api-reference). The job script travels gzipped in
// an env var, runs once, and the pod removes itself when the job ends; the status route also cleans up after it.

const API = "https://rest.runpod.io/v1";
const IMAGE = process.env.RUNPOD_IMAGE || "runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04";

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  requireKeys("RUNPOD_API_KEY");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string })?.error || `RunPod answered ${res.status}.`);
  return data as T;
}

export async function startTrainingPod(opts: { name: string; script: string; gpuId: string; gpuCount: number; diskGb: number }) {
  const job = gzipSync(Buffer.from(opts.script)).toString("base64");
  const run = 'echo "$ZB_JOB" | base64 -d | gunzip > /job.py && python /job.py; runpodctl remove pod "$RUNPOD_POD_ID"';
  return call<{ id: string }>("/pods", {
    method: "POST",
    body: JSON.stringify({
      name: opts.name.slice(0, 60),
      imageName: IMAGE,
      gpuTypeIds: [opts.gpuId],
      gpuCount: opts.gpuCount,
      cloudType: process.env.RUNPOD_CLOUD || "SECURE",
      containerDiskInGb: opts.diskGb,
      volumeInGb: 0,
      env: { ZB_JOB: job, ZEBRAIN_GPU: "runpod" },
      dockerStartCmd: ["bash", "-c", run],
      interruptible: false,
    }),
  });
}

export const getPod = (id: string) => call<{ id: string; desiredStatus?: string; lastStatusChange?: string }>(`/pods/${id}`);
export const removePod = (id: string) => call(`/pods/${id}`, { method: "DELETE" });
