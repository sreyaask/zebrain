// The website quote must match what the database charges (public.price_order_v2).
// Run: node --test tests/pricing.test.mts
import { test } from "node:test";
import assert from "node:assert/strict";
import { quoteFor } from "../lib/productPricing.ts";

// Expected totals are price_order_v2's: ₹11 a page, +₹120 for a new notebook, ₹15 a card, ₹49 delivery free above ₹500.
const cases = [
  { slug: "notes", units: 1, paper: "ruled-notebook", total: 11 + 120 + 49 },
  { slug: "notes", units: 10, paper: "ruled-notebook", total: 110 + 120 + 49 },
  { slug: "notes", units: 50, paper: "plain-notebook", total: 550 + 120 },
  { slug: "notes", units: 10, paper: "loose-a4", total: 110 + 49 },
  { slug: "letters-cards", units: 3, total: 45 + 49 },
  { slug: "letters-cards", units: 40, total: 600 },
] as const;

for (const c of cases) {
  test(`web quote matches the database: ${c.slug} x${c.units}${"paper" in c ? ` (${c.paper})` : ""}`, () => {
    assert.equal(quoteFor(c.slug, c.units, { paper: "paper" in c ? c.paper : undefined }).total, c.total);
  });
}

test("no order, no charge", () => {
  assert.equal(quoteFor("notes", 0, { paper: "ruled-notebook" }).total, 0);
});
