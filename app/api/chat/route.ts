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

export async function POST(req: NextRequest) {
  const { messages, presence } = await req.json()

  // 急性危机熔断：前置规则扫描最近一条用户消息（永远先于限流，危机必接住）
  const lastUser = [...messages].reverse().find((m: { role: string; content: string }) => m.role === 'user')
  if (lastUser) {
    const { isCrisis, response } = checkSafety(lastUser.content)
    if (isCrisis) {
      return staticStream(response)
    }
  }

  // 速率限制（防滥用/防成本）：危机已先放行，正常对话碰不到此阈值
  if (rateLimited(clientKey(req))) {
    return staticStream(RATE_MSG)
  }

  const gateway = createOpenAICompatible({
    name: 'vercel-gateway',
    apiKey: process.env.AI_GATEWAY_API_KEY!,
    baseURL: GATEWAY_BASE_URL,
  })

  const result = streamText({
    model: gateway(MODEL_ID),
    system: getSystemPrompt() + presenceDirective(presence as Presence | undefined),
    messages,
    // 推理档位（仅当配置了非空 REASONING_EFFORT 时下发；便于未来切换到推理模型）
    ...(REASONING_EFFORT
      ? { providerOptions: { openaiCompatible: { reasoning_effort: REASONING_EFFORT } } }
      : {}),
  })

  return result.toDataStreamResponse()
}
