-- A "long notebook" page size (175 × 275 mm), the size Penned supplies (9 Nov 2026).
-- Its own migration: Postgres can't use a new enum value in the transaction that adds it.
alter type public.page_size_id add value if not exists 'long';
