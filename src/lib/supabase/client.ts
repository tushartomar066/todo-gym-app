import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set'
    )
  }

  // createBrowserClient manages document.cookie natively — no custom override
  // needed. Custom set/remove no-ops were previously breaking logout and token
  // refresh on the client side.
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
