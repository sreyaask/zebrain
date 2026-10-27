# Zebrain

The app lives in `src/zebrain` (Next.js 14, Supabase, Python training job in `lib/zebrain_train.py`).
Run the site with `npm run dev -- -p 3100` from `src/zebrain`. Tests: `node tests/*.mjs` and `python3 tests/<name>.py`
from `src/zebrain`. Never commit `.env.local`, and run `node scripts/check-secrets.mjs` before pushing.

## Test mode and `revert`

Test mode lives only on the `test-mode-gemini` branch; `main` never contains it. Everything it changes is listed in
`TEST_MODE.md` on that branch. The tag `pre-test-mode` marks the code before test mode.

If the user types `revert`: undo ALL test-mode changes listed in TEST_MODE.md: switch the AI backend back to Qwen,
restore paid runs to Zebrain's GPUs, restore the 14B limit, delete the test account and its seeded data from Supabase,
remove test env vars, return to the pre-test-mode code, then confirm everything is restored. Keep the UI upgrade from
Part 3 unless the user says otherwise.

How, in order:
1. On `test-mode-gemini`, read `TEST_MODE.md` and run its cleanup script (`node scripts/test-mode-cleanup.mjs` from
   `src/zebrain`) to delete the test account and every seeded row.
2. Remove the test env vars listed in `TEST_MODE.md` from `src/zebrain/.env.local` (`AI_PROVIDER`, `TEST_MODE`,
   `TEST_MAX_MODEL_SIZE`, `TEST_ACCOUNT_EMAIL`); the default provider is Qwen.
3. `git checkout main`: main has the Part 3 UI but none of the test-mode code (Qwen backend, Pro on Zebrain's GPUs,
   14B limit). Delete `TEST_MODE.local.md`.
4. Check each item in `TEST_MODE.md` is undone and tell the user, item by item.
