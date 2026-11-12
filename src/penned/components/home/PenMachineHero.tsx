/**
 * Demo of a pen machine writing a notebook page: a gantry rail steps down line by line while the
 * pen carriage travels along it, and the handwriting appears behind the pen.
 */
const lines: { text: string; heading?: boolean }[] = [
  { text: "Ch. 4 – Laws of Motion", heading: true },
  { text: "Newton's Second Law:" },
  { text: "The rate of change of momentum" },
  { text: "of a body is proportional" },
  { text: "to the applied force." },
  { text: "F = ma" },
];

const LINE = 40; // px, matches the ruling

export function PenMachineHero() {
  let delay = 500;
  const timed = lines.map((l) => {
    const duration = Math.max(700, l.text.length * 45);
    const t = { ...l, delay, duration };
    delay += duration + 250;
    return t;
  });

  return (
    <figure className="relative mx-auto w-full max-w-md">
      <div
        className="relative overflow-hidden rounded-xl border border-line bg-sheet pb-8 pl-6 pr-3 pt-14 sm:px-10"
        role="img"
        aria-label="A pen machine writing Newton's Second Law in blue handwriting on a ruled notebook page"
      >
        {/* Machine frame: two side rails */}
        <div className="absolute inset-y-0 left-1.5 w-1 rounded-full bg-sheet-ink/10" aria-hidden="true" />
        <div className="absolute inset-y-0 right-1.5 w-1 rounded-full bg-sheet-ink/10" aria-hidden="true" />
        {/* Notebook margin line */}
        <div className="absolute bottom-0 top-0 left-12 w-px bg-[#E8A3A3] sm:left-16" aria-hidden="true" />

        <div
          className="relative whitespace-nowrap pl-5 font-hand text-[19px] leading-[40px] text-pen-blue sm:pl-8 sm:text-[22px]"
          style={{ backgroundImage: `linear-gradient(to bottom, transparent ${LINE - 1}px, #CBD5E8 ${LINE - 1}px)`, backgroundSize: `100% ${LINE}px` }}
          aria-hidden="true"
        >
          {timed.map((l, i) => (
            <div key={i} className="relative">
              <span className="relative inline-block">
                <span
                  className={l.heading ? "underline decoration-1 underline-offset-4" : undefined}
                  style={{ animation: `write ${l.duration}ms linear ${l.delay}ms both` }}
                >
                  {l.text}
                </span>
                {/* Gantry rail for this line: visible only while this line is being written */}
                <span
                  className="pen-machine absolute -left-[200px] -right-[200px] top-[2px] h-[3px] rounded-full bg-sheet-ink/15"
                  style={{ animation: `pen-on ${l.duration}ms linear ${l.delay}ms` }}
                />
                {/* Pen carriage and tip */}
                <span
                  className="pen-machine absolute top-[-14px] block"
                  style={{ animation: `pen-move ${l.duration}ms linear ${l.delay}ms${i === timed.length - 1 ? " forwards" : ""}` }}
                >
                  <span className="flex -translate-x-1/2 flex-col items-center">
                    <span className="block h-4 w-5 rounded-[3px] bg-sheet-ink" />
                    <span className="block h-4 w-[3px] bg-sheet-ink/70" />
                    <span className="block h-1.5 w-1.5 rounded-full bg-pen-blue" />
                  </span>
                </span>
              </span>
            </div>
          ))}
          <div>&nbsp;</div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted">Written by a pen machine in the &ldquo;Arjun – Blue Ink&rdquo; style. Real gel pen, real notebook.</figcaption>
    </figure>
  );
}
