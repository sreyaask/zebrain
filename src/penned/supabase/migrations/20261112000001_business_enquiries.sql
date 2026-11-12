-- Sample and quote requests from the "For business" page (authors, schools, NGOs, banks, companies, events).
-- Anyone can send one; only admins can read them.

create table if not exists public.business_enquiries (
  id bigint generated always as identity primary key,
  segment text not null check (segment in ('authors', 'schools', 'ngos', 'banks', 'business', 'events', 'other')),
  organisation text not null check (char_length(organisation) between 1 and 160),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  phone text check (phone is null or char_length(phone) <= 30),
  quantity integer check (quantity is null or quantity between 1 and 1000000),
  message text check (message is null or char_length(message) <= 2000),
  created_at timestamptz not null default now()
);

alter table public.business_enquiries enable row level security;

drop policy if exists "business_enquiries: anyone can send" on public.business_enquiries;
create policy "business_enquiries: anyone can send" on public.business_enquiries
  for insert to anon, authenticated with check (true);

drop policy if exists "business_enquiries: admins read" on public.business_enquiries;
create policy "business_enquiries: admins read" on public.business_enquiries
  for select to authenticated using ((select public.is_admin()));

grant insert on public.business_enquiries to anon, authenticated;
grant select on public.business_enquiries to authenticated;
