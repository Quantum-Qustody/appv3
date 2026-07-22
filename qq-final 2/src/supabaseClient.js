// Shared Supabase client — a single GoTrue instance for the whole app.
// Extracted so feature modules (e.g. designPartner.jsx) can use the same
// client without importing App.jsx and creating a circular dependency.
import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase environment variables. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");

export const FUNCTIONS_URL = `${supabaseUrl}/functions/v1`;
