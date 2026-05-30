// 心镜 MindOS — 模拟原始数据生成（供分析层/镜子报告/VAILs/安全 参考）
// 用法: node scripts/seed-sim.mjs
// 全部经 Supabase REST 写入（触发器自动产出派生数据）。sim 用户 profiles.display_name 标记为 __sim__，可一键清除。
// 清除: delete from auth.users where id in (select id from public.profiles where display_name='__sim__');

const URL = 'https://jsionqxnnmyegdicsozw.supabase.co'
const KEY = 'sb_publishable_7zyhl-Aj2tQHi0_RysF3nw_ETF5lBqg'

const POOLS = {
  worthless: ['我又把项目搞砸了，觉得自己真没用', '感觉我就是个废物，什么都做不好', '努力了还是失败，我大概一无是处吧', '看着同事都比我强，我太没用了，做什么都不行'],
  intensity: ['我快崩溃了，真的受不了了！！', '压力太大了，喘不过气，快撑不下去了！', '我太难受了，整个人都要碎掉了！'],
  crisis: ['有时候觉得活着真的没什么意思了', '我撑不住了，真的不想再醒来了'],
  rumination: ['要是当年没辞那份工作就好了，我老在想这个', '早知道会这样，我当初就不该相信他'],
  external: ['都是他害的，我才变成现在这样', '要不是家里一直逼我，我不会这么累'],
  felt: ['说这些的时候，我胸口闷闷的，压着一块东西', '一想到明天，我喉咙就发紧'],
  neutral: ['今天还行，就是有点累', '刚下班，随便聊聊', '天气不错，心情一般般', '嗯……其实我也不知道想说什么'],
}
const MIRROR = ['嗯。', '这个感觉，现在在你身体的哪里？', '它来过多久了？', '嗯，我在。', '此刻，你坐在哪里？']

// 12 个模拟用户的人格（决定消息构成 + 会话数）
const PERSONAS = [
  { tag: 'recurring_worthless', pools: ['worthless', 'worthless', 'felt'], convos: 2 },
  { tag: 'recurring_worthless', pools: ['worthless', 'neutral', 'worthless'], convos: 2 },
  { tag: 'recurring_worthless', pools: ['worthless', 'rumination', 'worthless'], convos: 1 },
  { tag: 'high_intensity', pools: ['intensity', 'intensity', 'intensity'], convos: 1 },
  { tag: 'high_intensity', pools: ['intensity', 'felt', 'intensity'], convos: 1 },
  { tag: 'crisis', pools: ['rumination', 'crisis'], convos: 1 },
  { tag: 'crisis', pools: ['intensity', 'crisis'], convos: 1 },
  { tag: 'external', pools: ['external', 'external', 'rumination'], convos: 2 },
  { tag: 'rumination', pools: ['rumination', 'felt', 'neutral'], convos: 1 },
  { tag: 'mixed', pools: ['neutral', 'felt', 'rumination'], convos: 2 },
  { tag: 'light', pools: ['neutral', 'neutral'], convos: 1 },
  { tag: 'light', pools: ['neutral', 'felt'], convos: 1 },
]

const rnd = (a) => a[Math.floor(Math.random() * a.length)]
const hdr = (tok) => ({ apikey: KEY, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' })

async function post(path, tok, body, prefer = 'return=representation') {
  const r = await fetch(URL + path, { method: 'POST', headers: { ...hdr(tok), Prefer: prefer }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`${path} ${r.status}: ${(await r.text()).slice(0, 120)}`)
  return r.json()
}

// 把时间戳分散到过去 ~12 天，偏向傍晚与深夜（贴近真实使用形态）
function backdate(dayOffset, baseHour) {
  const d = new Date()
  d.setDate(d.getDate() - dayOffset)
  d.setHours(baseHour, Math.floor(Math.random() * 60), 0, 0)
  return d.toISOString()
}

let totalMsgs = 0
for (let i = 0; i < PERSONAS.length; i++) {
  const p = PERSONAS[i]
  // 匿名注册
  const su = await fetch(URL + '/auth/v1/signup', { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: '{}' })
  const sj = await su.json()
  const tok = sj.access_token, uid = sj.user.id
  // 标记为模拟用户
  await fetch(URL + `/rest/v1/profiles?id=eq.${uid}`, { method: 'PATCH', headers: { ...hdr(tok), Prefer: 'return=minimal' }, body: JSON.stringify({ display_name: '__sim__' }) })

  for (let c = 0; c < p.convos; c++) {
    const conv = await post('/rest/v1/conversations', tok, { user_id: uid })
    const cid = conv[0].id
    const dayOffset = Math.floor(Math.random() * 12)
    const baseHour = rnd([9, 14, 21, 22, 23, 1, 2]) // 偏傍晚/深夜
    let seq = 0
    for (const poolName of p.pools) {
      const ts = backdate(dayOffset, baseHour)
      await post('/rest/v1/messages', tok, [
        { conversation_id: cid, user_id: uid, role: 'user', content: rnd(POOLS[poolName]), seq, client_sent_at: ts, created_at: ts, server_recv_at: ts },
        { conversation_id: cid, user_id: uid, role: 'mirror', content: rnd(MIRROR), seq: seq + 1, client_sent_at: null, created_at: ts, server_recv_at: ts },
      ], 'return=minimal')
      seq += 2
      totalMsgs += 1
    }
  }
  console.log(`user ${i + 1}/${PERSONAS.length} [${p.tag}] ${uid.slice(0, 8)} ✓`)
}
console.log(`\n完成：${PERSONAS.length} 模拟用户，${totalMsgs} 条用户消息（触发器已自动分析）`)
