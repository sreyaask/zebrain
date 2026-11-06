import type { UploadedFile } from "@/components/ui/Uploader";
import type { DeliveryArea, PaperId, TimeSlotId } from "@/lib/mock";
import { demoUser, getPageSize, getPaper, samplePreviewText } from "@/lib/mock";
import { defaultLayout, estimatePages, quote, type LayoutSettings, type Quote } from "@/lib/pricing";

export interface DeliveryDetails {
  addressMode: "saved" | "new";
  name: string;
  phone: string;
  line1: string;
  area: DeliveryArea | "";
  pincode: string;
  landmark: string;
  slot: TimeSlotId | "";
}

export interface OrderDraft {
  title: string;
  mode: "files" | "text";
  files: UploadedFile[];
  text: string;
  layout: LayoutSettings;
  paper: PaperId;
  copies: number;
  delivery: DeliveryDetails;
}

export const initialDraft: OrderDraft = {
  title: "",
  mode: "files",
  files: [],
  text: "",
  layout: defaultLayout,
  paper: "ruled-notebook",
  copies: 25,
  delivery: {
    addressMode: "saved",
    name: demoUser.name,
    phone: demoUser.phone.replace("+91 ", ""),
    line1: "",
    area: "",
    pincode: "",
    landmark: "",
    slot: "within-3h",
  },
};

export const filesPreviewText = `# Ch. 4 – Laws of Motion\n${samplePreviewText}`;

/** Handwritten pages needed for this draft's content (one copy). */
export function contentPages(d: OrderDraft): number {
  if (d.mode === "text") return estimatePages(d.text, d.layout);
  if (d.files.length === 0) return 0;
  // Photos are treated as one page each. PDF pages are assumed to be A4 with
  // 18 mm margins at normal spacing and rescaled to the chosen layout.
  const size = getPageSize(d.layout.pageSize);
  const sourceArea = (210 - 36) * (297 - 30);
  const targetArea = Math.max(40, size.widthMm - d.layout.marginMm * 2) * (size.heightMm - 30);
  const factor = (sourceArea / targetArea) * (d.layout.lineSpacing / 1.3);
  const spacing = d.layout.lineSpacing / 1.3;
  const photos = d.files.filter((f) => f.kind === "image").length;
  const pdfPages = d.files.filter((f) => f.kind === "pdf").reduce((s, f) => s + f.pages, 0);
  return Math.max(1, Math.ceil(photos * spacing + pdfPages * factor));
}

export function draftQuote(d: OrderDraft): Quote {
  const paper = getPaper(d.paper);
  const units = paper.unit === "card" ? d.copies : contentPages(d);
  return quote(d.paper, units);
}

export function previewText(d: OrderDraft): string {
  return d.mode === "text" && d.text.trim() ? d.text : filesPreviewText;
}
