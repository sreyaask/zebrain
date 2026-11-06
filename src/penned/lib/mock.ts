/**
 * All demo data for Penned lives here. Every page reads from this file,
 * so swapping in a real API later means replacing these exports.
 */

/* ---------- Types ---------- */

export type InkColour = "blue" | "black";
export type PenType = "gel" | "ballpoint";

export type PaperId = "plain-notebook" | "ruled-notebook" | "loose-a4" | "premium-card";
export type PageSizeId = "b5" | "a4" | "a5" | "a6";

export type OrderStatus = "received" | "writing" | "quality_check" | "out_for_delivery" | "delivered";

export type DeliveryArea =
  | "Gachibowli"
  | "Kondapur"
  | "Madhapur"
  | "Hitech City"
  | "Kukatpally"
  | "Banjara Hills"
  | "Jubilee Hills"
  | "Ameerpet"
  | "Secunderabad"
  | "LB Nagar";

export type TimeSlotId = "within-3h" | "6-8pm" | "8-10pm" | "tomorrow-9-11am";

export interface Address {
  line1: string;
  area: DeliveryArea;
  city: string;
  pincode: string;
}

export interface HandwritingProfile {
  id: string;
  name: string;
  createdAt: string; // ISO date
  status: "ready" | "processing" | "needs_rescan";
  ink: InkColour;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  handwritingProfiles: HandwritingProfile[];
  savedAddress: Address;
}

export interface PaperOption {
  id: PaperId;
  name: string;
  description: string;
  size: PageSizeId;
  unit: "page" | "card";
  pricePerUnit: number;
  /** Pages per physical notebook, if it is a notebook. */
  capacity?: number;
  /** Minimum billable units. */
  minimum?: number;
  ruled: boolean;
}

export interface PageSize {
  id: PageSizeId;
  label: string;
  widthMm: number;
  heightMm: number;
}

export interface TimelineEvent {
  status: OrderStatus;
  label: string;
  time?: string; // display time, e.g. "9:05 PM"
  detail?: string;
  state: "done" | "current" | "pending";
}

export interface Order {
  id: string;
  title: string;
  quantity: number;
  unit: "page" | "card" | "letter";
  paper: PaperId;
  ink: InkColour;
  total: number;
  status: OrderStatus;
  statusLabel: string;
  placedOn: string; // ISO date
  deliveredAt?: string; // display string
  eta?: string;
  progress?: { done: number; total: number };
  rider?: { name: string; eta: string };
  area: DeliveryArea;
  timeline: TimelineEvent[];
}

export interface FaqItem {
  q: string;
  a: string;
}

/* ---------- Demo user ---------- */

export const demoUser: User = {
  id: "usr_arjun",
  name: "Arjun Reddy",
  phone: "+91 98480 12345",
  handwritingProfiles: [
    {
      id: "hw_arjun_blue",
      name: "Arjun – Blue Ink",
      createdAt: "2026-11-02",
      status: "ready",
      ink: "blue",
    },
  ],
  savedAddress: {
    line1: "Flat 302, Sai Residency",
    area: "Kondapur",
    city: "Hyderabad",
    pincode: "500084",
  },
};

/* ---------- Pricing ---------- */

export const pricing = {
  perPage: 9,
  notebookMinimumPages: 30,
  perPremiumCard: 15,
  deliveryFee: 49,
  freeDeliveryAbove: 500,
  rewriteWindowHours: 24,
} as const;

/* ---------- Paper & page sizes ---------- */

export const pageSizes: PageSize[] = [
  { id: "b5", label: "Notebook (B5)", widthMm: 176, heightMm: 250 },
  { id: "a4", label: "A4", widthMm: 210, heightMm: 297 },
  { id: "a5", label: "A5", widthMm: 148, heightMm: 210 },
  { id: "a6", label: "Card (A6)", widthMm: 105, heightMm: 148 },
];

