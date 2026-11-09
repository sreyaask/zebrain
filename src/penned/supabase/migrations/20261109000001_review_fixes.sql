-- Fixes from the 9 Nov 2026 pre-landing review.
--  1. Prices are fixed once set: an order is repriced only while unpaid and only when its pricing inputs change
--     (status or rider updates no longer rewrite stored totals, e.g. PEN-1043 stays ₹319).
--  2. Orders need at least one page or card; notebook/loose orders are always one copy.
--  3. Order status follows the flow: delivered/cancelled are final, and writing can't start before payment.
--  4. demo_mark_paid can be switched off (app_settings.demo_payments), and never pays a cancelled or ₹0 order.
--  5. Customer-written references are tied to the customer: handwriting scan paths, order file paths and the
--     handwriting style chosen for an order.
--  6. Handwriting review can't approve a profile that was sent back for a rescan.
--  7. Internal admin notes move to an admin-only table (customers could read orders.admin_note).
--  8. Customers can cancel their own unpaid order (no more stuck orders after a failed checkout).
--  9. A customer's own notebook measurements must be plausible (no zero/negative writing width or line pitch).
-- 10. Smaller: one saved address per label, an index for feedback lookups, order codes can't be burned.

-- ---------- Settings ----------
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists "app_settings: admin" on public.app_settings;
create policy "app_settings: admin" on public.app_settings
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
insert into public.app_settings (key, value) values ('demo_payments', 'true'::jsonb) on conflict (key) do nothing;

-- ---------- Server role check ----------
-- True for the SQL editor / service role, never for a signed-in user (admin or not).
create or replace function public.is_server_role()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user not in ('authenticated', 'anon');
$$;

-- ---------- Order codes ----------
-- Only the order trigger may take a code (customers could otherwise burn codes through the API).
create or replace function public.next_order_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() = 0 then
    raise exception 'Order codes are assigned when an order is placed';
  end if;
  return 'PEN-' || nextval('public.order_code_seq');
end;
$$;
revoke execute on function public.next_order_code() from public, anon;
grant execute on function public.next_order_code() to authenticated;
revoke usage, select, update on sequence public.order_code_seq from anon, authenticated;

-- ---------- Orders ----------
create or replace function public.prepare_order()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  units integer;
  q record;
  reprice boolean;
begin
  if tg_op = 'INSERT' then
    new.code := public.next_order_code();
    if not public.is_staff() then
      new.user_id := (select auth.uid());
      new.status := 'received';
      new.payment_status := 'unpaid';
      new.pages_written := 0;
      new.rider_name := null;
      new.eta := null;
    end if;
  else
    -- Status flow: delivered and cancelled are final; writing needs a paid order.
    if new.status is distinct from old.status and not public.is_server_role() then
      if old.status in ('delivered', 'cancelled') then
        raise exception 'Order % is already %', old.code, old.status;
      end if;
      if new.status in ('writing', 'quality_check', 'out_for_delivery', 'delivered') and new.payment_status <> 'paid' then
        raise exception 'Order % is not paid yet', old.code;
      end if;
    end if;
  end if;
  new.admin_note := null; -- internal notes live in public.order_notes

  if new.paper not in ('plain-notebook', 'ruled-notebook') then
    new.notebook_source := 'new';
  end if;
  if new.paper <> 'premium-card' then
    new.copies := 1;
  end if;
  if (case when new.paper = 'premium-card' then new.copies else new.page_count end) < 1 then
    raise exception 'An order needs at least one page or card';
  end if;
  if new.handwriting_profile_id is not null and not exists (
    select 1 from public.handwriting_profiles h where h.id = new.handwriting_profile_id and h.user_id = new.user_id
  ) then
    raise exception 'That handwriting style belongs to another account';
  end if;

  reprice := tg_op = 'INSERT' or (
    old.payment_status = 'unpaid' and (
      new.paper is distinct from old.paper or new.page_count is distinct from old.page_count
      or new.copies is distinct from old.copies or new.notebook_source is distinct from old.notebook_source
    )
  );
  if reprice then
    units := case when new.paper = 'premium-card' then new.copies else new.page_count end;
    select * into q from public.price_order_v2(new.paper, units, new.notebook_source);
    new.billable_units := q.billable_units;
    new.unit_price := q.unit_price;
    new.writing_amount := q.writing_amount;
    new.notebook_amount := q.notebook_amount;
    new.delivery_amount := q.delivery_amount;
    new.total := q.total;
  else
    new.billable_units := old.billable_units;
    new.unit_price := old.unit_price;
    new.writing_amount := old.writing_amount;
    new.notebook_amount := old.notebook_amount;
    new.delivery_amount := old.delivery_amount;
    new.total := old.total;
  end if;

  if new.status = 'delivered' and new.delivered_at is null then
    new.delivered_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- A customer's own notebook: plausible sizes, with room to write.
