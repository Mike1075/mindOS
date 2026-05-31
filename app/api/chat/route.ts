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

  // 急性危机熔断：前置规则扫描最近一条用户消息
  const lastUser = [...messages].reverse().find((m: { role: string; content: string }) => m.role === 'user')
  if (lastUser) {
    const { isCrisis, response } = checkSafety(lastUser.content)
    if (isCrisis) {
      return staticStream(response)
    }
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