export const paperOptions: PaperOption[] = [
  {
    id: "plain-notebook",
    name: "Plain notebook",
    description: "100 pages, unruled, 70 gsm. Good for diagrams and free-form notes.",
    size: "b5",
    unit: "page",
    pricePerUnit: pricing.perPage,
    capacity: 100,
    minimum: pricing.notebookMinimumPages,
    ruled: false,
  },
  {
    id: "ruled-notebook",
    name: "Ruled notebook",
    description: "100 pages, single-ruled with margin, 70 gsm. The classic for class notes.",
    size: "b5",
    unit: "page",
    pricePerUnit: pricing.perPage,
    capacity: 100,
    minimum: pricing.notebookMinimumPages,
    ruled: true,
  },
  {
    id: "loose-a4",
    name: "Loose A4 sheets",
    description: "Unruled 80 gsm sheets. For letters, assignments and forms.",
    size: "a4",
    unit: "page",
    pricePerUnit: pricing.perPage,
    ruled: false,
  },
  {
    id: "premium-card",
    name: "Premium card (A6)",
    description: "300 gsm textured card with envelope. For invites and thank-you notes.",
    size: "a6",
    unit: "card",
    pricePerUnit: pricing.perPremiumCard,
    ruled: false,
  },
];

/* ---------- Delivery ---------- */

export const deliveryAreas: DeliveryArea[] = [
  "Gachibowli",
  "Kondapur",
  "Madhapur",
  "Hitech City",
  "Kukatpally",
  "Banjara Hills",
  "Jubilee Hills",
  "Ameerpet",
  "Secunderabad",
  "LB Nagar",
];

export const timeSlots: { id: TimeSlotId; label: string; hint: string }[] = [
  { id: "within-3h", label: "Within 3 hrs", hint: "Fastest. Writing starts right away." },
  { id: "6-8pm", label: "6–8 PM", hint: "Today, evening" },
  { id: "8-10pm", label: "8–10 PM", hint: "Today, late evening" },
  { id: "tomorrow-9-11am", label: "Tomorrow 9–11 AM", hint: "Before morning classes" },
];

/* ---------- Copy ---------- */

export const samplePreviewText =
  "Newton's Second Law: The rate of change of momentum of a body is directly proportional to the applied force. F = ma, where m is mass and a is acceleration.";

export const pangram = "The quick brown fox jumps over the lazy dog. 0123456789 , . ? ! ( ) + − = %";

export const faqs: FaqItem[] = [
  {
    q: "How real does it look?",
    a: "It is written with a real pen on real paper, so the ink, the pressure and the small wobbles are all real. We write in the style cloned from your own handwriting sample.",
  },
  {
    q: "Is it a real pen?",
    a: "Yes. Gel or ballpoint, in blue or black ink. You choose the colour when you set up the layout.",
  },
  {
    q: "How long does delivery take?",
    a: "2–3 hours within our Hyderabad areas. Larger notebook orders may take a little longer; you will see a live page count while we write.",
  },
  {
    q: "Which areas do you cover?",
    a: `${deliveryAreas.slice(0, -1).join(", ")} and ${deliveryAreas[deliveryAreas.length - 1]}. More areas are coming.`,
  },
  {
    q: "Can I change the layout?",
    a: "Yes. The layout editor lets you set margins, line spacing, headings, ink colour and page size, with a live preview, before you pay.",
  },
  {
    q: "What if I'm not happy?",
    a: "We rewrite any page for free if you tell us within 24 hours of delivery.",
  },
];

/* ---------- Orders ---------- */

