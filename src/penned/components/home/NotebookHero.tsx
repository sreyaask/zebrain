const lines: { text: string; heading?: boolean }[] = [
  { text: "Ch. 4 – Laws of Motion", heading: true },
  { text: "Newton's Second Law:" },
  { text: "The rate of change of momentum" },
  { text: "of a body is directly proportional" },
  { text: "to the applied force." },
  { text: "F = ma, where m is mass" },
  { text: "and a is acceleration." },
];

/** Ruled notebook page with handwriting that writes itself in, line by line. */
export function NotebookHero() {
  let delay = 400;
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div
        className="relative overflow-hidden rounded-xl border border-line bg-white pb-10 pl-6 pr-3 pt-12 sm:px-10"
        role="img"
        aria-label="A notebook page with Newton's Second Law handwritten in blue ink"
      >
        {/* binding holes */}
        <div className="absolute left-3 top-0 flex h-full flex-col justify-around py-8" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-full border border-line bg-paper" />
          ))}
        </div>
        {/* margin line */}
        <div className="absolute bottom-0 top-0 left-12 w-px bg-[#E8A3A3] sm:left-16" aria-hidden="true" />
        <div
          className="relative whitespace-nowrap pl-5 font-hand text-[19px] leading-[40px] text-pen-blue sm:pl-8 sm:text-[24px]"
          style={{
            backgroundImage: "linear-gradient(to bottom, transparent 39px, #CBD5E8 39px)",
            backgroundSize: "100% 40px",
          }}
          aria-hidden="true"
        >
          {lines.map((l, i) => {
            const duration = Math.max(600, l.text.length * 42);
            const style = { animation: `write ${duration}ms linear ${delay}ms both` };
            delay += duration + 180;
            return (
              <p
                key={i}
                style={style}
                className={l.heading ? "underline decoration-1 underline-offset-4" : undefined}
              >
                {l.text}
              </p>
            );
          })}
          <p>&nbsp;</p>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted">Written in the &ldquo;Arjun – Blue Ink&rdquo; style, gel pen on ruled notebook.</p>
    </div>
  );
}
