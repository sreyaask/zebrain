/** Who Penned writes for, beyond students: the "For business" page (app/(site)/business) and the home page teaser. */
export type SegmentId = "authors" | "schools" | "ngos" | "banks" | "business" | "events";

export interface Segment {
  id: SegmentId;
  name: string;
  headline: string;
  body: string;
  uses: string[];
  /** A line shown in handwriting on the card. */
  sample: string;
  /** What we will and won't write for this group. */
  safeguard?: string;
}

export const segments: Segment[] = [
  {
    id: "authors",
    name: "Authors",
    headline: "A personal inscription in every copy",
    body: "For launches, pre-orders and giveaways: a note to each reader by name, in your handwriting, signed off the way you sign. You write the sample once and approve every batch before it goes out.",
    uses: ["Personal inscriptions for launches and pre-orders", "Thank-you cards to readers", "Bookplates and dedications", "Notes to reviewers and bookshops"],
    sample: "Dear Meera, thank you for reading. Warmly, A.",
    safeguard: "Only in the author's own handwriting, with their written consent. Copies inscribed by our machines shouldn't be sold as hand-signed; we can add a small \"written with Penned\" mark so readers know.",
  },
  {
    id: "schools",
    name: "Schools & colleges",
    headline: "Letters parents and alumni keep",
    body: "Welcome letters for new families, thank-you notes to parents and volunteers, invitations to annual day, and alumni letters, written in the principal's or a teacher's hand.",
    uses: ["Welcome letters to new families", "Annual day and graduation invitations", "Thank-you notes to parents and volunteers", "Alumni and donor letters"],
    sample: "Dear Mr and Mrs Rao, welcome to our school family.",
    safeguard: "We don't write students' work, exam answers or anything handed in for marks.",
  },
  {
    id: "ngos",
    name: "NGOs & foundations",
    headline: "Thank every donor by hand",
    body: "A handwritten thank-you is the note a donor reads and remembers. Send one to every supporter, volunteer and partner, in your founder's handwriting, at a price that works in bulk.",
    uses: ["Donor thank-you letters", "Volunteer appreciation cards", "Campaign and festival letters", "Partner and CSR updates"],
    sample: "Thank you, Priya. Your gift fed 40 children this month.",
  },
  {
    id: "banks",
    name: "Banks & financial services",
    headline: "Welcome letters that feel personal",
    body: "Relationship managers can greet every new customer, thank long-standing ones and send festival wishes, each note written by hand and posted or delivered.",
    uses: ["New customer welcome letters", "Relationship manager notes", "Festival greetings", "Anniversary and loyalty thank-yous"],
    sample: "Dear Mr Kumar, it's a pleasure to look after your account.",
    safeguard: "We never write signatures on cheques, forms, contracts or anything that authorises money or a legal step.",
  },
  {
    id: "business",
    name: "Brands & businesses",
    headline: "Thank-you cards customers actually open",
    body: "A handwritten card in the box, a follow-up after a site visit, a note with a client gift. Upload a list and a message; we write each card with the name and details filled in.",
    uses: ["Thank-you cards in every order", "Sales and real estate follow-ups", "Client gifts and festival greetings", "Hotel and clinic welcome notes"],
    sample: "Hi Arjun, thanks for your first order. Enjoy it!",
  },
  {
    id: "events",
    name: "Weddings & events",
    headline: "Every guest's name, by hand",
    body: "Invitations, place cards and thank-you notes with each guest's name written in, in the couple's or the family's handwriting.",
    uses: ["Wedding and event invitations", "Place cards and envelopes", "Thank-you notes after the event"],
    sample: "Dear Ananya, we'd love you to join us.",
  },
];

export const segmentIds = segments.map((s) => s.id);
