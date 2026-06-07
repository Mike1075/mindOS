// 单轮对话驱动：把"用户这句话"接进某段对话，调 MiniMax-M3 原生(v0.6 提示词)拿镜子回复，
// 落盘到 convfile（JSON 数组），并把镜子回复打到 stdout。零 gateway。
// 用法：echo "用户这句话" | node scripts/conv-turn.mjs <convfile.json>
//   （用户消息从 stdin 读，避免中文/引号在 argv 里的转义问题）

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// 相对脚本自身定位仓库根，避免子代理在别处 cwd 跑时找不到 .env.local / 提示词
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const convfile = process.argv[2]
if (!convfile) { console.error('用法: ... | node scripts/conv-turn.mjs <convfile>'); process.exit(2) }
const userMsg = readFileSync(0, 'utf8').replace(/\n$/, '')
if (!userMsg.trim()) { console.error('空用户消息'); process.exit(2) }

const KEY = readFileSync(resolve(ROOT, '.env.local'), 'utf8').match(/MINIMAX_API_KEY=(.+)/)?.[1]?.trim()
if (!KEY) { console.error('缺 MINIMAX_API_KEY'); process.exit(2) }
const SYSTEM = readFileSync(resolve(ROOT, 'lib/system-prompt.ts'), 'utf8').match(/return `([\s\S]*?)`\n}/)[1]
const MAXTOK = Number(process.env.MAXTOK || 2000)

const turns = existsSync(convfile) ? JSON.parse(readFileSync(convfile, 'utf8')) : []
turns.push({ role: 'user', text: userMsg })

const messages = [{ role: 'system', content: SYSTEM }]
for (const t of turns) messages.push({ role: t.role === 'mirror' ? 'assistant' : 'user', content: t.text })

const strip = (s) => (s || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()

async function call() {
  for (let a = 0; a < 4; a++) {
    const ctrl = new AbortController()
    const to = setTimeout(() => ctrl.abort(), 150000)
    try {
      const r = await fetch('https://api.minimaxi.com/v1/chat/completions', {
        method: 'POST', signal: ctrl.signal,
        headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'MiniMax-M3', messages, max_tokens: MAXTOK, temperature: 0.8 }),
      })
      clearTimeout(to)
      if (!r.ok) { await new Promise(s => setTimeout(s, 2000 * (a + 1))); continue }
      const j = await r.json()
      const out = strip(j.choices?.[0]?.message?.content)
      if (out) return out
    } catch { clearTimeout(to); await new Promise(s => setTimeout(s, 2000 * (a + 1))) }
  }
  return ''
}

const reply = await call()
if (!reply) { console.error('M3 无回复(重试耗尽)'); process.exit(1) }
turns.push({ role: 'mirror', text: reply })
writeFileSync(convfile, JSON.stringify(turns, null, 0))
process.stdout.write(reply)
