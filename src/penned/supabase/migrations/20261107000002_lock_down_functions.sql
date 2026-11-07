-- Trigger functions are never called directly through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.log_order_event() from public, anon, authenticated;
-- is_admin() is used by row-level security for signed-in users only.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
