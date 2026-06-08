import { NextRequest } from 'next/server'

export const runtime = 'edge'

// Azure 语音合成（TTS）代理。
// 沿用旧语音项目的「整句合成 → 前端 Web Audio 播放」混合方案：主模型流式吐字，
// 前端按句切分后逐句调本路由，拿回 mp3 即播，形成「伪流式」听感且可随时打断。
// 密钥只在服务端持有，绝不下发前端。
const REGION = process.env.AZURE_SPEECH_REGION || 'westus3'
const DEFAULT_VOICE = process.env.AZURE_SPEECH_VOICE || 'zh-CN-YunyeNeural'
// 心镜气质：云野 + calm 风格 + 略慢语速 + 微降调，贴「沉静、留白、不催促」的旁观感。
const DEFAULT_STYLE = 'calm'
const DEFAULT_RATE = '-8%'
const DEFAULT_PITCH = '-3%'
// 兜底音色：DragonHD/带风格音色偶发不可用时退回最通用的稳定音色，宁可换声也不让朗读断掉。
const FALLBACK_VOICE = 'zh-CN-XiaoxiaoNeural'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// 仅当音色支持 express-as 风格时才包 mstts；DragonHD 等无风格音色用裸 prosody，避免 SSML 报错。
function buildSsml(text: string, voice: string, useStyle: boolean): string {
  const inner = `<prosody rate="${DEFAULT_RATE}" pitch="${DEFAULT_PITCH}">${escapeXml(text)}</prosody>`
  const body = useStyle
    ? `<mstts:express-as style="${DEFAULT_STYLE}">${inner}</mstts:express-as>`
    : inner
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="zh-CN"><voice name="${voice}">${body}</voice></speak>`
}

export function OPTIONS() {
  return new Response(null, { headers: CORS })
}

export async function POST(req: NextRequest) {
  const key = process.env.AZURE_SPEECH_KEY
  if (!key) {
    return new Response(JSON.stringify({ error: '未配置 AZURE_SPEECH_KEY' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  let text: string
  let voice: string
  try {
    const body = await req.json()
    text = typeof body?.text === 'string' ? body.text : ''
    voice = typeof body?.voice === 'string' && body.voice ? body.voice : DEFAULT_VOICE
  } catch {
    return new Response(JSON.stringify({ error: '请求体非法' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
  if (!text.trim()) {
    return new Response(JSON.stringify({ error: '缺少 text' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  const ttsUrl = `https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`
  const synth = (ssml: string) =>
    fetch(ttsUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'mindos-voice',
      },
      body: ssml,
    })

  // 主音色（带 calm 风格）→ 失败回退到通用音色（无风格）。
  let upstream = await synth(buildSsml(text, voice, true))
  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '')
    upstream = await synth(buildSsml(text, FALLBACK_VOICE, false))
    if (!upstream.ok || !upstream.body) {
      const detail2 = await upstream.text().catch(() => '')
      return new Response(
        JSON.stringify({ error: 'Azure TTS 失败', detail: detail || detail2, region: REGION }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }
  }

  return new Response(upstream.body, {
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store', ...CORS },
  })
}