export const orders: Order[] = [
  {
    id: "PEN-1042",
    title: "Physics Ch. 4 Notes",
    quantity: 38,
    unit: "page",
    paper: "ruled-notebook",
    ink: "blue",
    total: 391,
    status: "writing",
    statusLabel: "Writing – page 21 of 38",
    placedOn: "2026-11-06",
    eta: "11:40 PM",
    progress: { done: 21, total: 38 },
    area: "Kondapur",
    timeline: [
      { status: "received", label: "Received", time: "9:05 PM", state: "done" },
      { status: "writing", label: "Writing", time: "9:20 PM", detail: "Page 21 of 38", state: "current" },
      { status: "quality_check", label: "Quality check", state: "pending" },
      { status: "out_for_delivery", label: "Out for delivery", state: "pending" },
      { status: "delivered", label: "Delivered", state: "pending" },
    ],
  },
  {
    id: "PEN-1037",
    title: "Wedding invite cards ×25",
    quantity: 25,
    unit: "card",
    paper: "premium-card",
    ink: "black",
    total: 375,
    status: "out_for_delivery",
    statusLabel: "Out for delivery",
    placedOn: "2026-11-06",
    eta: "18 min",
    rider: { name: "Ravi K.", eta: "18 min" },
    area: "Kondapur",
    timeline: [
      { status: "received", label: "Received", state: "done" },
      { status: "writing", label: "Writing", detail: "25 of 25 cards", state: "done" },
      { status: "quality_check", label: "Quality check", detail: "Passed", state: "done" },
      { status: "out_for_delivery", label: "Out for delivery", detail: "Ravi K. is on the way", state: "current" },
      { status: "delivered", label: "Delivered", state: "pending" },
    ],
  },
  {
    id: "PEN-1029",
    title: "Thank-you letters ×10",
    quantity: 10,
    unit: "letter",
    paper: "loose-a4",
    ink: "blue",
    total: 139,
    status: "delivered",
    statusLabel: "Delivered",
    placedOn: "2026-10-31",
    deliveredAt: "31 Oct 2026, 4:15 PM",
    area: "Kondapur",
    timeline: [
      { status: "received", label: "Received", state: "done" },
      { status: "writing", label: "Writing", state: "done" },
      { status: "quality_check", label: "Quality check", state: "done" },
      { status: "out_for_delivery", label: "Out for delivery", state: "done" },
      { status: "delivered", label: "Delivered", time: "31 Oct, 4:15 PM", state: "done" },
    ],
  },
  {
    id: "PEN-1021",
    title: "History Ch. 7–8 Notes",
    quantity: 52,
    unit: "page",
    paper: "plain-notebook",
    ink: "blue",
    total: 468,
    status: "delivered",
    statusLabel: "Delivered",
    placedOn: "2026-10-27",
    deliveredAt: "27 Oct 2026",
    area: "Kondapur",
    timeline: [
      { status: "received", label: "Received", state: "done" },
      { status: "writing", label: "Writing", state: "done" },
      { status: "quality_check", label: "Quality check", state: "done" },
      { status: "out_for_delivery", label: "Out for delivery", state: "done" },
      { status: "delivered", label: "Delivered", time: "27 Oct", state: "done" },
    ],
  },
];

export const useCases: { title: string; body: string; sample: string }[] = [
  {
    title: "Class notes",
    body: "Send us the PDF or photos. Get a full notebook back in your handwriting, ready to submit.",
    sample: "Ch. 4 – Laws of Motion",
  },
  {
    title: "Letters",
    body: "Long letters to family, cover letters, apologies. Typed by you, written by pen.",
    sample: "Dear Amma,",
  },
  {
    title: "Wedding & greeting cards",
    body: "Address and sign 25 or 250 invites on premium card, in black or blue ink.",
    sample: "With love, the Reddys",
  },
  {
    title: "Business thank-you notes",
    body: "Personal notes for clients and customers that people actually keep.",
    sample: "Thank you for trusting us.",
  },
];

/* ---------- Mock API (simulated latency) ---------- */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchOrders(opts?: { fail?: boolean; empty?: boolean }): Promise<Order[]> {
  await wait(500);
  if (opts?.fail) throw new Error("We couldn't load your orders. Check your connection and try again.");
  return opts?.empty ? [] : orders;
}

export function getPaper(id: PaperId): PaperOption {
  const p = paperOptions.find((p) => p.id === id);
  if (!p) throw new Error(`Unknown paper: ${id}`);
  return p;
}

export function getPageSize(id: PageSizeId): PageSize {
  return pageSizes.find((s) => s.id === id) ?? pageSizes[0];
}
