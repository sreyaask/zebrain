# Penned design system

One rule above all: the customer's handwriting is the only decorative thing. Everything else is quiet, so the
ink stands out.

## Direction
- Product: consumer service with a pre-launch website, a customer iPhone app and a staff portal.
- Style: minimal and accessible. Web follows this file; iOS follows Apple's Human Interface Guidelines first
  and uses these tokens for brand colour only.
- Dials: variance 2, motion 2, density 3 for the site and app, 6 for the admin portal.

## Colour tokens
| Token | Light | Dark (iOS) | Use |
| --- | --- | --- | --- |
| paper | #FAF9F6 | system background | page background (web) |
| ink | #111111 | label | body text |
| accent | #1E3A8A | #8DA9F4 | links, primary buttons, selection, progress |
| line | #E6E3DC | separator | 1px borders and rules |
| muted | #55534E | secondaryLabel | secondary text (6.9:1 on paper) |
| pen-blue | #22409A | #8DA9F4 | handwriting in blue ink |
| pen-black | #1A1A1A | #EBEBEB | handwriting in black ink |
| danger / success | #B42318 / #1F6F43 | system red / green | errors, delivered |

Web tokens live in `tailwind.config.ts`. iOS tokens live in `ios/Penned/Theme.swift` and `Assets.xcassets/AccentColor`.

## Type
- Web: Inter for UI. Caveat ONLY for handwriting samples. Newsreader 500 for the "Penned" wordmark and app icon.
- iOS: San Francisco via text styles (`.body`, `.headline`…) so Dynamic Type works. Handwriting previews draw the
  customer's real glyphs (`GlyphLine`), sized with `@ScaledMetric`.
- Scale (web): 12 / 14 / 15 / 16 / 18 / 24 / 32 / 40–60 hero. Weights: 600 headings, 500 labels, 400 body.
- Numbers, prices and page counts use tabular figures.

## Shape, spacing, motion
- 12px radius on web cards and inputs; 1px borders; no shadows except focus rings and the page preview.
- 4/8 spacing rhythm. Max width 6xl (site) and 4xl (forms).
- Motion: fades and short slide-ins only, 150–450ms, ease-out, honouring reduced motion. The hero notebook
  writing in is the single choreographed moment, because it shows the product.
- iOS: native transitions only; success and error haptics on placing an order.

## Patterns
- One primary action per screen. On iOS multi-step flows it lives in a fixed bottom bar with the running total.
- Selection: radio cards on web; trailing checkmark rows on iOS.
- Status: text label plus colour, never colour alone (`StatusPill`, `StatusChip`).
- Every screen has empty, loading and error states (`EmptyState`, `Skeleton`, `Alert`; `ContentUnavailableView` on iOS).

## Avoid
- Labels above every heading, scroll fade-ins on everything, icon-in-a-box cards, gradients, emoji,
  stock photos, fake reviews or user counts, and Caveat anywhere that isn't a handwriting sample.
