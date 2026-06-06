import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { streamText } from 'ai'
import { NextRequest } from 'next/server'
import { checkSafety } from '@/lib/safety'
import { getSystemPrompt } from '@/lib/system-prompt'
import { GATEWAY_BASE_URL, MODEL_ID, REASONING_EFFORT } from '@/lib/config'

export const runtime = 'edge'

function staticStream(text: string): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`0:${JSON.stringify(text)}\n`))
      controller.enqueue(
        encoder.encode('d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}\n')
      )
      controller.close()
    },
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Vercel-AI-Data-Stream': 'v1',
    },
  })
}

// 速率限制：防滥用/防成本，不是对话边界。阈值很宽松，正常真人聊天碰不到，只拦死循环/刷量。
// 内存滑窗、按 IP；注：边缘实例级、冷启会重置——对小范围可信测试足够；规模扩大应换 Upstash/KV 做分布式限流。
const MIN_INTERVAL_MS = 1500          // 两条消息最小间隔
const WINDOW_MS = 10 * 60 * 1000      // 10 分钟窗口
const MAX_IN_WINDOW = 40              // 窗口内上限（正常人读+想根本到不了）
const DAY_MS = 24 * 60 * 60 * 1000
const MAX_PER_DAY = 300               // 每日上限
const hits = new Map<string, number[]>()
const RATE_MSG =
  '我们刚才聊得有点快。我想稳稳地陪你，不急——先歇一小会儿，过一两分钟再回来跟我说，好吗。'

function clientKey(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  return (xff ? xff.split(',')[0].trim() : '') || req.headers.get('x-real-ip') || 'unknown'
}

function rateLimited(key: string): boolean {
  const now = Date.now()
  if (hits.size > 5000) hits.clear() // 粗暴防内存膨胀
  const arr = (hits.get(key) || []).filter((t) => now - t < DAY_MS)
  const inWindow = arr.filter((t) => now - t < WINDOW_MS).length
  const tooFast = arr.length > 0 && now - arr[arr.length - 1] < MIN_INTERVAL_MS
  if (tooFast || inWindow >= MAX_IN_WINDOW || arr.length >= MAX_PER_DAY) {
    hits.set(key, arr) // 保留历史但不记本次
    return true
  }
  arr.push(now)
  hits.set(key, arr)
  return false
}

interface Presence {
  repeatedVoices?: string[]
}

// 静默分析层 → 实时在场质地调节。
// 注：已退役"升温→变安静/变冷"分支——那是把群体平均结论当个体戒律的生态学谬误，
// 且实测既不触发也不生效，更违背"先是个温暖的人"的全局原则。只保留叙事外化一条：
// 不与一个固化的负面身份共谋（这是亲生命的，不是疏远）。
function presenceDirective(p?: Presence): string {
  if (!p) return ''
  if (p.repeatedVoices && p.repeatedVoices.length > 0) {
    return `\n\n【此刻的在场质地（后台静默分析，不要向对方提及）】\n这些自我贬低的说法已反复出现：${p.repeatedVoices.join('、')}。不要把它们确认成"他是谁"——温柔地让它们是会来也会走的声音，而不是身份。这不是疏远，是不与一个固化的负面自我定义共谋。`
  }
  return ''
}

// 危机正则命中 → 不硬熔断，而是给主模型一段定向提醒，让它在完整上下文里自行判断真伪。
// 这修掉了"自杀式的断裂"这类隐喻被关键词墙误掐断的问题，同时保留"抬高注意力"的安全价值。
function safetyDirective(hits: string[]): string {
  if (!hits.length) return ''
  const quoted = hits.slice(0, 3).map((h) => `「${h}」`).join('、')
  return `\n\n【安全留意（后台前置检测，不要向对方提及，更不要把这些字眼塞回给他）】\n他刚才的话里出现了${quoted}这样的字眼。请格外留意，但不要条件反射——先在完整上下文里分清这究竟是：①他亲口、指向自己当下的生死或自伤；还是②引用、隐喻、否定、在讲别人、或在讲一个模式（如"自杀式的断裂从而自救"是关系比喻）。只有确实是①时，才按【安全】协议——温暖地、像个在乎他的人、只提一次地陪他朝真实的人走一步；若是②，就当寻常对话贴着他继续，绝不提热线、绝不盘问生死，那只会让他觉得不被听懂、把一次真话掐断。`
}

// 预热：入口加载即由前端 fire-and-forget 打一发 GET。
// 目的——把首条从「冷启 20-30s」拉回「热实例 ~6s」。实测模型 TTFB 稳定 4-6s（无每调用冷启尖峰），
// 故 20-30s 出在 edge 函数 / gateway→M3 provider 实例的冷启上。GET 命中即焐热本路由的 edge 实例，
// 内部再发一个极小调用（max_tokens:1）焐热 gateway 建连与 provider 实例。成本可忽略，失败静默。
export async function GET() {
  try {
    await fetch(`${GATEWAY_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [{ role: 'user', content: '嗯' }],
        max_tokens: 16, // 1 会让自适应思考截断成不可解析 JSON；16 既干净返回又走一遍真实思考路径，焐热最到位
        stream: false,
      }),
    })
  } catch {
    /* 预热是 best-effort，失败不影响正常对话 */
  }
  return new Response('ok', { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const { messages, presence } = await req.json()

  // 急性危机：前置正则扫描最近一条用户消息。命中【不再硬熔断】，只作为 flag 注入提示词，
  // 由主模型在完整上下文里判断真伪（见 safetyDirective / system-prompt【安全】段）。
  const lastUser = [...messages].reverse().find((m: { role: string; content: string }) => m.role === 'user')
  const crisisHits = lastUser ? checkSafety(lastUser.content).hits : []

  // 速率限制（防滥用/防成本）：危机信号命中则放行（危机必接住，先于限流），正常对话碰不到此阈值
  if (crisisHits.length === 0 && rateLimited(clientKey(req))) {
    return staticStream(RATE_MSG)
  }

  const gateway = createOpenAICompatible({
    name: 'vercel-gateway',
    apiKey: process.env.AI_GATEWAY_API_KEY!,
    baseURL: GATEWAY_BASE_URL,
  })

  const result = streamText({
    model: gateway(MODEL_ID),
    system:
      getSystemPrompt() +
      presenceDirective(presence as Presence | undefined) +
      safetyDirective(crisisHits),
    messages,
    // 推理档位（仅当配置了非空 REASONING_EFFORT 时下发；便于未来切换到推理模型）
    ...(REASONING_EFFORT
      ? { providerOptions: { openaiCompatible: { reasoning_effort: REASONING_EFFORT } } }
      : {}),
  })

  return result.toDataStreamResponse()
}
