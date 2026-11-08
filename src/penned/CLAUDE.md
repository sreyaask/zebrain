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

## Backend, admin, engine, iOS (added 7 Nov 2026)
- Supabase schema: `supabase/migrations/20261107000001_penned_core.sql`. Prices are computed by trigger
  (`price_order()`), so clients can't set totals. `is_staff()` = admin user OR a server role (SQL editor, service role).
  The order code sequence starts at PEN-1043. Payment is a demo RPC `demo_mark_paid()`.
  The migration was validated locally with PGlite and stubbed auth/storage (RLS, tamper-proof pricing, role guard).
- Supabase project "penned": id `tgwnrfrnutkdifzgsran` (ap-south-1, org icjcfrxwkrwvqffnonrq), created 7 Nov 2026 after the
  user paused `zebrain`. Both migrations are applied. The anon key is in `ios/Penned/Config.swift` and in `.env.local` (git-ignored).
  NEVER delete or modify `invistaar` (the user said so explicitly). A full live end-to-end test passed on 7 Nov 2026:
  customer upload and order, admin extraction (9/9 lines), OCR, plotter job and status → customer tracking. All test data was removed.
  No admin account exists yet; the user must create one (see README "Connect Supabase").
  Network: the "zebrain" cloud environment allows tgwnrfrnutkdifzgsran.supabase.co. In tests, Node fetch needs NODE_USE_ENV_PROXY=1.
- Engine `lib/engine/` (pure TS, imports use `.ts` extensions): binarize → components → line grouping → marks
  (merging horizontal overlaps, splitting/merging to match the sheet) → Zhang–Suen thinning → stroke tracing →
  glyphs in x-height units. `layoutHandwriting()` reflows text to notebook pages. `plot.ts` writes SVG and G-code.
  The sample sheet (3 lines, written 3×, letters separate) is in `lib/engine/sheet.ts` and must match `ios/Penned/Views/HandwritingView.swift`.
  Tests: `node --test tests/engine.test.mts` and `node tests/extract.e2e.mjs` (renders a sheet in Chromium).
- Admin portal: `/admin` (queue), `/admin/order/?id=`, `/admin/handwriting/`, `/admin/handwriting/review/?id=`. Static-export
  friendly (query params, not dynamic routes). Needs NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.
  The PDF.js worker is copied to public/ by `scripts/copy-static-assets.mjs` (bundling it breaks minification).
- iOS: `ios/Penned.xcodeproj` (Xcode 16 synced folders, supabase-swift ≥ 2.20, iOS 17). It was never compiled because no Mac
  was available. Uses email + password (no emails; "Confirm email" off). Fill in `ios/Penned/Config.swift`.
- Customer website: `lib/api.ts` switches on `live` (= Supabase env vars set). Live: email + password login (Supabase only; "Confirm email" must be OFF in Supabase so no email is sent — the user declined Resend/custom SMTP), real orders
  (`/orders/track/?code=PEN-…` for tracking, with realtime updates), order placement uploads files to `uploads/<uid>/<order_id>/`,
  handwriting upload for admin review, early list insert. Without env vars it is the original demo on lib/mock.ts.
