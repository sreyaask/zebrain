-- Pricing v3 (9 Nov 2026): ₹12 a page; a new long notebook (ruled or plain) is ₹55; cards stay ₹15.
-- "Sheets for my notebook" (notebook_source = 'own'): we send ruled A4 sheets in the customer's notebook format
-- to cut and stick in, so there is no notebook charge and no pickup. Delivery ₹49, free above ₹500.
-- Orders already placed keep their price (prepare_order only reprices unpaid orders whose inputs change).

create or replace function public.price_order_v3(p_paper public.paper_id, p_units integer, p_notebook_source text)
returns table (billable_units integer, unit_price integer, writing_amount integer, notebook_amount integer, delivery_amount integer, total integer)
language sql
immutable
set search_path = ''
as $$
  with b as (
    select
      greatest(p_units, 0) as units,
      case when p_paper = 'premium-card' then 15 else 12 end as price,
      case when p_paper in ('plain-notebook', 'ruled-notebook') and coalesce(p_notebook_source, 'new') = 'new' and p_units > 0 then 55 else 0 end as notebook
  ), s as (
    select units, price, units * price as writing, notebook, units * price + notebook as subtotal from b
  )
  select s.units, s.price, s.writing, s.notebook,
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
    select * into q from public.price_order_v3(new.paper, units, new.notebook_source);
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

-- AI reading of notes (photos/PDFs → text and diagrams) is built but off until the team switches it on.
insert into public.app_settings (key, value) values ('ai_extraction', 'false'::jsonb) on conflict (key) do nothing;
