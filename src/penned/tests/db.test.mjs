// Database rules, checked against every migration on an in-memory Postgres (PGlite) with stubbed Supabase auth/storage.
// Run: node --test tests/db.test.mjs
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");
const CUSTOMER = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const ADMIN = "33333333-3333-3333-3333-333333333333";
let db;

const STUBS = `create role anon nologin; create role authenticated nologin; create schema auth; create schema storage;
create table auth.users (id uuid primary key, phone text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text); alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
create publication supabase_realtime; grant usage on schema public, auth, storage to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;`;

async function migrate(files) {
  for (const f of files) await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
}

/** Runs SQL as a signed-in user (RLS and triggers apply). Returns rows, or throws. */
async function as(user, sql) {
  await db.exec(`reset role; select set_config('request.jwt.sub', '${user}', false); set role authenticated;`);
  try {
    return (await db.query(sql)).rows;
  } finally {
    await db.exec("reset role; select set_config('request.jwt.sub', '', false);");
  }
}

const orderSql = (paper, pages, copies = 1, extra = {}) => {
  const cols = { source_mode: "'text'", paper: `'${paper}'`, page_count: pages, copies, receiver_name: "'A'",
    receiver_phone: "'9848012345'", address_line1: "'Flat 302, Sai Residency'", area: "'Kondapur'", pincode: "'500084'",
    time_slot: "'6-8pm'", ...extra };
  return `insert into public.orders (${Object.keys(cols).join(",")}) values (${Object.values(cols).join(",")}) returning *`;
};

