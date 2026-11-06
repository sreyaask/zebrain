# Penned: front-end UI

Penned is a Hyderabad service that writes your notes, letters and cards in your own handwriting with a real pen, then delivers them in 2–3 hours. This folder has the front-end only. There is no backend: everything runs on mock data and local state.

Built with Next.js 14 (App Router), TypeScript and Tailwind CSS.

## Run it

```bash
cd src/penned
npm install
npm run dev        # http://localhost:3000
```

Other scripts: `npm run build`, `npm start`, `npm run typecheck`.

## Pages

| Route | What it is |
| --- | --- |
| `/` | Home: hero with a notebook page that writes itself in, How it works, use cases, pricing teaser, FAQ, early-list signup |
| `/setup` | Handwriting setup: pangram, photo upload or camera, mock analysis, preview of the cloned style |
| `/order` | Five-step order flow: Upload → Layout (live preview) → Paper → Delivery → Review & pay |
| `/orders` | My orders, split into Active and Past tabs |
| `/orders/[id]` | Order tracking timeline, with page progress and rider details (try `PEN-1042` and `PEN-1037`) |
| `/pricing` | Price table and a calculator |
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
