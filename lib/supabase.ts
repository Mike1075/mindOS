'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

// URL 与 publishable key 在设计上是可公开的（安全由 RLS 保证）。env 优先，回退到内嵌默认值，
// 这样部署无需额外配置即可工作；要覆盖时在 Vercel/本地设 NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY。
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://jsionqxnnmyegdicsozw.supabase.co'
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_7zyhl-Aj2tQHi0_RysF3nw_ETF5lBqg'

let client: ReturnType<typeof createBrowserClient<Database>> | null = null

export function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  if (!client) {
    client = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
  }
  return client
}
