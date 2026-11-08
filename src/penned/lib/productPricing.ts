import { getProduct, productPricing as P, type ProductSlug } from "./mock";

/** A price for one order of one product. All amounts in rupees. */
export interface ProductQuote {
  units: number;
  billableUnits: number;
  unitPrice: number;
  unit: { one: string; many: string };
  writing: number;
  delivery: number;
  total: number;
  /** Shown under the line item, e.g. "Bulk rate: ₹35 each from 50". */
  note?: string;
  /** True when the business price is an estimate to be confirmed. */
  estimate?: boolean;
}

function tierPrice(base: number, tiers: readonly { min: number; price: number }[], n: number) {
  let price = base;
  let applied: { min: number; price: number } | undefined;
  for (const t of tiers) if (n >= t.min) {
    price = t.price;
    applied = t;
  }
  return { price, applied };
}

export function quoteFor(slug: ProductSlug, units: number, opts: { paper?: string } = {}): ProductQuote {
  const n = Math.max(0, Math.round(units));
  const unit = getProduct(slug)!.unit;
  let billableUnits = n;
  let unitPrice = 0;
  let writing = 0;
  let note: string | undefined;
  let estimate = false;

  switch (slug) {
    case "notes": {
      const notebook = opts.paper !== "loose-a4";
      billableUnits = n > 0 && notebook ? Math.max(P.notes.minimumPages, n) : n;
      unitPrice = P.notes.perPage;
      writing = billableUnits * unitPrice;
      if (notebook && n > 0 && n < P.notes.minimumPages) note = `${P.notes.minimumPages}-page notebook minimum (your content is ${n} ${n === 1 ? "page" : "pages"}).`;
      break;
    }
    case "letters-cards": {
      unitPrice = P.lettersCards.perCard;
      writing = n * unitPrice;
      break;
    }
    case "invitations": {
      const t = tierPrice(P.invitations.perInvite, P.invitations.tiers, n);
      unitPrice = t.price;
      writing = n * unitPrice;
      note = t.applied ? `Bulk rate: ₹${t.applied.price} each from ${t.applied.min} invites.` : `₹35 each from 50 invites, ₹32 from 100.`;
      break;
    }
    case "business-mail": {
      const t = tierPrice(P.businessMail.perNote, P.businessMail.tiers, n);
      unitPrice = t.price;
      writing = n * unitPrice;
      estimate = true;
      note = `Estimate${t.applied ? ` at the ${t.applied.min}+ rate` : ""}. We confirm your quote before writing.`;
      break;
    }
    case "journals-gifts": {
      const extra = Math.max(0, n - P.journals.includedPages);
      billableUnits = n;
      unitPrice = P.journals.extraPerPage;
      writing = n > 0 ? P.journals.base + extra * P.journals.extraPerPage : 0;
      note = `₹${P.journals.base} includes the book and ${P.journals.includedPages} pages${extra ? `, plus ${extra} extra ${extra === 1 ? "page" : "pages"} at ₹${P.journals.extraPerPage}` : ""}.`;
      break;
    }
  }

  const delivery = writing === 0 || writing > P.freeDeliveryAbove ? 0 : P.deliveryFee;
  return { units: n, billableUnits, unitPrice, unit, writing, delivery, total: writing + delivery, note, estimate };
}

export function unitWord(q: Pick<ProductQuote, "unit">, n: number) {
  return n === 1 ? q.unit.one : q.unit.many;
}
