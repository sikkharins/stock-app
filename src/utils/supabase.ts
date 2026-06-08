import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://lqgvwxyjzpsoflczyzik.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxZ3Z3eHlqenBzb2ZsY3p5emlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyOTgzMzMsImV4cCI6MjA5NDg3NDMzM30.9lqlt-LObeDAoh9jOr00wEZHP9z3iuBcyAkFi7RUtDY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
