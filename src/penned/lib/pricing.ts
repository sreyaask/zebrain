import { getPageSize, getPaper, pricing, type PageSizeId, type PaperId } from "./mock";

export interface Quote {
  units: number;
  billableUnits: number;
  unitPrice: number;
  unitLabel: "page" | "card";
  minimumApplied: boolean;
  writing: number;
  delivery: number;
  total: number;
  notebooks?: number;
}

export function quote(paperId: PaperId, units: number): Quote {
  const paper = getPaper(paperId);
  const safeUnits = Math.max(0, Math.round(units));
  const billableUnits = paper.minimum ? Math.max(paper.minimum, safeUnits) : safeUnits;
  const writing = billableUnits * paper.pricePerUnit;
  const delivery = writing === 0 || writing > pricing.freeDeliveryAbove ? 0 : pricing.deliveryFee;
  return {
    units: safeUnits,
    billableUnits,
    unitPrice: paper.pricePerUnit,
    unitLabel: paper.unit,
    minimumApplied: billableUnits > safeUnits && safeUnits > 0,
    writing,
    delivery,
    total: writing + delivery,
    notebooks: paper.capacity ? Math.max(1, Math.ceil(billableUnits / paper.capacity)) : undefined,
  };
}

export interface LayoutSettings {
  marginMm: number; // left/right margin
  lineSpacing: number; // multiplier, 1.0 – 2.0
  headingStyle: "underline" | "larger" | "plain";
  ink: "blue" | "black";
  pageSize: PageSizeId;
}

export const defaultLayout: LayoutSettings = {
  marginMm: 18,
  lineSpacing: 1.3,
  headingStyle: "underline",
  ink: "blue",
  pageSize: "b5",
};

/** Rough estimate of handwritten pages for a block of typed text. */
export function estimatePages(text: string, layout: LayoutSettings): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const size = getPageSize(layout.pageSize);
  const lineHeightMm = 7.2 * layout.lineSpacing;
  const charWidthMm = 2.3;
  const usableWidth = size.widthMm - layout.marginMm * 2;
  const usableHeight = size.heightMm - 30;
  const charsPerLine = Math.max(10, Math.floor(usableWidth / charWidthMm));
  const linesPerPage = Math.max(4, Math.floor(usableHeight / lineHeightMm));
  const lines = trimmed
    .split("\n")
    .reduce((sum, para) => sum + Math.max(1, Math.ceil(para.length / charsPerLine)), 0);
  return Math.max(1, Math.ceil(lines / linesPerPage));
}
