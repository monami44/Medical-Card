import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const supabaseClient = (): SupabaseClient => {
  console.log("Creating Supabase client");
  console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log("Supabase Anon Key set:", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase URL or Anon Key is not set in environment variables");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  return supabase;
};