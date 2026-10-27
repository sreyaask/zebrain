// What the pricing page shows. Pro prices are never written here: the page computes them with lib/quote.ts, the same
// formula checkout uses, so the page can't drift from what people are charged.

export const CONTACT_EMAIL = "sreyaaskomrewar555@gmail.com";
export const BOOK_MEETING_URL = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Zebrain: build my model for me")}`;

// Mirrors the credit_packages rows in the database (1 credit = $0.01). Checkout reads the database, not this list.
export const CREDIT_PACKS = [
  { id: "starter", credits: 1000, bonus: 0, usd: 10 },
  { id: "builder", credits: 2500, bonus: 100, usd: 25 },
  { id: "studio", credits: 5000, bonus: 400, usd: 50 },
];

export function usd(n: number) {
  return "$" + n.toFixed(2);
}