- Writing method: a pen plotter (user's choice). The iPhone app is for customers; the admin portal is web.

## Products (added 8 Nov 2026)
- Penned is a multi-product handwriting service; Notes is the main product. Catalogue, demo prices, sample reviews and FAQ
  live in `lib/mock.ts` (`products`, `productPricing`, `sampleReviews`). Prices are computed by `lib/productPricing.ts`.
- Demo prices: Notes ₹6/page (30-page notebook minimum), Letters & Cards ₹49/card, Invitations ₹39 (₹35 from 50, ₹32 from 100),
  Business Mail estimate ₹59 (₹49 from 100, ₹42 from 500), Journals from ₹299 (40 pages, ₹6 per extra page).
  The live database `price_order()` still uses the old ₹9/page and ₹15/card; it was deliberately not changed.
- The order flow's steps per product are in `components/order/types.ts` (`flows`). Cards, invites and business notes are sent
  through the existing order API as typed text containing the message and the recipient list (no backend changes).
- Copy rules: never "homework", "assignments", "skip writing" or anything implying cheating. Use "notes", "study notes", "personal notes".
- Reviews on the homepage are placeholders marked "Sample review — replace before launch". Don't present them as real.

## Performance and motion (added 8 Nov 2026)
- Marketing pages must not import `lib/api.ts` or `lib/supabase.ts` (they pull in the ~250 KB Supabase client).
  Use `lib/session.ts` (`live`, `hasSavedSession`, `signOutLive`) and `await import("@/lib/api")` at the moment data is needed.
- Don't fade in the largest above-the-fold text (it delays LCP). Lighthouse on a simulated phone, 8 Nov 2026:
  home 89→92, order 71→92 (layout shift 0.872→0), best practices 96→100. Remaining LCP ≈3.2 s is JS start-up on slow 4G.
- Uploads: `lib/fileProcessing.ts` resizes photos on the device (≤2400 px JPEG) and reads real PDF page counts.
  `components/ui/Uploader.tsx` has a numbered page grid, move buttons (WCAG 2.5.7) plus drag on desktop, paste, and Undo.
- Motion: 150–300 ms ease-out, only where it explains something, always off under prefers-reduced-motion
  (keyframes in `tailwind.config.ts` and `app/globals.css`). "How it works" graphics are in `components/home/StepGraphics.tsx`.

## Notes positioning (added 8 Nov 2026)
- Headline: "Penned: handwritten notes, ready to study from." Pitch: neat handwritten copies of your notes to revise from a clean
  notebook, catch up after absences, or keep a tidy record of lessons. Uses: Revision notebooks, Catch-up notes, Organized study copies.
- Keep out of Notes copy: assignments/homework/worksheets or anything submitted as the student's own work; "clone your handwriting"
  as a headline; any claim it helps avoid writing notes or get past a teacher's ban. "Notebook continuations" was removed for this reason.
- "Indexed": Notes has a free "Start with a contents list" option (on by default) that puts numbered headings at the front
  (`withContents` in components/order/types.ts). It's a list on page 1, not a separate page: the engine has no page breaks.

## Notebook pricing, own notebooks, diagrams (added 8 Nov 2026)
- DB pricing v2 (`supabase/migrations/20261108000003_notebook_pricing.sql`, applied live): pages × ₹11 with no minimum, plus ₹120
  when Penned supplies a plain/ruled notebook (`notebook_source = 'new'`), delivery ₹49 (free above ₹500). Cards stay ₹15.
  `notebook_source = 'own'` = "Continue in my notebook": the rider collects it, no notebook charge. `notebook_spec` (jsonb, mm) holds
  its measurements; `notebook_catalog` maps barcodes to known notebooks (admins write, signed-in users read). The page count is chosen
  by the customer (detected from their files, editable). The website still shows the older demo prices; the user chose "iPhone app only".
- iPhone notes flow (Complete and Missed notes): Notes → Notebook (Ruled ₹120 / Plain ₹120 / Continue in my notebook) → Delivery → Review.
  Layout, ink and contents list are not customer choices. Barcode scanning uses VisionKit DataScanner (`Services/BarcodeScanner.swift`).
- Reading notes (`ios/Penned/Services/TextRecognizer.swift`): PDF pages are rendered on white (thumbnails are transparent, which broke OCR),
  digital PDFs use positioned text-layer lines, ink not covered by text becomes a diagram crop uploaded as `diagram-<id>.png`, and the text
  gets a `[[diagram:<id>]]` line. The admin PlotterPanel traces the crops (`lib/engine/diagram.ts`) and the layout places them between lines.
- The iOS code has never been compiled here (no Swift toolchain in the cloud container).
- Trust (iOS, 8 Nov 2026): `Views/TrustViews.swift` holds the promises (`Guarantee`: final price, free 24 h rewrite, real pen,
  every page checked by a person, private files, live tracking), Blinkit-style `BillCard`, `HelpCenterView` (FAQ), contact buttons,
  `OrderPlacedView` (what happens next) and a shareable text receipt. Support contacts are in `Config.swift`
  (`supportWhatsApp`, `supportPhone`, `supportEmail`); empty values are hidden. Never add ratings, reviews or user counts.
