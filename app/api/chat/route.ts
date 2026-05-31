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
  cooldown?: boolean
  highIntensity?: boolean
  repeatedVoices?: string[]
}

// 静默分析层 → 实时在场质地调节（V2 §3 VAILs 防护的实时反哺）
function presenceDirective(p?: Presence): string {
  if (!p) return ''
  const parts: string[] = []
  if (p.cooldown || p.highIntensity) {
    parts.push(
      '对方近期情绪强度偏高。此刻更安静、更简短、多留白，不深入挖掘任何议题，并自然留一个开放的出口。'
    )
  }
  if (p.repeatedVoices && p.repeatedVoices.length > 0) {
    parts.push(
      `这些自我贬低的声音已在过往反复出现：${p.repeatedVoices.join('、')}。减少而非增加对它们的聚焦——不要确认、不要深挖，更多停留在当下或身体感受里。`
    )
  }
  if (parts.length === 0) return ''
  return `\n\n【此刻的在场质地（后台静默分析，不要向对方提及）】\n${parts.join('\n')}`
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
