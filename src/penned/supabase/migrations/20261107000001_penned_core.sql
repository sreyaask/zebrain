-- Penned core schema: profiles, handwriting styles, orders, timeline, plotter jobs.
-- Prices are always computed in the database so a client can't send its own total.


-- ---------- Types ----------
create type public.user_role as enum ('customer', 'admin');
create type public.ink_colour as enum ('blue', 'black');
create type public.paper_id as enum ('plain-notebook', 'ruled-notebook', 'loose-a4', 'premium-card');
create type public.page_size_id as enum ('b5', 'a4', 'a5', 'a6');
create type public.handwriting_status as enum ('uploaded', 'processing', 'ready', 'needs_rescan');
create type public.order_status as enum ('received', 'writing', 'quality_check', 'out_for_delivery', 'delivered', 'cancelled');
create type public.payment_status as enum ('unpaid', 'paid', 'failed', 'refunded');
create type public.delivery_area as enum (
  'Gachibowli', 'Kondapur', 'Madhapur', 'Hitech City', 'Kukatpally',
  'Banjara Hills', 'Jubilee Hills', 'Ameerpet', 'Secunderabad', 'LB Nagar'
);
create type public.time_slot as enum ('within-3h', '6-8pm', '8-10pm', 'tomorrow-9-11am');

-- ---------- Profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin');
$$;

-- Trusted callers: an admin user, or a server-side role (SQL editor, service role).
-- Must not be security definer, so current_user is the real calling role.
create or replace function public.is_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user not in ('authenticated', 'anon') or public.is_admin();
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Customers may edit their name and phone, never their role.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and not public.is_staff() then
    raise exception 'Only an admin can change roles';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------- Addresses ----------
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  line1 text not null check (char_length(line1) between 5 and 200),
  area public.delivery_area not null,
  pincode text not null check (pincode ~ '^5[0-9]{5}$'),
  landmark text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index addresses_user_idx on public.addresses (user_id);

-- ---------- Handwriting styles ----------
create table public.handwriting_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 60),
  ink public.ink_colour not null default 'blue',
  status public.handwriting_status not null default 'uploaded',
  scan_path text not null,              -- storage: handwriting/<user_id>/<file>
  glyph_set jsonb,                      -- produced by the admin portal's engine
  missing_chars text not null default '',
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index handwriting_user_idx on public.handwriting_profiles (user_id);

create or replace function public.guard_handwriting()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_staff() then
    if tg_op = 'INSERT' then
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
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger handwriting_guard
  before insert or update on public.handwriting_profiles
  for each row execute function public.guard_handwriting();

-- ---------- Pricing (mirrors lib/pricing.ts) ----------
create or replace function public.price_order(p_paper public.paper_id, p_units integer)
returns table (billable_units integer, unit_price integer, writing_amount integer, delivery_amount integer, total integer)
language sql
immutable
set search_path = ''
as $$
  with b as (
    select
      case when p_paper in ('plain-notebook', 'ruled-notebook') then greatest(30, greatest(p_units, 0)) else greatest(p_units, 0) end as units,
      case when p_paper = 'premium-card' then 15 else 9 end as price
  )
  select
    b.units,
    b.price,
    b.units * b.price,
    case when b.units * b.price = 0 or b.units * b.price > 500 then 0 else 49 end,
    b.units * b.price + case when b.units * b.price = 0 or b.units * b.price > 500 then 0 else 49 end
  from b;
$$;

-- ---------- Orders ----------
create sequence public.order_code_seq start 1043;
grant usage on sequence public.order_code_seq to authenticated;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid not null references auth.users (id) on delete restrict default auth.uid(),
  handwriting_profile_id uuid references public.handwriting_profiles (id) on delete set null,
  title text not null default '' check (char_length(title) <= 120),
  status public.order_status not null default 'received',
  payment_status public.payment_status not null default 'unpaid',

  -- content
  source_mode text not null check (source_mode in ('files', 'text')),
  source_text text not null default '' check (char_length(source_text) <= 200000),

  -- layout (see LayoutSettings in lib/pricing.ts)
  paper public.paper_id not null,
  ink public.ink_colour not null default 'blue',
  page_size public.page_size_id not null default 'b5',
  margin_mm numeric(4,1) not null default 18 check (margin_mm between 8 and 40),
  line_spacing numeric(3,2) not null default 1.3 check (line_spacing between 0.8 and 2.5),
  heading_style text not null default 'underline' check (heading_style in ('underline', 'larger', 'plain')),

  -- quantity and price (price columns are set by trigger)
  copies integer not null default 1 check (copies between 1 and 500),
  page_count integer not null default 0 check (page_count between 0 and 2000),
  billable_units integer not null default 0,
  unit_price integer not null default 0,
  writing_amount integer not null default 0,
  delivery_amount integer not null default 0,
  total integer not null default 0,

  -- delivery
  receiver_name text not null check (char_length(receiver_name) between 1 and 80),
  receiver_phone text not null check (receiver_phone ~ '^[6-9][0-9]{9}$'),
  address_line1 text not null check (char_length(address_line1) between 5 and 200),
  area public.delivery_area not null,
  pincode text not null check (pincode ~ '^5[0-9]{5}$'),
  landmark text,
  time_slot public.time_slot not null,

  -- fulfilment (admin only)
  pages_written integer not null default 0,
  rider_name text,
  eta text,
  admin_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at);

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

  units := case when new.paper = 'premium-card' then new.copies else new.page_count end;
  select * into q from public.price_order(new.paper, units);
  new.billable_units := q.billable_units;
  new.unit_price := q.unit_price;
  new.writing_amount := q.writing_amount;
  new.delivery_amount := q.delivery_amount;
  new.total := q.total;

  if new.status = 'delivered' and new.delivered_at is null then
    new.delivered_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger orders_prepare
  before insert or update on public.orders
  for each row execute function public.prepare_order();

