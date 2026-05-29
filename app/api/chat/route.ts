import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { streamText } from 'ai'
import { NextRequest } from 'next/server'
import { checkSafety } from '@/lib/safety'
import { getSystemPrompt } from '@/lib/system-prompt'
import { GATEWAY_BASE_URL, MODEL_ID, MAX_TURNS } from '@/lib/config'

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

export async function POST(req: NextRequest) {
  const { messages } = await req.json()

  // 急性危机熔断：前置规则扫描最近一条用户消息
  const lastUser = [...messages].reverse().find((m: { role: string; content: string }) => m.role === 'user')
  if (lastUser) {
    const { isCrisis, response } = checkSafety(lastUser.content)
    if (isCrisis) {
      return staticStream(response)
    }
  }

  // 会话软上限：开放性收束，绝不在情绪峰值硬切（对齐 V2 — 永远留一个开放出口）
  const userTurns = messages.filter((m: { role: string }) => m.role === 'user').length
  if (userTurns > MAX_TURNS) {
    return staticStream(
      '今天，我们先在这里停一停。\n\n你带走的不是我说过的话，是你自己看见的东西。它会在你离开屏幕之后，继续慢慢清晰起来。[SESSION_END]'
    )
  }

  const gateway = createOpenAICompatible({
    name: 'vercel-gateway',
    apiKey: process.env.AI_GATEWAY_API_KEY!,
    baseURL: GATEWAY_BASE_URL,
  })

  const result = streamText({
    model: gateway(MODEL_ID),
    system: getSystemPrompt(),
    messages,
  })

  return result.toDataStreamResponse()
}
