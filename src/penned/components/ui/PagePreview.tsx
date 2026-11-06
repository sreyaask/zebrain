import { getPageSize, type PaperId } from "@/lib/mock";
import type { LayoutSettings } from "@/lib/pricing";
import { cn } from "@/lib/cn";

export const inkHex = { blue: "#22409A", black: "#1A1A1A" } as const;

interface PagePreviewProps {
  text: string;
  layout: LayoutSettings;
  paper?: PaperId;
  className?: string;
  /** Caption under the page, e.g. "Page 1 of 38". */
  caption?: string;
}

/**
 * A to-scale page preview. All dimensions are in container-query units so
 * the page keeps its proportions at any width.
 */
export function PagePreview({ text, layout, paper = "ruled-notebook", className, caption }: PagePreviewProps) {
  const size = getPageSize(layout.pageSize);
  const W = size.widthMm;
  const toCq = (mm: number) => `${(mm / W) * 100}cqw`;
  const lineMm = 7.2 * layout.lineSpacing;
  const fontMm = 6.4;
  const ruled = paper === "ruled-notebook";
  const topMm = lineMm * 2;
  const ink = inkHex[layout.ink];
  const padTopMm = topMm - lineMm * 0.82;

  const blocks = text.split("\n").filter((l, i, arr) => l.trim() !== "" || (i > 0 && arr[i - 1].trim() !== ""));

  return (
    <figure className={cn("w-full", className)}>
      <div
        className="relative w-full overflow-hidden rounded-[4px] border border-line bg-white shadow-[0_1px_2px_rgba(17,17,17,0.04)] [container-type:inline-size]"
        style={{ aspectRatio: `${size.widthMm} / ${size.heightMm}` }}
        aria-label={`Preview of a ${size.label} page in ${layout.ink} ink`}
        role="img"
      >
        {ruled && (
          <>
            <div
              className="absolute inset-0"
              aria-hidden="true"
              style={{
                backgroundImage: `linear-gradient(to bottom, transparent calc(100% - 1px), #CBD5E8 calc(100% - 1px))`,
                backgroundSize: `100% ${toCq(lineMm)}`,
                backgroundPositionY: toCq(padTopMm % lineMm),
              }}
            />
            <div className="absolute bottom-0 top-0 w-px bg-[#E8A3A3]" style={{ left: toCq(Math.max(5, layout.marginMm - 3)) }} aria-hidden="true" />
          </>
        )}
        <div
          className="relative font-hand transition-all duration-300"
          style={{
            color: ink,
            fontSize: toCq(fontMm),
            lineHeight: toCq(lineMm),
            paddingTop: toCq(padTopMm),
            paddingLeft: toCq(layout.marginMm),
            paddingRight: toCq(layout.marginMm),
          }}
        >
          {blocks.length === 0 ? (
            <p className="text-ink/30">Your text will appear here.</p>
          ) : (
            blocks.map((line, i) => {
              const isHeading = line.startsWith("# ");
              const content = isHeading ? line.slice(2) : line;
              if (!content.trim()) return <p key={i} aria-hidden="true">&nbsp;</p>;
              if (isHeading) {
                return (
                  <p
                    key={i}
                    className={cn(
                      layout.headingStyle === "underline" && "underline decoration-1 underline-offset-[0.18em]",
                      layout.headingStyle === "larger" && "font-semibold",
                    )}
                    style={layout.headingStyle === "larger" ? { fontSize: toCq(fontMm * 1.3) } : undefined}
                  >
                    {content}
                  </p>
                );
              }
              return <p key={i}>{content}</p>;
            })
          )}
        </div>
      </div>
      {caption && <figcaption className="mt-2 text-center text-xs text-muted">{caption}</figcaption>}
    </figure>
  );
}