-- Files the customer uploaded with an order (storage: uploads/<user_id>/<order_id>/<file>)
create table public.order_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  path text not null,
  kind text not null check (kind in ('image', 'pdf')),
  pages integer not null default 1 check (pages between 1 and 500),
  created_at timestamptz not null default now()
);
create index order_files_order_idx on public.order_files (order_id);

-- Timeline shown on the tracking screen
create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  status public.order_status not null,
  note text,
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

create or replace function public.log_order_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_events (order_id, status, note) values (new.id, new.status, 'Order received');
  elsif new.status is distinct from old.status then
    insert into public.order_events (order_id, status, note)
    values (new.id, new.status, case new.status
      when 'writing' then 'Writing started'
      when 'quality_check' then 'Every page is being checked'
      when 'out_for_delivery' then coalesce(new.rider_name || ' is on the way', 'Out for delivery')
      when 'delivered' then 'Delivered'
      when 'cancelled' then 'Order cancelled'
      else null end);
  end if;
  return new;
end;
$$;

create trigger orders_log_event
  after insert or update of status on public.orders
  for each row execute function public.log_order_event();

-- Plotter output generated by the admin portal (storage: plotter/<order_id>/...)
create table public.plotter_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  page_count integer not null,
  svg_path text not null,
  gcode_path text not null,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index plotter_jobs_order_idx on public.plotter_jobs (order_id, created_at desc);

-- Early list (public sign-up from the website)
create table public.early_list (
  id bigint generated always as identity primary key,
  email text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  area public.delivery_area,
  created_at timestamptz not null default now()
);

-- Demo payment: marks an unpaid order as paid. Replace with a payment-gateway webhook before launch.
create or replace function public.demo_mark_paid(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders
     set payment_status = 'paid'
   where id = p_order_id
     and user_id = (select auth.uid())
     and payment_status = 'unpaid';
  if not found then
    raise exception 'Order not found or already paid';
  end if;
end;
$$;

-- ---------- Row level security ----------
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.handwriting_profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_files enable row level security;
alter table public.order_events enable row level security;
alter table public.plotter_jobs enable row level security;
alter table public.early_list enable row level security;

create policy "profiles: read own or admin" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles: update own or admin" on public.profiles
  for update to authenticated using (id = (select auth.uid()) or (select public.is_admin()));

create policy "addresses: own" on public.addresses
  for all to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()));

create policy "handwriting: read own or admin" on public.handwriting_profiles
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "handwriting: insert own" on public.handwriting_profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "handwriting: update own or admin" on public.handwriting_profiles
  for update to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "handwriting: delete own" on public.handwriting_profiles
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "orders: read own or admin" on public.orders
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "orders: insert own" on public.orders
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "orders: admin update" on public.orders
  for update to authenticated using ((select public.is_admin()));

create policy "order_files: read own or admin" on public.order_files
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "order_files: insert own" on public.order_files
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
  );

create policy "order_events: read own or admin" on public.order_events
  for select to authenticated using (
    (select public.is_admin())
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
  );

create policy "plotter_jobs: admin" on public.plotter_jobs
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "early_list: anyone can join" on public.early_list
  for insert to anon, authenticated with check (true);

revoke execute on function public.demo_mark_paid(uuid) from anon, public;
grant execute on function public.demo_mark_paid(uuid) to authenticated;

-- ---------- Storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('handwriting', 'handwriting', false, 20971520, array['image/jpeg', 'image/png', 'image/heic', 'image/webp']),
  ('uploads', 'uploads', false, 20971520, array['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf']),
  ('plotter', 'plotter', false, 52428800, array['image/svg+xml', 'text/plain'])
on conflict (id) do nothing;

create policy "storage: customers upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('handwriting', 'uploads') and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "storage: customers read own folder" on storage.objects
  for select to authenticated
  using (bucket_id in ('handwriting', 'uploads') and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "storage: admin full access" on storage.objects
  for all to authenticated
  using (bucket_id in ('handwriting', 'uploads', 'plotter') and (select public.is_admin()))
  with check (bucket_id in ('handwriting', 'uploads', 'plotter') and (select public.is_admin()));

-- ---------- Realtime (live tracking) ----------
alter publication supabase_realtime add table public.orders, public.order_events;
