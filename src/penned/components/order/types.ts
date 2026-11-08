import type { UploadedFile } from "@/components/ui/Uploader";
import type { DeliveryArea, PaperId, ProductSlug, StyleOption, TimeSlotId } from "@/lib/mock";
import { demoUser, getPageSize, getProduct, samplePreviewText } from "@/lib/mock";
import { defaultLayout, estimatePages, type LayoutSettings } from "@/lib/pricing";
import { quoteFor, type ProductQuote } from "@/lib/productPricing";

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

export interface CsvList {
  fileName: string;
  columns: string[];
  rows: Record<string, string>[];
}

export interface OrderDraft {
  product: ProductSlug;
  title: string;
  // Notes and journals: pages to copy or type
  mode: "files" | "text";
  files: UploadedFile[];
  text: string;
  // Cards, invitations, business mail
  styleId: string;
  message: string;
  recipients: string; // one per line
  csv: CsvList | null;
  /** Notes: begin the notebook with a numbered contents list of the headings. */
  contentsPage: boolean;
  // Shared
  layout: LayoutSettings;
  paper: PaperId;
  copies: number;
  delivery: DeliveryDetails;
}

export const initialDraft: OrderDraft = {
  product: "notes",
  title: "",
  mode: "files",
  files: [],
  text: "",
  styleId: "",
  message: "",
  recipients: "",
  csv: null,
  contentsPage: true,
  layout: defaultLayout,
  paper: "ruled-notebook",
  copies: 1,
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

/** Defaults to apply when the customer picks a product. */
export function productDefaults(slug: ProductSlug, d: OrderDraft): Partial<OrderDraft> {
  const product = getProduct(slug)!;
  const style = product.styles?.[0];
  if (!style) return { product: slug, styleId: "", paper: "ruled-notebook", layout: { ...d.layout, pageSize: "b5", marginMm: 18 } };
  const card = style.size === "a6";
  return {
    product: slug,
    styleId: style.id,
    paper: style.paper,
    mode: slug === "journals-gifts" ? "text" : d.mode,
    layout: { ...d.layout, pageSize: style.size, marginMm: card ? 9 : 16, lineSpacing: card ? 1.1 : d.layout.lineSpacing, ink: card ? "black" : d.layout.ink },
  };
}

// ---------- Steps ----------

export type StepId = "product" | "upload" | "layout" | "paper" | "style" | "message" | "bulk" | "delivery" | "review";

export const flows: Record<ProductSlug, StepId[]> = {
  notes: ["product", "upload", "layout", "paper", "delivery", "review"],
  "letters-cards": ["product", "style", "message", "delivery", "review"],
  invitations: ["product", "style", "message", "delivery", "review"],
  "business-mail": ["product", "style", "bulk", "delivery", "review"],
  "journals-gifts": ["product", "style", "upload", "layout", "delivery", "review"],
};

export function stepLabel(id: StepId, product: ProductSlug): string {
  switch (id) {
    case "product": return "Product";
    case "upload": return product === "journals-gifts" ? "Contents" : "Upload";
    case "layout": return "Layout";
    case "paper": return "Notebook";
    case "style": return product === "journals-gifts" ? "Book" : product === "business-mail" ? "Stationery" : "Card";
    case "message": return product === "invitations" ? "Invite & guests" : "Message";
    case "bulk": return "Recipients";
    case "delivery": return "Delivery";
    case "review": return "Review & pay";
  }
}

export function stepCopy(id: StepId, product: ProductSlug): { title: string; body: string } {
  switch (id) {
    case "product":
      return { title: "What do you want written?", body: "Pick one. You can come back and change it before you pay." };
    case "upload":
      return product === "journals-gifts"
        ? { title: "What goes inside?", body: "Type or paste your recipes, quotes or memories. Lines starting with # begin a new section." }
        : { title: "Upload your notebook pages", body: "Photos or a PDF of the pages to copy, or type the text yourself. Then choose your notebook size." };
    case "layout":
      return { title: "Set up the page", body: "Changes show instantly in the preview. Nothing is written until you pay." };
    case "paper":
      return { title: "Choose your notebook", body: "Paper and ink are included in the price." };
    case "style":
      return product === "journals-gifts"
        ? { title: "Choose your book", body: "Every book is bound and written by pen, page by page." }
        : product === "business-mail"
          ? { title: "Choose your stationery", body: "Note cards for thank-yous, A4 letters for longer follow-ups." }
          : { title: "Choose your card", body: "Envelopes are included. Pick the ink your message is written in." };
    case "message":
      return product === "invitations"
        ? { title: "Your invitation and guest list", body: "Write the invitation once, then add each guest. Use {name} to write their name on the card." }
        : { title: "Your message and who it's for", body: "Write it once, then add one or more recipients. Use {name} to personalise each card." };
    case "bulk":
      return { title: "Upload your recipient list", body: "A CSV with a name column (and optionally company and address). Use {name} and {company} in your message." };
    case "delivery":
      return { title: "Where should we deliver?", body: "We deliver within our Hyderabad areas in 2–3 hours." };
    case "review":
      return { title: "Review and pay", body: "Check everything once. You can still go back and change any step." };
  }
}

// ---------- Quantities and price ----------

export function selectedStyle(d: OrderDraft): StyleOption | undefined {
  return getProduct(d.product)?.styles?.find((s) => s.id === d.styleId);
}

/** People the cards are for: CSV rows for business mail, otherwise one per non-empty line. */
export function recipientNames(d: OrderDraft): string[] {
  if (d.product === "business-mail" && d.csv) {
    const nameKey = d.csv.columns.find((c) => c.toLowerCase() === "name") ?? d.csv.columns[0];
    return d.csv.rows.map((r) => (r[nameKey] ?? "").trim()).filter(Boolean);
  }
  return d.recipients
    .split("\n")
    .map((l) => l.split(/\s[—–-]\s/)[0].trim())
    .filter(Boolean);
}

/** Fill {name} and {company} for one recipient. */
export function personalise(message: string, row: { name?: string; company?: string }): string {
  return message.replace(/\{name\}/gi, row.name || "Friend").replace(/\{company\}/gi, row.company || "");
}

export const filesPreviewText = `# Ch. 4 – Laws of Motion\n${samplePreviewText}`;

/** Handwritten pages needed for notes and journals (one copy). */
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

export function orderUnits(d: OrderDraft): number {
  return d.product === "notes" || d.product === "journals-gifts" ? contentPages(d) : recipientNames(d).length;
}

export function draftQuote(d: OrderDraft): ProductQuote {
  return quoteFor(d.product, orderUnits(d), { paper: d.paper });
}

/** Headings in the notes: lines that start with "# ". */
export function headingsIn(text: string): string[] {
  return text
    .split("\n")
    .filter((l) => l.startsWith("# "))
    .map((l) => l.slice(2).trim())
    .filter(Boolean);
}

/** Puts a contents list (numbered headings) in front of the notes. */
export function withContents(text: string): string {
  const headings = headingsIn(text);
  if (!headings.length) return text;
  return `# Contents\n${headings.map((h, i) => `${i + 1}. ${h}`).join("\n")}\n\n${text}`;
}

export function previewText(d: OrderDraft): string {
  const body = d.mode === "text" && d.text.trim() ? d.text : d.product === "journals-gifts" ? getProduct("journals-gifts")!.sample : filesPreviewText;
  return d.product === "notes" && d.contentsPage ? withContents(body) : body;
}

/**
 * The text sent with the order. For cards, invitations and business mail it carries the message and
 * the recipient list, so the writing team has everything in one place.
 */
export function orderText(d: OrderDraft): string {
  if (d.product === "notes") return d.contentsPage ? withContents(d.text) : d.text;
  if (d.product === "journals-gifts") return d.text;
  const style = selectedStyle(d);
  const list =
    d.product === "business-mail" && d.csv
      ? d.csv.rows.map((r) => d.csv!.columns.map((c) => r[c] ?? "").join(" | "))
      : d.recipients.split("\n").map((l) => l.trim()).filter(Boolean);
  return `${d.message.trim()}\n\n# ${style?.name ?? "Card"}, ${list.length} recipients\n${list.join("\n")}`;
}
