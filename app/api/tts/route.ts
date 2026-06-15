import { NextRequest } from 'next/server'

export const runtime = 'edge'

// Azure 语音合成（TTS）代理。
// 沿用旧语音项目的「整句合成 → 前端 Web Audio 播放」混合方案：主模型流式吐字，
// 前端按句切分后逐句调本路由，拿回 mp3 即播，形成「伪流式」听感且可随时打断。
// 密钥只在服务端持有，绝不下发前端。
const REGION = process.env.AZURE_SPEECH_REGION || 'westus3'
// 心镜气质：晓晓2 HD Flash（DragonHD 最新自然代际）+ empathetic（共情）风格，
// 贴「接住人、温柔在场、不催促」。实测 westus3 该 Flash 音色可用（DragonHD 非 Flash 的晓辰在此区域 400）。
const DEFAULT_VOICE = process.env.AZURE_SPEECH_VOICE || 'zh-CN-Xiaoxiao2:DragonHDFlashLatestNeural'
const DEFAULT_STYLE = 'empathetic'
// HD 音色不支持 <prosody> 调速/调调；沉静感改由风格本身 + 略低 temperature（更稳、更收）实现。
const DEFAULT_TEMPERATURE = '0.8'
// 兜底音色：HD 偶发不可用时退回标准 Xiaoxiao（标准音色支持 prosody，可慢放微降调），宁可换声也不让朗读断掉。
const FALLBACK_VOICE = 'zh-CN-XiaoxiaoNeural'
const FALLBACK_RATE = '-6%'
const FALLBACK_PITCH = '-2%'

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

function isHdVoice(voice: string): boolean {
  return /:DragonHD/i.test(voice)
}

// HD（DragonHD / Flash）音色：用 express-as 风格 + temperature 参数，不支持 prosody。
// 标准音色：用 prosody 慢放微降调（标准音色不吃 temperature/部分风格，故走另一条路径）。
function buildSsml(text: string, voice: string): string {
  const safe = escapeXml(text)
  const open = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="zh-CN">`
  if (isHdVoice(voice)) {
    const body = `<mstts:express-as style="${DEFAULT_STYLE}">${safe}</mstts:express-as>`
    return `${open}<voice name="${voice}" parameters="temperature=${DEFAULT_TEMPERATURE}">${body}</voice></speak>`
  }
  const body = `<prosody rate="${FALLBACK_RATE}" pitch="${FALLBACK_PITCH}">${safe}</prosody>`
  return `${open}<voice name="${voice}">${body}</voice></speak>`
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

  // 主音色（HD Flash + 共情风格）→ 失败回退到标准 Xiaoxiao（prosody 慢放）。
  let upstream = await synth(buildSsml(text, voice))
  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '')
    upstream = await synth(buildSsml(text, FALLBACK_VOICE))
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
