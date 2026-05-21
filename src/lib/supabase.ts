/**
 * ThinkSync OS — Supabase Client (Reserved)
 *
 * All database access is routed through the backend API (FastAPI → Supabase).
 * This module is reserved for future direct client features (auth, realtime).
 * It will be configured when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Only create a functional client when credentials are configured
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
