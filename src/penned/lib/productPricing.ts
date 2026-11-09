import { getProduct, productPricing as P, type ProductSlug } from "./mock.ts";

/** A price for one order of one product. All amounts in rupees. */
export interface ProductQuote {
  units: number;
  billableUnits: number;
  unitPrice: number;
  unit: { one: string; many: string };
  writing: number;
  /** A new notebook we supply (notes in a plain or ruled notebook). */
  notebook: number;
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
  let notebook = 0;

  switch (slug) {
    case "notes": {
      const inNotebook = opts.paper !== "loose-a4";
      unitPrice = P.notes.perPage;
      writing = n * unitPrice;
      notebook = inNotebook && n > 0 ? P.notes.notebookFee : 0;
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
      note = t.applied
        ? `Bulk rate: ₹${t.applied.price} each from ${t.applied.min} invites.`
        : P.invitations.tiers.map((x, i) => `₹${x.price}${i === 0 ? " each" : ""} from ${x.min}${i === 0 ? " invites" : ""}`).join(", ") + ".";
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

  const subtotal = writing + notebook;
  const delivery = subtotal === 0 || subtotal > P.freeDeliveryAbove ? 0 : P.deliveryFee;
  return { units: n, billableUnits, unitPrice, unit, writing, notebook, delivery, total: subtotal + delivery, note, estimate };
}

export function unitWord(q: Pick<ProductQuote, "unit">, n: number) {
  return n === 1 ? q.unit.one : q.unit.many;
}
