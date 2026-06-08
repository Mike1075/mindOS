'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// 语音交互 hook。沿用旧语音项目验证过的「混合方案」，并把过时处更新：
//   · VAD（@ricky0123/vad-web 0.0.30）做「可打断」——旧项目的 VAD.create 已废，改 MicVAD.new + Silero v5。
//   · 浏览器内置 SpeechRecognition 做 STT（免费、零依赖），用户说完一次性转写。
//   · 主模型流式吐字 → 按句切分 → 逐句调 /api/tts 拿 mp3 → Web Audio 即时播放，可随时打断。
// 与旧项目的关键差异：不另起一路 fetch，而是由页面把 useChat 的流式文本喂进来（speakStreaming），
// 从而完整复用 /api/chat 的安全/在场/持久化全链路。

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking'

const VAD_VERSION = '0.0.30'
const ORT_VERSION = '1.26.0'
// 资源（worklet + silero 模型 + onnxruntime wasm）走 CDN 固定版本：
// Next 打包后 vad-web 默认 baseAssetPath 会解析成 "/" 导致 404，必须显式指定。
const VAD_ASSET_BASE = `https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@${VAD_VERSION}/dist/`
const ORT_WASM_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`

// 句末切分：到句号/问号/叹号/省略号/换行就算一句，交 TTS。逗号太碎不切。
const SENTENCE_END = /[。．！？!?…]|\n/
// 播放起始后的回声宽限窗：这段时间内不因 VAD 触发打断，避免 AI 自己的起音被误判为用户插话。
const ECHO_GRACE_MS = 500

interface UseVoiceOptions {
  // STT 转写完成 → 交页面走 useChat 的发送链路（append 到 /api/chat）。
  onTranscript: (text: string) => void
}

// 去掉 emoji / markdown 修饰符，免得被读成符号。
function sanitizeForTTS(text: string): string {
  const emoji =
    /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0E}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]/gu
  return text
    .replace(emoji, '')
    .replace(/[*`_#>[\]]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function useVoice({ onTranscript }: UseVoiceOptions) {
  const [enabled, setEnabled] = useState(false)
  const [state, setState] = useState<VoiceState>('idle')
  const [error, setError] = useState<string | null>(null)
  // STT 能力（webkitSpeechRecognition）只在浏览器侧可知，首渲染先假定可用避免 SSR 抖动。
  const [supported, setSupported] = useState(true)

  // 命令式资源，统一用 ref，避免闭包拿到旧值。
  const vadRef = useRef<{ start: () => Promise<void>; pause: () => Promise<void>; destroy: () => Promise<void> } | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const currentSourceRef = useRef<AudioBufferSourceNode | HTMLAudioElement | null>(null)
  const queueRef = useRef<string[]>([])
  const playingRef = useRef(false)
  const spokenLenRef = useRef(0) // 当前 AI 回合已切分入队的字符数
  const playbackStartRef = useRef(0)
  const stateRef = useRef<VoiceState>('idle')
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript

  const setVoiceState = useCallback((s: VoiceState) => {
    stateRef.current = s
    setState(s)
  }, [])

  useEffect(() => {
    const SR =
      typeof window !== 'undefined'
        ? (window.SpeechRecognition || window.webkitSpeechRecognition)
        : undefined
    if (!SR) setSupported(false)
  }, [])

  // ── 打断：停掉当前播放 + 清空队列 ──
  const interrupt = useCallback(() => {
    const src = currentSourceRef.current
    if (src) {
      try {
        if ('stop' in src && typeof src.stop === 'function') {
          src.stop()
          src.disconnect?.()
        } else if ('pause' in src) {
          src.pause()
          ;(src as HTMLAudioElement).src = ''
        }
      } catch {
        /* 已结束的源再 stop 会抛，忽略 */
      }
      currentSourceRef.current = null
    }
    queueRef.current = []
    playingRef.current = false
  }, [])

  const ensureAudioUnlocked = useCallback(async () => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioCtxRef.current = new Ctx()
    }
    if (audioCtxRef.current.state === 'suspended') {
      try {
        await audioCtxRef.current.resume()
      } catch {
        /* ignore */
      }
    }
  }, [])

  // ── 逐句播放队列 ──
  const playNext = useCallback(async () => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    if (queueRef.current.length === 0) {
      playingRef.current = false
      // 队列放空：若仍处朗读态，回到「监听就绪」，VAD 全程未停，用户可直接接话。
      if (stateRef.current === 'speaking') setVoiceState('listening')
      return
    }
    playingRef.current = true
    const sentence = queueRef.current.shift() as string

    try {
      const resp = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sentence }),
      })
      if (!resp.ok || !resp.body) {
        // 这一句合成失败就跳过，继续下一句，别让整段朗读卡死。
        return playNext()
      }
      const buf = await resp.arrayBuffer()
      // 取到音频时若已被打断（状态离开 speaking），丢弃不放。
      if (stateRef.current !== 'speaking') {
        playingRef.current = false
        return
      }
      const audioBuf = await ctx.decodeAudioData(buf)
      if (stateRef.current !== 'speaking') {
        playingRef.current = false
        return
      }
      const source = ctx.createBufferSource()
      source.buffer = audioBuf
      source.connect(ctx.destination)
      source.start(0)
      playbackStartRef.current = Date.now()
      currentSourceRef.current = source
      source.onended = () => {
        if (currentSourceRef.current === source) currentSourceRef.current = null
        void playNext()
      }
    } catch {
      // 解码/网络异常：跳过这句继续。
      void playNext()
    }
  }, [setVoiceState])

  const enqueue = useCallback(
    (raw: string) => {
      const clean = sanitizeForTTS(raw)
      if (!clean) return
      queueRef.current.push(clean)
      if (stateRef.current !== 'speaking') setVoiceState('speaking')
      if (!playingRef.current) void playNext()
    },
    [playNext, setVoiceState]
  )

  // ── 页面接口：开始一个新回合（用户刚发问，无论语音还是打字）──
  const beginTurn = useCallback(() => {
    interrupt()
    spokenLenRef.current = 0
    setVoiceState('thinking')
  }, [interrupt, setVoiceState])

  // ── 页面接口：把 useChat 的流式 AI 文本喂进来，切出新完成的整句入队 ──
  const speakStreaming = useCallback(
    (fullText: string) => {
      for (let i = spokenLenRef.current; i < fullText.length; i++) {
        if (SENTENCE_END.test(fullText[i])) {
          const sentence = fullText.slice(spokenLenRef.current, i + 1)
          spokenLenRef.current = i + 1
          enqueue(sentence)
        }
      }
    },
    [enqueue]
  )

  // ── 页面接口：流结束，冲刷尾部残句 ──
  const endSpeaking = useCallback(
    (fullText: string) => {
      const rest = fullText.slice(spokenLenRef.current)
      spokenLenRef.current = fullText.length
      if (rest.trim()) enqueue(rest)
    },
    [enqueue]
  )

  // ── STT ──
  const startRecognition = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec) return
    try {
      rec.start()
    } catch {
      /* 已在监听时重复 start 会抛，忽略 */
    }
  }, [])

  const initRecognition = useCallback(() => {
    if (recognitionRef.current) return recognitionRef.current
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return null
    const rec: SpeechRecognitionLike = new SR()
    rec.lang = 'zh-CN'
    rec.interimResults = false
    rec.continuous = false
    rec.onresult = (e: SpeechRecognitionEventLike) => {
      const text = e.results?.[0]?.[0]?.transcript?.trim()
      if (!text) return
      // 用户说完即开新回合：停掉残余朗读、回合计数归零、转「思考中」，再交页面发送。
      beginTurn()
      onTranscriptRef.current(text)
    }
    rec.onerror = () => {
      // no-speech / aborted 等都无需打扰用户，VAD 仍在监听，下次说话会再起。
    }
    recognitionRef.current = rec
    return rec
  }, [beginTurn])

  // ── 启停语音模式 ──
  const start = useCallback(async () => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('当前浏览器不支持麦克风，请用最新版 Chrome / Edge')
      return
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setError('当前浏览器不支持语音识别，请用最新版 Chrome / Edge')
      return
    }

    try {
      await ensureAudioUnlocked()
      // 自己持有一路开了回声消除的麦克风流，交给 VAD 复用 —— 抑制 AI 朗读被自己的 VAD 当成插话。
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      streamRef.current = stream

      initRecognition()

      // vad-web 在 SSR 期会崩，必须仅客户端动态引入。
      const { MicVAD } = await import('@ricky0123/vad-web')
      const vad = await MicVAD.new({
        model: 'v5',
        baseAssetPath: VAD_ASSET_BASE,
        onnxWASMBasePath: ORT_WASM_BASE,
        // 单线程 wasm：免去 SharedArrayBuffer，也就不必给全站加 COOP/COEP 头（会干扰 gateway/边缘）。
        ortConfig: (ort: { env: { wasm: { numThreads?: number } } }) => {
          ort.env.wasm.numThreads = 1
        },
        getStream: async () => streamRef.current as MediaStream,
        onSpeechStart: () => {
          // AI 正在说且已过回声宽限 → 用户插话，立即打断朗读。
          if (stateRef.current === 'speaking' && Date.now() - playbackStartRef.current > ECHO_GRACE_MS) {
            interrupt()
          }
          if (stateRef.current !== 'thinking') {
            setVoiceState('listening')
            startRecognition()
          }
        },
        onSpeechEnd: () => {
          if (stateRef.current === 'listening') {
            try {
              recognitionRef.current?.stop()
            } catch {
              /* ignore */
            }
          }
        },
      })
      vadRef.current = vad as unknown as typeof vadRef.current
      await vad.start()
      setEnabled(true)
      setVoiceState('idle')
    } catch (e) {
      setError('启动语音失败：' + (e instanceof Error ? e.message : String(e)))
      // 清理半成品
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [ensureAudioUnlocked, initRecognition, interrupt, setVoiceState, startRecognition])

  const stop = useCallback(async () => {
    interrupt()
    // 销毁而非仅暂停：避免反复开关语音时遗留多个 MicVAD 实例（各自占着 worklet/音频节点）。
    try {
      await vadRef.current?.destroy()
    } catch {
      /* ignore */
    }
    vadRef.current = null
    try {
      recognitionRef.current?.stop()
    } catch {
      /* ignore */
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setEnabled(false)
    setVoiceState('idle')
  }, [interrupt, setVoiceState])

  const toggle = useCallback(() => {
    if (enabled) void stop()
    else void start()
  }, [enabled, start, stop])

  // 卸载时彻底释放
  useEffect(() => {
    return () => {
      interrupt()
      void vadRef.current?.destroy?.().catch(() => {})
      streamRef.current?.getTracks().forEach((t) => t.stop())
      void audioCtxRef.current?.close().catch(() => {})
    }
  }, [interrupt])

  return { enabled, state, error, supported, toggle, beginTurn, speakStreaming, endSpeaking, interrupt }
}

// ── 浏览器 SpeechRecognition 的最小类型声明（标准库未内置） ──
interface SpeechRecognitionEventLike {
  results: { [index: number]: { [index: number]: { transcript: string } } }
}
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: (e: SpeechRecognitionEventLike) => void
  onerror: (e: unknown) => void
}
declare global {
  interface Window {
    SpeechRecognition?: { new (): SpeechRecognitionLike }
    webkitSpeechRecognition?: { new (): SpeechRecognitionLike }
  }
}
