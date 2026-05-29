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

  // Safety check on latest user message
  const lastUser = [...messages].reverse().find((m: { role: string; content: string }) => m.role === 'user')
  if (lastUser) {
    const { isCrisis, response } = checkSafety(lastUser.content)
    if (isCrisis) {
      return staticStream(response)
    }
  }

  // Session limit check
  const userTurns = messages.filter((m: { role: string }) => m.role === 'user').length
  if (userTurns > MAX_TURNS) {
    return staticStream(
      '今天的映照已经足够清晰了。威力之点在当下，在屏幕之外的真实生活中。请离开这里，去觉察你今天所看见的。[SESSION_END]'
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
