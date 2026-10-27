import "server-only"; // build fails if a browser page ever imports this (keeps keys off the client)
import { supabaseServer } from "@/lib/supabase/server";

// Admins are the emails in ADMIN_EMAILS (comma-separated). Checked on the server for every admin request.
export async function adminUser() {
  const { data: { user } } = await supabaseServer().auth.getUser();
  const allowed = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!user?.email || !allowed.includes(user.email.toLowerCase())) return null;
  return user;
}
