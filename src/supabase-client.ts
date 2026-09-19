import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = String(
  import.meta.env.VITE_SUPABASE_URL ?? "",
).trim();
const supabaseAnonKey = String(
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
).trim();

export const supabaseConfigError =
  !supabaseUrl || !supabaseAnonKey
    ? "This site was built without VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Add both in Vercel → Settings → Environment Variables (Production and Preview), then Redeploy."
    : null;

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder",
);