let oldOrderId;
before(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  // An order placed under the first pricing, before the later migrations: it must keep its price.
  await migrate(files.slice(0, 2));
  await db.exec(`insert into auth.users (id) values ('${CUSTOMER}'), ('${OTHER}'), ('${ADMIN}')`);
  oldOrderId = (await db.query(orderSql("ruled-notebook", 20, 1, { user_id: `'${CUSTOMER}'` }))).rows[0].id;
  await migrate(files.slice(2));
  await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated;
    update public.profiles set role = 'admin' where id = '${ADMIN}';
    update public.orders set payment_status = 'paid' where id = '${oldOrderId}';`);
});

test("status changes never reprice an order placed under older prices", async () => {
  const before = (await db.query(`select total from public.orders where id = '${oldOrderId}'`)).rows[0].total;
  await as(ADMIN, `update public.orders set status = 'writing' where id = '${oldOrderId}'`);
  const after = (await db.query(`select total, status from public.orders where id = '${oldOrderId}'`)).rows[0];
  assert.equal(before, 319);
  assert.equal(after.total, 319);
  assert.equal(after.status, "writing");
});

test("prices come from the server: 10 ruled pages with a new notebook = 120 + 55 + 49", async () => {
  const [o] = await as(CUSTOMER, orderSql("ruled-notebook", 10, 1, { total: 1, notebook_amount: 0 }));
  assert.equal(o.total, 224);
  const [own] = await as(CUSTOMER, orderSql("ruled-notebook", 10, 1, { notebook_source: "'own'", page_size: "'long'" }));
  assert.equal(own.total, 120 + 49);
});

test("an order needs at least one page, and notebooks are one copy", async () => {
  await assert.rejects(as(CUSTOMER, orderSql("loose-a4", 0)), /at least one page/);
  const [o] = await as(CUSTOMER, orderSql("ruled-notebook", 5, 500));
  assert.equal(o.copies, 1);
});

test("demo payment never pays a cancelled order, and can be switched off", async () => {
  const [o] = await as(CUSTOMER, orderSql("ruled-notebook", 5));
  await as(CUSTOMER, `select public.cancel_my_order('${o.id}')`);
  await assert.rejects(as(CUSTOMER, `select public.demo_mark_paid('${o.id}')`), /cancelled/);
  const [p] = await as(CUSTOMER, orderSql("ruled-notebook", 5));
  await db.exec(`update public.app_settings set value = 'false' where key = 'demo_payments'`);
  await assert.rejects(as(CUSTOMER, `select public.demo_mark_paid('${p.id}')`), /switched off/);
  await db.exec(`update public.app_settings set value = 'true' where key = 'demo_payments'`);
  await as(CUSTOMER, `select public.demo_mark_paid('${p.id}')`);
  await assert.rejects(as(CUSTOMER, `select public.cancel_my_order('${p.id}')`), /unpaid/);
});

test("writing can't start before payment, and delivered/cancelled orders are final", async () => {
  const [o] = await as(CUSTOMER, orderSql("ruled-notebook", 5));
  await assert.rejects(as(ADMIN, `update public.orders set status = 'writing' where id = '${o.id}'`), /not paid/);
  await as(ADMIN, `update public.orders set status = 'cancelled' where id = '${o.id}'`);
  await assert.rejects(as(ADMIN, `update public.orders set status = 'received' where id = '${o.id}'`), /already cancelled/);
});

test("file paths and handwriting styles must belong to the customer", async () => {
  const [o] = await as(CUSTOMER, orderSql("ruled-notebook", 5));
  await assert.rejects(
    as(CUSTOMER, `insert into public.order_files (order_id, path, kind) values ('${o.id}', '${OTHER}/x/1.jpg', 'image')`),
    /own folder/,
  );
  await as(CUSTOMER, `insert into public.order_files (order_id, path, kind) values ('${o.id}', '${CUSTOMER}/${o.id}/1.jpg', 'image')`);
  await assert.rejects(
    as(CUSTOMER, `insert into public.handwriting_profiles (name, ink, scan_path) values ('x', 'blue', '${OTHER}/a.jpg')`),
    /own folder/,
  );
  const [style] = await as(OTHER, `insert into public.handwriting_profiles (name, ink, scan_path) values ('x', 'blue', '${OTHER}/a.jpg') returning id`);
  await assert.rejects(as(CUSTOMER, orderSql("ruled-notebook", 5, 1, { handwriting_profile_id: `'${style.id}'` })), /another account/);
});

test("handwriting sent back for a rescan can't be approved", async () => {
  const [h] = await as(CUSTOMER, `insert into public.handwriting_profiles (name, ink, scan_path) values ('x', 'blue', '${CUSTOMER}/a.jpg') returning id`);
  await as(ADMIN, `update public.handwriting_profiles set status = 'needs_rescan' where id = '${h.id}'`);
  await assert.rejects(as(ADMIN, `update public.handwriting_profiles set status = 'ready' where id = '${h.id}'`), /rescan/);
});

test("internal notes are admin-only and never stored on the order", async () => {
  const [o] = await as(CUSTOMER, orderSql("ruled-notebook", 5));
  await as(ADMIN, `update public.orders set admin_note = 'secret' where id = '${o.id}'`);
  assert.equal((await as(CUSTOMER, `select admin_note from public.orders where id = '${o.id}'`))[0].admin_note, null);
  await as(ADMIN, `insert into public.order_notes (order_id, note) values ('${o.id}', 'secret')`);
  assert.equal((await as(CUSTOMER, `select * from public.order_notes`)).length, 0);
});

test("own-notebook measurements must leave room to write", async () => {
  const spec = (w, m) => `'{"width_mm": ${w}, "height_mm": 200, "margin_mm": ${m}, "line_pitch_mm": 7, "ruled": true}'::jsonb`;
  await assert.rejects(as(CUSTOMER, orderSql("ruled-notebook", 5, 1, { notebook_source: "'own'", notebook_spec: spec(50, 30) })), /notebook_spec/);
  await as(CUSTOMER, orderSql("ruled-notebook", 5, 1, { notebook_source: "'own'", notebook_spec: spec(176, 20) }));
});

test("customers can't read or write app settings or burn order codes", async () => {
  assert.equal((await as(CUSTOMER, "select * from public.app_settings")).length, 0);
  await assert.rejects(as(CUSTOMER, "select nextval('public.order_code_seq')"), /permission denied/);
});

test("order codes can only be taken by placing an order", async () => {
  await assert.rejects(as(CUSTOMER, "select public.next_order_code()"), /assigned when an order is placed/);
});

test("a measured notebook is remembered for the next customer who scans it", async () => {
  const spec = `'{"width_mm": 172, "height_mm": 270, "line_pitch_mm": 7.5, "margin_mm": 22, "ruled": true}'::jsonb`;
  await as(CUSTOMER, orderSql("ruled-notebook", 3, 1, { notebook_source: "'own'", notebook_barcode: "'8901234567897'", notebook_spec: spec }));
  const [hit] = await as(OTHER, "select width_mm, height_mm, line_pitch_mm, ruled from public.notebook_catalog where barcode = '8901234567897'");
  assert.equal(Number(hit.width_mm), 172);
  assert.equal(Number(hit.line_pitch_mm), 7.5);
  assert.equal(hit.ruled, true);
});
