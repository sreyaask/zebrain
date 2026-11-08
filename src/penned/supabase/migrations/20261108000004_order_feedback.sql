-- Ratings after delivery (8 Nov 2026). One per order, written by the customer who owns it, only once it's delivered.
-- These are the start of real reviews; nothing is shown publicly from here without the team choosing to.
create table if not exists public.order_feedback (
  order_id uuid primary key references public.orders(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);
alter table public.order_feedback enable row level security;

create policy "order_feedback: owner reads" on public.order_feedback
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "order_feedback: owner rates a delivered order" on public.order_feedback
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()) and o.status = 'delivered')
  );
