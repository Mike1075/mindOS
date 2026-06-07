// 本地调 MiniMax-M3 原生 API（不走 Vercel gateway），用 v0.6 提示词，返回镜子的下一条回复。
// 用法：node scripts/m3-reply.mjs '<JSON: [{"role":"user"|"mirror","text":"..."}]>'
//   或：echo '<JSON>' | node scripts/m3-reply.mjs
// 输出：纯文本（已剥掉 <think>…</think> 思考块，复刻生产经 gateway 隐藏推理的语义）。
// 注：只注入 v0.6 system prompt，对齐旧基线 sim-types 工法（route 层 safetyDirective 第二道在本测不加，
//     故真实生产的危机兜底强于此处——评估危机维度时记着这点）。

import { readFileSync } from 'node:fs'

const KEY = readFileSync('.env.local', 'utf8').match(/MINIMAX_API_KEY=(.+)/)?.[1]?.trim()
if (!KEY) { console.error('缺 MINIMAX_API_KEY'); process.exit(2) }
const SYSTEM = readFileSync('lib/system-prompt.ts', 'utf8').match(/return `([\s\S]*?)`\n}/)[1]
const ENDPOINT = 'https://api.minimaxi.com/v1/chat/completions'
const MODEL = 'MiniMax-M3'
const MAXTOK = Number(process.env.MAXTOK || 2000)

const raw = process.argv[2] || readFileSync(0, 'utf8')
const turns = JSON.parse(raw)
const messages = [{ role: 'system', content: SYSTEM }]
for (const t of turns) messages.push({ role: t.role === 'mirror' ? 'assistant' : 'user', content: t.text })

function strip(s) { return (s || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim() }

async function call() {
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, messages, max_tokens: MAXTOK, temperature: 0.8 }),
      })
      if (!r.ok) { await new Promise(s => setTimeout(s, 2000 * (a + 1))); continue }
      const j = await r.json()
      const out = strip(j.choices?.[0]?.message?.content)
      if (out) return out
    } catch { await new Promise(s => setTimeout(s, 2000 * (a + 1))) }
  }
  return ''
}

const reply = await call()
if (!reply) { console.error('M3 无回复（重试耗尽）'); process.exit(1) }
process.stdout.write(reply)
