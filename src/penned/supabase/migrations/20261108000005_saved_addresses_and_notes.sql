-- Saved addresses with a label and receiver, and delivery instructions on orders (8 Nov 2026).
alter table public.addresses
  add column if not exists label text not null default 'Home' check (char_length(label) between 1 and 30),
  add column if not exists receiver_name text check (receiver_name is null or char_length(receiver_name) between 1 and 80),
  add column if not exists receiver_phone text check (receiver_phone is null or receiver_phone ~ '^[6-9][0-9]{9}$');

alter table public.orders
  add column if not exists delivery_note text check (delivery_note is null or char_length(delivery_note) <= 200);
