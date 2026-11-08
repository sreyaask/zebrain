#!/usr/bin/env python3
# Usage: python3 scripts/make_sounds.py Penned/Sounds
# Synthesises Penned's UI sounds (original, no samples). 44.1 kHz mono 16-bit WAV.
import math, random, struct, wave, sys
SR = 44100
out = sys.argv[1]
random.seed(7)

def write(name, samples, peak_db=-10.0):
    peak = max(1e-9, max(abs(x) for x in samples))
    gain = (10 ** (peak_db / 20)) / peak
    # 3 ms fade in/out to avoid clicks
    f = int(0.003 * SR)
    for i in range(min(f, len(samples))):
        samples[i] *= i / f
        samples[-1 - i] *= i / f
    with wave.open(f"{out}/{name}.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, x * gain)) * 32767)) for x in samples))

def tone(freq, dur, decay, phase_mod=0.0):
    n = int(dur * SR)
    return [math.sin(2 * math.pi * freq * t / SR + phase_mod * math.sin(2 * math.pi * freq * 2 * t / SR)) * math.exp(-t / SR / decay) for t in range(n)]

def lowpass(x, a):
    y, prev = [], 0.0
    for v in x:
        prev = prev + a * (v - prev); y.append(prev)
    return y

def mix(*tracks, offsets=None):
    offsets = offsets or [0] * len(tracks)
    n = max(int(o * SR) + len(t) for t, o in zip(tracks, offsets))
    y = [0.0] * n
    for t, o in zip(tracks, offsets):
        s = int(o * SR)
        for i, v in enumerate(t): y[s + i] += v
    return y

# tap: a short, soft wooden click
click = tone(1900, 0.035, 0.006)
body = tone(420, 0.05, 0.012)
write("tap", mix(click, [v * 0.6 for v in body]), -14)

# step: a quick paper flick (filtered noise, rising then falling)
n = int(0.11 * SR)
noise = [random.uniform(-1, 1) for _ in range(n)]
env = [math.sin(math.pi * (i / n)) ** 2 for i in range(n)]
flick = [v * e for v, e in zip(lowpass(noise, 0.35), env)]
write("step", flick, -16)

# success: two bright notes, C6 then G6, gentle bell decay
c6 = tone(1046.5, 0.35, 0.09, 0.4)
g6 = tone(1568.0, 0.55, 0.14, 0.4)
write("success", mix(c6, [v * 0.9 for v in g6], offsets=[0, 0.11]), -11)

# error: a low, soft double thud
t1 = tone(196, 0.09, 0.025)
t2 = tone(165, 0.12, 0.03)
write("error", mix(t1, t2, offsets=[0, 0.11]), -12)

# scribble: a pen scratching across paper for a moment
n = int(0.42 * SR)
noise = [random.uniform(-1, 1) for _ in range(n)]
band = [a - b for a, b in zip(lowpass(noise, 0.5), lowpass(noise, 0.08))]
strokes = [0.55 + 0.45 * math.sin(2 * math.pi * 9 * i / SR) ** 2 for i in range(n)]
env = [min(1, i / (0.03 * SR)) * min(1, (n - i) / (0.08 * SR)) for i in range(n)]
write("scribble", [b * s * e for b, s, e in zip(band, strokes, env)], -15)
print("ok")
