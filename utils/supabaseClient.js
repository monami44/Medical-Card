import { createClient } from "@supabase/supabase-js";

export const supabaseClient = () => {
  console.log("Creating Supabase client");
  console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log("Supabase Anon Key set:", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  return supabase;
};