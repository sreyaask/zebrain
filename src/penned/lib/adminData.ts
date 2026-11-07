"use client";
import { supabase } from "./supabase";

/** Signed URL for a private storage object (valid 1 hour). */
export async function signedUrl(bucket: string, path: string): Promise<string> {
  const { data, error } = await supabase().storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data) throw new Error(error?.message ?? "Couldn't open file");
  return data.signedUrl;
}

/** Download a private image and return its pixels, scaled so the long edge is at most maxEdge. */
export async function loadImagePixels(bucket: string, path: string, maxEdge = 2400) {
  const { data, error } = await supabase().storage.from(bucket).download(path);
  if (error || !data) throw new Error(error?.message ?? "Couldn't download the scan");
  const bitmap = await createImageBitmap(data);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return { pixels: ctx.getImageData(0, 0, w, h).data, width: w, height: h, objectUrl: URL.createObjectURL(data) };
}

export function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
