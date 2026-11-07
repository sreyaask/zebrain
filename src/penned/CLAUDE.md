# Penned

Penned is a Hyderabad service that writes notes, letters and cards in the customer's own handwriting with a real pen,
then delivers them in 2–3 hours. This folder is the front-end only: no backend, mock data and local state.
It is unrelated to the Zebrain app in `src/zebrain`, and the test-mode / `revert` rules in the root CLAUDE.md do not apply here.

## Where things are
- Code lives on branch `penned-ui` (not on `main`). The built static site is on branch `gh-pages`.
- Stack: Next.js 14 App Router, TypeScript, Tailwind 3. Static export (`output: "export"`, `trailingSlash: true`).
- All demo data is in `lib/mock.ts` (typed). Pages read only from there. `fetchOrders()` simulates latency.
- `lib/pricing.ts`: quotes and page-count estimates. `lib/store.ts`: localStorage for placed orders and mock login.
- Reusable UI is in `components/ui/`, the order flow is in `components/order/` (one file per step, draft types in
  `types.ts`), home sections are in `components/home/`, and the tracking view is in `components/tracking/`.
- `app/orders/[id]/page.tsx` pre-renders the mock order IDs plus PEN-1043 to PEN-1082, the range the demo checkout hands
  out, so tracking links work on a static host. Keep these in sync if the ID logic in `OrderFlow.tsx` changes.

## Run / build
- Dev: `npm install && npm run dev` (port 3000). Checks: `npm run typecheck`, `npm run build`.
- GitHub Pages build: `PAGES_BASE_PATH=/zebrain npm run build` writes to `out/` (includes `.nojekyll`).
  To redeploy, force-push the contents of `out/` as the root of branch `gh-pages`.
- Target URL is https://sreyaask.github.io/zebrain/. As of 7 Nov 2026 Pages was NOT yet enabled in the repo settings
  (no pages-build-deployment run had ever appeared). The user must set Settings → Pages → Deploy from a branch →
  `gh-pages` / root. On iPhone Safari, Request Desktop Website is needed to see that page.
- The user's laptop is a Mac with the repo at `~/Desktop/zebrain`. To run it there:
  `git fetch origin penned-ui && git checkout penned-ui && cd src/penned && npm install && npm run dev`.
- Vercel was declined (the user did not want to add a token). A personal cloud environment named "zebrain" that
  allows api.vercel.com exists but is unused.

## Design rules (from the original brief)
- Minimal, should look like a real shipped product. Background #FAF9F6, text #111, one accent: ink blue #1E3A8A.
- Inter for UI. Caveat ONLY for handwriting samples. The wordmark "Penned" is set in a serif (Newsreader).
- 1px borders, 12px radius, lots of whitespace. No gradients, no emojis, no stock photos, no lorem ipsum.
- Motion is limited to fades and gentle slide-ins, and it respects reduced motion.
- No fake reviews, ratings or user counts. Use the "Join the early list" section ("Opening soon in Hyderabad").
- Accessible: labels, visible focus states, good contrast. Every screen needs empty, loading and error states.

## Pages
`/` home (notebook hero that writes in line by line, how it works, use cases, pricing teaser, FAQ, early list),
`/setup` handwriting setup (pangram → upload/camera → mock analysis → style preview),
`/order` 5 steps (Upload → Layout with live preview → Paper → Delivery → Review & pay),
`/orders` list (Active/Past tabs), `/orders/[id]` tracking timeline, `/pricing` table plus calculator, `/login` phone + OTP.

## Demo data (from the brief)
- User: Arjun Reddy, +91 98480 12345. Handwriting profile "Arjun – Blue Ink", created 2 Nov 2026, Ready.
  Saved address: Flat 302, Sai Residency, Kondapur, Hyderabad 500084.
- Pricing: ₹9/page with a 30-page minimum for notebooks, ₹15 per premium card, delivery ₹49 flat and free above ₹500.
  Free rewrite of any page within 24 hours.
- Orders: PEN-1042 Physics Ch. 4 Notes (38 pages, writing page 21 of 38, ETA 11:40 PM, ₹391);
  PEN-1037 Wedding invite cards ×25 (out for delivery, rider Ravi K., 18 min, ₹375);
  PEN-1029 Thank-you letters ×10 (delivered 31 Oct 2026, 4:15 PM, ₹139);
  PEN-1021 History Ch. 7–8 Notes (52 pages, delivered 27 Oct 2026, ₹468).
- Known inconsistency: the PEN-1037 and PEN-1021 totals omit the ₹49 delivery fee even though both are under ₹500.
  The given figures are kept, and past orders show only "Total paid" with no breakdown.
- Paper options: plain notebook, ruled notebook, loose A4, premium card (A6). A page size "Card (A6)" was added so
  cards fit the layout editor, and picking a paper sets the page size to match.
- Delivery areas: Gachibowli, Kondapur, Madhapur, Hitech City, Kukatpally, Banjara Hills, Jubilee Hills, Ameerpet,
  Secunderabad, LB Nagar. Time slots: Within 3 hrs, 6–8 PM, 8–10 PM, Tomorrow 9–11 AM.

## Demo triggers
- OTP is `123456`.
- UPI `fail@upi`, or a card number ending in `0002`, gets declined.
- A setup photo smaller than 40 KB is treated as too blurry.
- An early-list email at `@example.com` shows the server error.
- `/orders?demo=empty` and `/orders?demo=error` show the empty and error states.
- `/orders/PEN-9999` shows the not-found state in dev. On the static export, unknown IDs get the site 404.
