"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

// Small UI sounds, synthesised with Web Audio so there are no files to load. Off until the user turns them on;
// the choice is saved to their account (user_metadata.sounds) and, for visitors, to this browser.
export type Sound = "click" | "step" | "error" | "success";

const KEY = "zebrain.sounds";
let enabled = false;
let ctx: AudioContext | null = null;
const listeners = new Set<(on: boolean) => void>();

function readLocal() {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

let loaded = false;
function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  enabled = readLocal();
  // A signed-in user's saved choice wins over this browser's.
  supabase().auth.getUser().then(({ data }) => {
    const saved = data.user?.user_metadata?.sounds;
    if (typeof saved === "boolean" && saved !== enabled) setSounds(saved, false);
  }).catch(() => {});
}

export function setSounds(on: boolean, save = true) {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {}
  listeners.forEach((l) => l(on));
  if (!save) return;
  const sb = supabase();
  sb.auth.getUser().then(({ data }) => data.user && sb.auth.updateUser({ data: { sounds: on } })).catch(() => {});
  if (on) play("click");
}

export function useSounds() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    load();
    setOn(enabled);
    listeners.add(setOn);
    return () => void listeners.delete(setOn);
  }, []);
  return [on, (v: boolean) => setSounds(v)] as const;
}

// Notes for each sound: [frequency Hz, start s, length s, wave].
const NOTES: Record<Sound, [number, number, number, OscillatorType][]> = {
  click: [[1500, 0, 0.035, "sine"]],
  step: [[660, 0, 0.09, "sine"], [990, 0.08, 0.14, "sine"]],
  error: [[330, 0, 0.12, "triangle"], [220, 0.1, 0.22, "triangle"]],
  success: [[523, 0, 0.12, "sine"], [659, 0.1, 0.12, "sine"], [784, 0.2, 0.12, "sine"], [1047, 0.3, 0.3, "sine"]],
};

export function play(sound: Sound) {
  load();
  if (!enabled || typeof window === "undefined" || document.hidden) return;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    for (const [f, start, len, wave] of NOTES[sound]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.value = f;
      // Quick fade in and out so nothing clicks; kept quiet on purpose.
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(sound === "click" ? 0.04 : 0.07, now + start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + len);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + len + 0.02);
    }
  } catch {}
}