alter table public.orders drop constraint if exists orders_notebook_spec_check;
alter table public.orders add constraint orders_notebook_spec_check check (
  notebook_spec is null or (
    jsonb_typeof(notebook_spec -> 'width_mm') = 'number'
    and jsonb_typeof(notebook_spec -> 'height_mm') = 'number'
    and (notebook_spec ->> 'width_mm')::numeric between 50 and 400
    and (notebook_spec ->> 'height_mm')::numeric between 50 and 500
    and (notebook_spec -> 'line_pitch_mm' is null or jsonb_typeof(notebook_spec -> 'line_pitch_mm') = 'null'
         or (jsonb_typeof(notebook_spec -> 'line_pitch_mm') = 'number' and (notebook_spec ->> 'line_pitch_mm')::numeric between 3 and 20))
    and (notebook_spec -> 'margin_mm' is null or jsonb_typeof(notebook_spec -> 'margin_mm') = 'null'
         or (jsonb_typeof(notebook_spec -> 'margin_mm') = 'number'
             and (notebook_spec ->> 'margin_mm')::numeric between 0 and 60
             and (notebook_spec ->> 'width_mm')::numeric - (notebook_spec ->> 'margin_mm')::numeric >= 40))
  )
);

-- Demo payment: switchable, and only for a live, priced order.
create or replace function public.demo_mark_paid(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select value = 'true'::jsonb from public.app_settings where key = 'demo_payments'), false) is not true then
    raise exception 'Demo payments are switched off';
  end if;
  update public.orders
     set payment_status = 'paid'
   where id = p_order_id
     and user_id = (select auth.uid())
     and payment_status = 'unpaid'
     and status <> 'cancelled'
     and total > 0;
  if not found then
    raise exception 'Order not found, already paid, cancelled or empty';
  end if;
end;
$$;
revoke execute on function public.demo_mark_paid(uuid) from public, anon;
grant execute on function public.demo_mark_paid(uuid) to authenticated;

-- Customers can cancel their own order while it's still unpaid.
create or replace function public.cancel_my_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders
     set status = 'cancelled'
   where id = p_order_id
     and user_id = (select auth.uid())
     and status = 'received'
     and payment_status = 'unpaid';
  if not found then
    raise exception 'Only an unpaid order that has not started can be cancelled';
  end if;
end;
$$;
revoke execute on function public.cancel_my_order(uuid) from public, anon;
grant execute on function public.cancel_my_order(uuid) to authenticated;

-- ---------- Internal notes ----------
create table if not exists public.order_notes (
  order_id uuid primary key references public.orders (id) on delete cascade,
  note text not null default '' check (char_length(note) <= 2000),
  updated_at timestamptz not null default now()
);
alter table public.order_notes enable row level security;
drop policy if exists "order_notes: admin" on public.order_notes;
create policy "order_notes: admin" on public.order_notes
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
insert into public.order_notes (order_id, note)
  select id, admin_note from public.orders where admin_note is not null and admin_note <> ''
  on conflict (order_id) do nothing;
update public.orders set admin_note = null where admin_note is not null;

-- ---------- Files the customer attaches ----------
create or replace function public.guard_order_file()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_server_role() and not exists (
    select 1 from public.orders o
    where o.id = new.order_id
      and new.path like o.user_id::text || '/' || o.id::text || '/%'
  ) then
    raise exception 'File path must be inside the order''s own folder';
  end if;
  return new;
end;
$$;
drop trigger if exists order_files_guard on public.order_files;
create trigger order_files_guard
  before insert or update on public.order_files
  for each row execute function public.guard_order_file();
create unique index if not exists order_files_order_path_idx on public.order_files (order_id, path);
revoke execute on function public.guard_order_file() from public, anon, authenticated;

-- ---------- Handwriting ----------
create or replace function public.guard_handwriting()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_staff() then
    if tg_op = 'INSERT' then
      if new.scan_path is null or new.scan_path not like (select auth.uid())::text || '/%' then
        raise exception 'Handwriting scans must be in your own folder';
      end if;
      new.status := 'uploaded';
      new.glyph_set := null;
      new.missing_chars := '';
      new.review_note := null;
    else
      -- customers may only rename
      new.status := old.status;
      new.glyph_set := old.glyph_set;
      new.missing_chars := old.missing_chars;
      new.review_note := old.review_note;
      new.scan_path := old.scan_path;
    end if;
  elsif tg_op = 'UPDATE' and not public.is_server_role()
        and old.status = 'needs_rescan' and new.status = 'ready' then
    raise exception 'This handwriting was sent back for a rescan; approve the new scan instead';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- Smaller fixes ----------
create unique index if not exists addresses_user_label_idx on public.addresses (user_id, lower(label));
create index if not exists order_feedback_user_idx on public.order_feedback (user_id);
