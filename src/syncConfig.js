// 这里只放可以公开在网页里的 Supabase 连接信息。
// VITE_SUPABASE_PUBLISHABLE_KEY 必须是 publishable key，绝不能使用 secret/service_role key。
export const syncConfig = {
  url: (import.meta.env.VITE_SUPABASE_URL || 'https://awsiulvskesqagucpxrr.supabase.co').replace(/\/$/, ''),
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_biAxflBw7Lm4ianAbkzdoA_Rw7Ara8_',
}
