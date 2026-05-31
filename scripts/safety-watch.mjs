// 心镜 MindOS — 安全监测日报（P0：测试期人工监测的最小实现）
// 只读拉取 safety_events（熔断）+ vails_interventions（慢性防护），并带出触发的真实消息正文。
// 需要直连数据库（service_role 级，绕过 RLS 才能读到消息正文）。
//
// 一次性配置：在 .env.local 加一行（Supabase 控制台 → Settings → Database → Connection string，
//   选 "Session pooler" 那条 URI，把 [YOUR-PASSWORD] 换成数据库密码）：
//   SUPABASE_DB_URL=postgresql://postgres.xxxx:PASSWORD@aws-...pooler.supabase.com:5432/postgres
//
// 用法： node --env-file=.env.local scripts/safety-watch.mjs [天数=7]

import pg from 'pg'

const DAYS = Number(process.argv[2] || 7)
const url = process.env.SUPABASE_DB_URL
if (!url) {
  console.error('缺少 SUPABASE_DB_URL（见本文件顶部注释的一次性配置说明）')
  process.exit(1)
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()

const fmt = (t) => new Date(t).toLocaleString('zh-CN', { hour12: false })
const line = (n = 60) => console.log('─'.repeat(n))

// ── 概览 ──
const overview = (await client.query(`
  select
    (select count(*) from public.safety_events       where occurred_at > now() - interval '${DAYS} days') as safety_n,
    (select count(distinct user_id) from public.safety_events where occurred_at > now() - interval '${DAYS} days') as safety_users,
    (select count(*) from public.vails_interventions where acted_at    > now() - interval '${DAYS} days') as vails_n
`)).rows[0]

console.log(`\n心镜 · 安全监测日报（近 ${DAYS} 天）  生成于 ${fmt(Date.now())}`)
line()
console.log(`熔断事件 ${overview.safety_n} 起，涉及 ${overview.safety_users} 名用户 ｜ VAILs 慢性干预 ${overview.vails_n} 起`)

// ── 熔断事件（带触发消息正文 + 镜子回应）──
const safety = (await client.query(`
  select se.occurred_at, se.trigger_type, se.action_taken, se.risk_category, se.matched_pattern,
         se.user_id, se.conversation_id,
         um.content as user_msg,
         mm.content as mirror_reply
  from public.safety_events se
  left join public.messages um on um.id = se.message_id
  left join public.messages mm
    on mm.conversation_id = se.conversation_id and mm.seq = um.seq + 1 and mm.role = 'mirror'
  where se.occurred_at > now() - interval '${DAYS} days'
  order by se.occurred_at desc
`)).rows

console.log(`\n【熔断事件】（合规关键，逐条人工过目）`)
line()
if (!safety.length) console.log('（无）')
for (const e of safety) {
  console.log(`\n⏱ ${fmt(e.occurred_at)}  [${e.trigger_type} → ${e.action_taken}]  风险:${e.risk_category || '-'}  命中:${e.matched_pattern || '-'}`)
  console.log(`   用户(${(e.user_id || '匿名').slice(0, 8)}) 会话(${(e.conversation_id || '-').slice(0, 8)})`)
  console.log(`   用户原话：${e.user_msg ? e.user_msg.replace(/\n+/g, ' ') : '（未关联消息）'}`)
  console.log(`   镜子回应：${e.mirror_reply ? e.mirror_reply.replace(/\n+/g, ' ').slice(0, 160) : '（无）'}`)
}

// ── VAILs 慢性防护干预 ──
const vails = (await client.query(`
  select vi.acted_at, vi.rule, vi.action_taken, vi.trigger_detail, vi.user_id
  from public.vails_interventions vi
  where vi.acted_at > now() - interval '${DAYS} days'
  order by vi.acted_at desc
`)).rows

console.log(`\n\n【VAILs 慢性防护干预】（雪球危害留痕）`)
line()
if (!vails.length) console.log('（无）')
for (const v of vails) {
  console.log(`⏱ ${fmt(v.acted_at)}  ${v.rule} → ${v.action_taken}  用户(${(v.user_id || '-').slice(0, 8)})  依据:${JSON.stringify(v.trigger_detail)}`)
}

console.log('')
await client.end()
