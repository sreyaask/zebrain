# Penned

Penned is a Hyderabad service that writes your notes, letters and cards in your own handwriting with a real pen, then delivers them in 2–3 hours.

This folder holds:

- **Customer website** (`app/(site)`): marketing pages and the order flow. With Supabase keys in `.env.local` it uses real login (email + password), orders, uploads and live tracking; without them it runs as a demo on `lib/mock.ts`.
- **Admin portal** (`app/admin`): order queue, order detail with text extraction and plotter export, and handwriting review. Uses Supabase.
- **Handwriting engine** (`lib/engine`): turns a photographed sample sheet into pen strokes, reflows any text (for example an A4 page) onto notebook pages, and writes SVG and G-code for a pen plotter.
- **Backend** (`supabase/migrations`): tables, row-level security, server-side pricing, order timeline and storage buckets.
- **iPhone app** (`ios/`): SwiftUI customer app. See `ios/README.md`.

Built with Next.js 14 (App Router), TypeScript and Tailwind CSS.

## Run it

```bash
cd src/penned
npm install
npm run dev        # http://localhost:3000
```

Other scripts: `npm run build`, `npm run typecheck`, `npm test` (engine unit tests plus an end-to-end extraction test that needs Chromium).

## Connect Supabase

1. Apply `supabase/migrations/*.sql` to a Supabase project (SQL editor, or `supabase db push`).
2. Copy `.env.example` to `.env.local` and fill in the project URL and publishable key.
3. Create your admin user in Supabase → Authentication → Users → Add user (email and password), then run:
   `update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');`
4. Open `/admin` and sign in.

## How a job flows

1. **Handwriting sample:** the customer writes the three-line sheet (three times, letters separate) and uploads a photo from the app. In **Admin → Handwriting**, run *Extract handwriting*. The engine finds each line, matches every mark to its character, thins it to a centre line and traces pen strokes. Review the boxes and the character grid, then approve it or ask for a rescan.
2. **Order:** the customer scans or uploads pages. The app reads the text on the phone; the portal can also read it (*Read text from files*: Tesseract for photos, the PDF's text layer, or OCR for scanned PDFs).
3. **A4 → notebook:** in the order, *Generate pages* re-flows the text to the order's page size, margins, line spacing and heading style, and draws it with the customer's glyphs. Each letter picks a different sample, with slight size, slant and baseline variation, so no two letters are identical.
4. **Plotter:** choose a preset (Z-axis lift, GRBL servo, or SVG for AxiDraw/Inkscape), adjust the pen commands and offsets, then save. One SVG per page plus a single G-code file (it pauses with `M0` between pages) are uploaded to the private `plotter` bucket.
5. **Status:** move the order through Writing (with pages written), Quality check, Out for delivery (rider and ETA) and Delivered. The customer's app shows each step.

Payments are a demo: `demo_mark_paid()` marks an order paid. Swap in a payment gateway webhook before launch.

## Pages

| Route | What it is |
| --- | --- |
| `/` | Home: pen-machine hero, How it works, products (Notes featured), Why handwritten, per-product pricing, sample reviews (marked as placeholders), FAQ |
| `/products/[slug]` | One page per product: notes, letters-cards, invitations, business-mail, journals-gifts |
| `/setup` | Handwriting setup: pangram, photo upload or camera, mock analysis, preview of the cloned style |
| `/order` | Starts with "What do you want written?"; steps adapt per product (Notes: upload + notebook size; Cards/Invites: card style + recipients; Business: CSV list; Journals: book + contents). `?product=<slug>` preselects |
| `/orders` | My orders, split into Active and Past tabs |
| `/orders/[id]` | Order tracking timeline, with page progress and rider details (try `PEN-1042` and `PEN-1037`) |
| `/pricing` | Per-product prices and a calculator |
| `/login` | Phone number and OTP login |

## Demo behaviour

- **OTP:** the code is `123456`. Any other code shows the error state.
- **Payment:** the UPI ID `fail@upi`, or a card number ending in `0002`, shows a declined payment. Any other valid input succeeds. The new order is saved to `localStorage`, so it shows up in My orders and on its tracking page.
- **Handwriting setup:** a photo smaller than 40 KB is treated as too blurry, which shows the error state.
- **Early list:** an email at `@example.com` shows the server-error state.
- **Orders list states:** `/orders?demo=empty` shows the empty state and `/orders?demo=error` shows the error state with a retry button.
- An unknown order ID, such as `/orders/PEN-9999`, shows the not-found state.

## Structure

```
app/                  routes (App Router), plus the global loading, error and not-found screens
components/ui/        reusable pieces: Button, Input/Select/Textarea, Card, Stepper, Uploader,
                      PagePreview, StatusPill, Navbar, Footer, Segmented, RadioCard, Alert, Reveal
components/order/     the order flow, with one file per step and the shared draft types
components/home/      home-page sections (notebook hero, FAQ, early list)
lib/mock.ts           all demo data, fully typed: user, pricing, paper, areas, slots, orders, FAQ
lib/pricing.ts        quote and page-count estimates
lib/store.ts          localStorage helpers for placed orders and the mock login
```

To connect a real backend, replace the exports in `lib/mock.ts` (and `fetchOrders`) with API calls. The pages read only from that file.

## Design notes

- The colours are an off-white background (`#FAF9F6`), near-black text (`#111`) and one accent, ink blue (`#1E3A8A`). Borders are 1px and corners are 12px.
- Inter is the UI font. Caveat is used only for handwriting samples. The wordmark is set in Newsreader.
- Motion is limited to fades and gentle slide-ins, and it respects `prefers-reduced-motion`.
- Accessibility: every input has a label, errors are announced, focus rings are visible, there is a skip link, and the radio and segmented controls are built on native inputs.
