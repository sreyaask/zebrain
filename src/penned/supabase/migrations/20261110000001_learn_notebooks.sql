-- Learn notebooks from orders (10 Nov 2026). The catalog started empty, so every barcode scan ended in "measure it".
-- When a customer orders sheets for their own notebook with a barcode and measurements, that notebook is added to the
-- catalog (if it isn't there yet), so the next customer with the same notebook just scans. Admins can correct entries.
create or replace function public.learn_notebook()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.notebook_source = 'own' and new.notebook_barcode is not null and new.notebook_spec is not null then
    begin
      insert into public.notebook_catalog (barcode, name, width_mm, height_mm, line_pitch_mm, margin_mm, ruled)
      values (
        new.notebook_barcode,
        coalesce(nullif(new.notebook_spec ->> 'name', ''), 'Notebook ' || right(new.notebook_barcode, 4)),
        (new.notebook_spec ->> 'width_mm')::numeric,
        (new.notebook_spec ->> 'height_mm')::numeric,
        nullif(new.notebook_spec ->> 'line_pitch_mm', '')::numeric,
        nullif(new.notebook_spec ->> 'margin_mm', '')::numeric,
        coalesce((new.notebook_spec ->> 'ruled')::boolean, true)
      )
      on conflict (barcode) do nothing;
    exception when others then
      null; -- learning is best-effort: never block the customer's order
    end;
  end if;
  return new;
end;
$$;
revoke execute on function public.learn_notebook() from public, anon, authenticated;

drop trigger if exists orders_learn_notebook on public.orders;
create trigger orders_learn_notebook
  after insert on public.orders
  for each row execute function public.learn_notebook();
