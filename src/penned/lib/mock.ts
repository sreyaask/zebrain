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
  status: OrderStatus | "cancelled";
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
  perPage: 6,
  notebookMinimumPages: 30,
  perPremiumCard: 49,
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
    description: "Unruled 80 gsm sheets. For letters, long notes and personal writing.",
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
    q: "Is it real ink?",
    a: "Yes. Every page is written by a pen machine holding a real gel or ballpoint pen, in blue or black ink, on real paper. Nothing is printed, so you can see and feel the pressure of each stroke.",
  },
  {
    q: "How do you copy my handwriting?",
    a: "You write one short sample (a sentence that uses every letter, plus capitals and numbers) and send a photo. Our AI separates every character and learns its shape, slant and spacing. When we write, each letter uses a slightly different version, so no two look identical, just like real handwriting.",
  },
  {
    q: "Is my handwriting data safe?",
    a: "Your sample and the style made from it are stored privately and used only to write your own orders. They are never shown to other customers. You can ask us to delete your handwriting style at any time.",
  },
  {
    q: "Where do you deliver?",
    a: `Hyderabad only for now: ${deliveryAreas.slice(0, -1).join(", ")} and ${deliveryAreas[deliveryAreas.length - 1]}. Most orders arrive within 2–3 hours.`,
  },
  {
    q: "Can I see it before you write it?",
    a: "Yes. You set margins, line spacing, headings, card style and ink, with a live preview, before you pay.",
  },
  {
    q: "What if I'm not happy?",
    a: "We rewrite any page or card for free if you tell us within 24 hours of delivery.",
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

/* ---------- Products ---------- */

export type ProductSlug = "notes" | "letters-cards" | "invitations" | "business-mail" | "journals-gifts";

export interface StyleOption {
  id: string;
  name: string;
  description: string;
  size: PageSizeId;
  /** Paper type the order is written on. */
  paper: PaperId;
}

export interface Product {
  slug: ProductSlug;
  name: string;
  /** One line for cards and menus. */
  summary: string;
  /** Headline on the product page. */
  tagline: string;
  description: string;
  uses: string[];
  priceLabel: string;
  priceNote: string;
  /** What one unit is called in the order flow. */
  unit: { one: string; many: string };
  /** A short handwriting sample shown on cards and previews. Lines starting with # are headings. */
  sample: string;
  sampleSize: PageSizeId;
  samplePaper: PaperId;
  steps: { title: string; body: string }[];
  styles?: StyleOption[];
  faqs: FaqItem[];
}

/**
 * Demo prices shown on the website. Note: the live database (public.price_order) still uses the
 * original ₹9/page and ₹15/card rates until it's updated to match these.
 */
export const productPricing = {
  notes: { perPage: 6, minimumPages: 30 },
  lettersCards: { perCard: 49 },
  invitations: { perInvite: 39, tiers: [{ min: 50, price: 35 }, { min: 100, price: 32 }] },
  businessMail: { perNote: 59, tiers: [{ min: 100, price: 49 }, { min: 500, price: 42 }] },
  journals: { base: 299, includedPages: 40, extraPerPage: 6 },
  deliveryFee: 49,
  freeDeliveryAbove: 500,
} as const;

export const products: Product[] = [
  {
    slug: "notes",
    name: "Notes",
    summary: "Study notes, lecture notes and notebook continuations, in your own hand.",
    tagline: "Your notes, in your handwriting.",
    description:
      "Send a photo of your notebook, a PDF or typed text. We continue it in your handwriting on the same kind of notebook, with your margins, spacing and headings, and deliver it the same evening.",
    uses: ["Study notes", "Notebook continuations", "Revision notes", "Lecture notes", "Personal notes and diaries"],
    priceLabel: "₹6 a page",
    priceNote: "30-page minimum for notebooks. Paper and ink included.",
    unit: { one: "page", many: "pages" },
    sample: "# Ch. 4 – Laws of Motion\nNewton's Second Law: the rate of change of momentum of a body is directly proportional to the applied force.\nF = ma, where m is mass and a is acceleration.\nThird Law: every action has an equal and opposite reaction.",
    sampleSize: "b5",
    samplePaper: "ruled-notebook",
    steps: [
      { title: "Upload your pages", body: "A photo of your notebook, a PDF, or typed text. We read the text for you." },
      { title: "Set up the notebook", body: "Pick the notebook size and ruling, then margins, spacing and headings, with a live preview." },
      { title: "Written and delivered", body: "A pen machine writes every page in your hand. Delivered in 2–3 hours." },
    ],
    faqs: [
      { q: "Can you continue a notebook I've already started?", a: "Yes. Choose the same notebook size and ruling, and match the margins in the layout editor. We start on a fresh notebook that matches yours." },
      { q: "How many pages can you write in one order?", a: "Up to 500. You'll see a live page count while we write, and larger orders may take a little longer than 3 hours." },
    ],
  },
  {
    slug: "letters-cards",
    name: "Letters & Cards",
    summary: "Thank-you cards, greeting cards and personal letters that feel like you.",
    tagline: "Say it by hand, even when you're short on time.",
    description:
      "Type what you want to say. We write it on premium card or letter paper in your handwriting, address the envelope, and deliver it in Hyderabad in 2–3 hours.",
    uses: ["Thank-you cards", "Greeting and birthday cards", "Personal letters", "Love letters", "Letters to grandparents"],
    priceLabel: "₹49 a card",
    priceNote: "Envelope and addressing included. Longer letters on A4 are priced the same per sheet.",
    unit: { one: "card", many: "cards" },
    sample: "Dear Amma,\nThank you for the mango pickle and the long phone call. I miss home. See you at Diwali.\nWith love, Arjun",
    sampleSize: "a6",
    samplePaper: "premium-card",
    steps: [
      { title: "Choose a card", body: "Ivory, kraft or deckled cotton card, or A4 letter paper." },
      { title: "Write your message", body: "Type it once, add one or more recipients, and preview each card." },
      { title: "Written and delivered", body: "Signed and addressed in your handwriting, delivered in 2–3 hours." },
    ],
    styles: [
      { id: "ivory", name: "Ivory card", description: "Smooth 300 gsm ivory card, A6, with envelope.", size: "a6", paper: "premium-card" },
      { id: "kraft", name: "Kraft card", description: "Warm recycled kraft card, A6, with envelope.", size: "a6", paper: "premium-card" },
      { id: "cotton", name: "Deckled cotton", description: "Thick cotton card with soft torn edges, A6.", size: "a6", paper: "premium-card" },
      { id: "letter", name: "A4 letter paper", description: "Cream 100 gsm sheets for longer letters, folded with envelope.", size: "a4", paper: "loose-a4" },
    ],
    faqs: [
      { q: "Can you post it for me?", a: "We hand-deliver within our Hyderabad areas. For anywhere else, we deliver it to you sealed and addressed, ready to post." },
      { q: "Can I add a different message for each person?", a: "Yes. Start a line with a name and a dash in the recipient list, and use {name} in your message to personalise each card." },
    ],
  },
  {
    slug: "invitations",
    name: "Invitations",
    summary: "Wedding, birthday, housewarming and event invites, each one written by hand.",
    tagline: "Invitations people keep.",
    description:
      "Your invitation text, written in your handwriting on premium card, with each guest's name written on the card and envelope. From 10 to 500 invites.",
    uses: ["Wedding invitations", "Birthday invitations", "Housewarming invitations", "Naming ceremonies", "Event and dinner invites"],
    priceLabel: "₹39 an invite",
    priceNote: "₹35 each from 50 invites, ₹32 each from 100. Envelopes included.",
    unit: { one: "invite", many: "invites" },
    sample: "# You're invited\nPlease join us for the housewarming of our new home in Kondapur on Sunday, 15 November, at 7 PM.\nThe Reddys",
    sampleSize: "a6",
    samplePaper: "premium-card",
    steps: [
      { title: "Choose a card", body: "Ivory, kraft or gold-edged card for your occasion." },
      { title: "Add your guest list", body: "Paste names (and addresses), or upload a list. Each invite is personalised." },
      { title: "Written and delivered", body: "Every invite is written by pen. Large orders are delivered in batches." },
    ],
    styles: [
      { id: "ivory", name: "Ivory card", description: "Classic 300 gsm ivory, A6, with envelope.", size: "a6", paper: "premium-card" },
      { id: "gold-edge", name: "Gold-edged card", description: "Ivory card with a thin gold edge, for weddings, A6.", size: "a6", paper: "premium-card" },
      { id: "kraft", name: "Kraft card", description: "Recycled kraft, relaxed and warm, A6.", size: "a6", paper: "premium-card" },
    ],
    faqs: [
      { q: "How long do 200 invitations take?", a: "Usually the same day. We write in parallel across machines and deliver in batches; you'll see progress live." },
      { q: "Can each invite have the guest's name?", a: "Yes. Add your guest list and use {name} in the text, for example \"Dear {name}\"." },
    ],
  },
  {
    slug: "business-mail",
    name: "Business Mail",
    summary: "Handwritten thank-you notes, follow-ups and welcome cards for your customers.",
    tagline: "Handwritten notes your customers actually open.",
    description:
      "Upload a list of customers and a message template. We write each note by hand in your (or your team's) handwriting, personalised with each name, and deliver in bulk.",
    uses: ["Client thank-you notes", "Follow-up letters", "Sales outreach notes", "Customer welcome cards", "Event and launch invites"],
    priceLabel: "Custom bulk pricing",
    priceNote: "Estimate ₹59 a note, ₹49 from 100, ₹42 from 500. We confirm a quote before writing.",
    unit: { one: "note", many: "notes" },
    sample: "Hi Priya,\nThank you for choosing Kondapur Coffee Co. for your office. Your first order is on us next week.\nRahul, Founder",
    sampleSize: "a6",
    samplePaper: "premium-card",
    steps: [
      { title: "Upload your list", body: "A CSV with name, company and address. Use {name} and {company} in your message." },
      { title: "Approve a sample", body: "We write and send a photo of the first note before writing the rest." },
      { title: "Written and delivered", body: "Delivered to you in bulk, sealed and addressed, or hand-delivered in Hyderabad." },
    ],
    styles: [
      { id: "note-card", name: "Note card", description: "A6 300 gsm card with envelope. Best for thank-you notes.", size: "a6", paper: "premium-card" },
      { id: "letter", name: "A4 letter", description: "100 gsm cream letter paper for longer follow-ups.", size: "a4", paper: "loose-a4" },
    ],
    faqs: [
      { q: "Can you write in my team's handwriting?", a: "Yes. Each team member writes the sample once, and you choose whose handwriting to use for each batch." },
      { q: "Do you offer invoices with GST?", a: "Yes. Business orders come with a GST invoice." },
    ],
  },
  {
    slug: "journals-gifts",
    name: "Journals & Gifts",
    summary: "Handwritten journals, quote books, recipe books and personalised gift notes.",
    tagline: "A gift only you could have written.",
    description:
      "Turn your recipes, favourite quotes or a year of memories into a bound book written entirely in your handwriting. A gift that feels like it took months.",
    uses: ["Handwritten journals", "Quote books", "Family recipe books", "Letters-to-open-when sets", "Personalised gift notes"],
    priceLabel: "From ₹299",
    priceNote: "Includes a bound book and up to 40 pages. ₹6 for each extra page.",
    unit: { one: "page", many: "pages" },
    sample: "# Amma's Recipes\nTomato pappu\n1 cup toor dal, 2 tomatoes, a pinch of turmeric. Pressure cook for three whistles.",
    sampleSize: "a5",
    samplePaper: "plain-notebook",
    steps: [
      { title: "Pick a book", body: "Linen-bound journal, recipe book or pocket quote book." },
      { title: "Add your words", body: "Type or upload what goes inside. Headings start new sections." },
      { title: "Written and delivered", body: "Every page written by pen, bound, and gift-wrapped on request." },
    ],
    styles: [
      { id: "linen", name: "Linen-bound journal", description: "A5, 80 pages, cream paper, fabric cover.", size: "a5", paper: "plain-notebook" },
      { id: "recipe", name: "Recipe book", description: "A5 ruled pages with a wipe-clean cover.", size: "a5", paper: "ruled-notebook" },
      { id: "quote", name: "Pocket quote book", description: "A6, 60 pages, slips into a bag.", size: "a6", paper: "plain-notebook" },
    ],
    faqs: [
      { q: "Can I add photos?", a: "Not yet. Every page is written by pen, so books are text only for now. Leave space with a blank line and you can stick photos in later." },
      { q: "Can you gift-wrap it?", a: "Yes. Add a note in the delivery step and we'll wrap it in plain kraft paper." },
    ],
  },
];

export function getProduct(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

/** Placeholder reviews. They are deliberately marked as samples; replace with real reviews before launch. */
export const sampleReviews: { quote: string; name: string; context: string }[] = [
  {
    quote: "Sample review — replace before launch. A short, specific sentence from a real Notes customer about how the pages looked.",
    name: "Customer name",
    context: "Notes · Area",
  },
  {
    quote: "Sample review — replace before launch. A real customer's words about a card or letter they sent, and how it was received.",
    name: "Customer name",
    context: "Letters & Cards · Area",
  },
  {
    quote: "Sample review — replace before launch. A business customer's result from handwritten thank-you notes, with their permission.",
    name: "Customer name, Company",
    context: "Business Mail · Area",
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
