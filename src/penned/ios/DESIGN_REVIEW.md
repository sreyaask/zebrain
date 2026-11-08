# iOS design review: Penned (2026-11-08)

**Mode: source review, not on-device.** This review ran in a cloud session with no Mac, simulator or device, so the
gstack iOS daemon (screenshots, accessibility tree) was not available. Scores come from reading the SwiftUI code in
`src/penned/ios/Penned` against the 10-dimension rubric. Nothing here was observed on a screen; run `/ios-design-review`
again on a Mac with a connected device to confirm.

## Scores after this pass

| Screen | Type | Spacing | Colour | Targets | States | A11y | Motion | iOS idiom | Density | Slop | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Home (new) | 9 | 9 | 9 | 9 | 9 | 8 | 9 | 8 | 9 | 9 | Custom header hides the nav bar; fine for a root screen |
| New order: notes | 9 | 9 | 9 | 9 | 8 | 8 | 9 | 9 | 8 | 9 | Long Form; sections keep it scannable |
| New order: letters (new) | 9 | 9 | 9 | 9 | 8 | 8 | 9 | 9 | 9 | 9 | |
| Orders | 9 | 9 | 9 | 9 | 9 | 8 | 9 | 9 | 9 | 9 | |
| Order detail | 9 | 9 | 9 | 9 | 8 | 9 | 9 | 9 | 9 | 9 | |
| Handwriting | 9 | 9 | 9 | 9 | 9 | 8 | 9 | 9 | 9 | 9 | |
| Sign in | 9 | 9 | 9 | 9 | 8 | 8 | 9 | 8 | 9 | 9 | Custom fields with visible labels |

No dimension is below 7, so no fix decision was needed from the owner.

## Findings fixed in this pass

1. **States (was 5):** Orders, Home and Handwriting showed "No orders yet" / "Start with your handwriting" before the
   first load finished. Added `AppModel.hasLoaded`; those screens now show a loading state until data arrives.
2. **Touch targets (was 6):** the remove-page button on the notes step was a bare SF Symbol (~22 pt). Now 44×44 pt.
3. **iOS idiom / information architecture (was 6):** the app opened on a list of orders with one generic "New order".
   It now opens on Home with the four things customers come for (Complete notes, Missed notes, Your handwriting,
   Letters & cards), and "New order" in Orders is a native menu of the three order kinds.
4. **Product fit (was 6):** notes orders offered "Premium card" as paper. Letters & cards now has its own flow
   (card style, ink, message with {name}, recipients, live card preview); notes paper is notebooks and loose A4 only.
5. **Missed notes:** new "About the lessons" section (who it's for, subject, lessons missed) and copy for students and parents.
6. **"Indexed for exam prep":** a free "Start with a contents list" toggle, shown in the live preview.

## Compile-risk fixes (the app could not be built here)

- `HandwritingPage`: every `CGFloat`/`Double` mix made explicit; `GlyphSet` stores `CGFloat` so drawing maths is single-typed.
- `aspectRatio` arguments converted to `CGFloat` explicitly.
- All Swift files re-checked for balanced braces/parentheses and removed call sites (`NewOrderView()` without a kind).

## Next on a device

- Dynamic Type at AX5 on Home (the grid drops to one column) and the order bottom bar (stacks vertically).
- Dark mode and Increase Contrast on handwriting previews.
- VoiceOver pass on the Home tiles and the order timeline.
