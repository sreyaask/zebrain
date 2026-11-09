-- Pricing v2 (8 Nov 2026): pages × ₹11 (no minimum) + ₹120 notebook when we supply it + delivery ₹49 (free above ₹500).
-- Customers can instead have us continue in their own notebook (collected by the rider): no notebook charge.
-- Cards stay ₹15 each.

alter table public.orders
  add column if not exists notebook_source text not null default 'new' check (notebook_source in ('new', 'own')),
  add column if not exists notebook_barcode text check (notebook_barcode is null or notebook_barcode ~ '^[0-9A-Za-z-]{4,64}$'),
  add column if not exists notebook_spec jsonb,
  add column if not exists notebook_amount integer not null default 0;

-- Known notebooks, looked up by barcode in the app. Admins maintain it.
create table if not exists public.notebook_catalog (
  barcode text primary key check (barcode ~ '^[0-9A-Za-z-]{4,64}$'),
  name text not null check (char_length(name) between 1 and 120),
  width_mm numeric(5,1) not null check (width_mm between 50 and 400),
  height_mm numeric(5,1) not null check (height_mm between 50 and 500),
  line_pitch_mm numeric(4,1) check (line_pitch_mm between 3 and 20),
  margin_mm numeric(4,1) check (margin_mm between 0 and 60),
  ruled boolean not null default true,
  pages integer check (pages between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.notebook_catalog enable row level security;
drop policy if exists "notebook_catalog: signed-in users read" on public.notebook_catalog;
create policy "notebook_catalog: signed-in users read" on public.notebook_catalog
  for select to authenticated using (true);
drop policy if exists "notebook_catalog: admins write" on public.notebook_catalog;
create policy "notebook_catalog: admins write" on public.notebook_catalog
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create or replace function public.price_order_v2(p_paper public.paper_id, p_units integer, p_notebook_source text)
returns table (billable_units integer, unit_price integer, writing_amount integer, notebook_amount integer, delivery_amount integer, total integer)
language sql
immutable
set search_path = ''
as $$
  with b as (
    select
      greatest(p_units, 0) as units,
      case when p_paper = 'premium-card' then 15 else 11 end as price,
      case when p_paper in ('plain-notebook', 'ruled-notebook') and coalesce(p_notebook_source, 'new') = 'new' and p_units > 0 then 120 else 0 end as notebook
  ), s as (
    select units, price, units * price as writing, notebook, units * price + notebook as subtotal from b
  )
  select
    s.units,
    s.price,
    s.writing,
    s.notebook,
    case when s.subtotal = 0 or s.subtotal > 500 then 0 else 49 end,
    s.subtotal + case when s.subtotal = 0 or s.subtotal > 500 then 0 else 49 end
  from s;
$$;

create or replace function public.prepare_order()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  units integer;
  q record;
begin
  if tg_op = 'INSERT' then
    new.code := 'PEN-' || nextval('public.order_code_seq');
    if not public.is_staff() then
      new.user_id := (select auth.uid());
      new.status := 'received';
      new.payment_status := 'unpaid';
      new.pages_written := 0;
      new.rider_name := null;
      new.eta := null;
      new.admin_note := null;
    end if;
  end if;

  if new.paper not in ('plain-notebook', 'ruled-notebook') then
    new.notebook_source := 'new';
  end if;

  units := case when new.paper = 'premium-card' then new.copies else new.page_count end;
  select * into q from public.price_order_v2(new.paper, units, new.notebook_source);
  new.billable_units := q.billable_units;
  new.unit_price := q.unit_price;
  new.writing_amount := q.writing_amount;
  new.notebook_amount := q.notebook_amount;
  new.delivery_amount := q.delivery_amount;
  new.total := q.total;

  if new.status = 'delivered' and new.delivered_at is null then
    new.delivered_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;
