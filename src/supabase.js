import { createClient } from '@supabase/supabase-js'

// Browser-side Supabase client, used only to upload event media straight to
// Storage via a server-minted signed URL (so large files skip the serverless
// request-size limit). Uses the browser-safe publishable/anon key — never the
// service-role key. Null when the VITE_ env vars aren't set.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && anonKey ? createClient(url, anonKey) : null
export const storageConfigured = Boolean(supabase)
