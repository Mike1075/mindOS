'use client'

import { useChat, type Message } from 'ai/react'
import { useEffect, useRef, useState, FormEvent } from 'react'
import ChatWindow from '@/components/ChatWindow'
import InputBar from '@/components/InputBar'
import StillSpace from '@/components/StillSpace'
import MirrorReport from '@/components/MirrorReport'
import Threshold from '@/components/Threshold'
import { useVoice } from '@/lib/useVoice'
import {
  ensureUser,
  createConversation,
  persistTurn,
  logEvent,
  getPresenceContext,
  getMirrorData,
  type MirrorData,
} from '@/lib/persist'

export default function Home() {
  // 持久化用到的引用（best-effort，全程不阻塞对话）
  const userIdRef = useRef<string | null>(null)
  const convIdRef = useRef<string | null>(null)
  const seqRef = useRef(0) // 下一条用户消息的 seq（用户偶数、镜子奇数）
  const pendingUserText = useRef('')
  const sentAtRef = useRef<string | null>(null)

  const { messages, input, handleInputChange, setInput, append, isLoading } = useChat({
    api: '/api/chat',
    onFinish: async (message: Message) => {
      const uid = userIdRef.current
      if (!uid) return
      let cid = convIdRef.current
      if (!cid) {
        cid = await createConversation(uid)
        convIdRef.current = cid
      }
      if (!cid) return
      const seq = seqRef.current
      await persistTurn({
        conversationId: cid,
        userId: uid,
        seq,
        userText: pendingUserText.current,
        mirrorText: message.content,
        clientSentAt: sentAtRef.current,
      })
      seqRef.current = seq + 2
      void logEvent(uid, 'message_sent', cid)
    },
  })

  // 知情同意门槛：null=未知(读 localStorage 前) / false=需展示 / true=已同意
  const [consented, setConsented] = useState<boolean | null>(null)
  const [still, setStill] = useState(false)
  const [mirrorOpen, setMirrorOpen] = useState(false)
  const [mirrorData, setMirrorData] = useState<MirrorData | null>(null)
  const [mirrorLoading, setMirrorLoading] = useState(false)

  // 知情同意：首次进入展示门槛，确认后写 localStorage 不再弹
  useEffect(() => {
    try {
      setConsented(localStorage.getItem('mindos_consent_v1') === '1')
    } catch {
      setConsented(true) // localStorage 不可用时不阻断进入
    }
  }, [])

  function enterFromThreshold() {
    try {
      localStorage.setItem('mindos_consent_v1', '1')
    } catch {
      /* 忽略：隐私模式下不可写 */
    }
    setConsented(true)
  }

  // 预热：一进门就 fire-and-forget 焐热 /api/chat 的 edge 实例 + gateway→M3 链路。
  // 用户读门槛/打字的空窗里完成，真正首条即热实例 ~6s，而非冷启 20-30s。失败无所谓。
  useEffect(() => {
    void fetch('/api/chat', { method: 'GET' }).catch(() => {})
  }, [])

  // 会话启动：匿名登录 + 记录 session_start
  useEffect(() => {
    let active = true
    ensureUser().then((uid) => {
      if (!active || !uid) return
      userIdRef.current = uid
      void logEvent(uid, 'session_start')
    })
    return () => {
      active = false
    }
  }, [])

  // 统一发送：打字与语音两条路径共用，都带在场质地、走同一 /api/chat（安全/持久化全复用）。
  async function sendUserMessage(text: string) {
    pendingUserText.current = text
    sentAtRef.current = new Date().toISOString()
    const presence = userIdRef.current ? await getPresenceContext(userIdRef.current) : null
    await append({ role: 'user', content: text }, { body: { presence } })
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setInput('')
    if (voice.enabled) voice.beginTurn() // 语音开启时，打字发问也朗读回复
    await sendUserMessage(text)
  }

  // 语音：STT 转写完成 → 走同一发送链路（hook 内部已先 beginTurn 转「思考中」）
  const voice = useVoice({
    onTranscript: (text) => {
      void sendUserMessage(text)
    },
  })

  // 把 useChat 的流式 AI 文本喂给语音层：边流边按句合成播放；流结束冲刷尾句。
  const flushedIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!voice.enabled) return
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'assistant') return
    if (isLoading) {
      voice.speakStreaming(last.content)
    } else if (flushedIdRef.current !== last.id) {
      voice.endSpeaking(last.content)
      flushedIdRef.current = last.id
    }
  }, [messages, isLoading, voice])

  function enterStill() {
    setStill(true)
    if (userIdRef.current) void logEvent(userIdRef.current, 'void_entered', convIdRef.current)
  }

  async function openMirror() {
    setMirrorOpen(true)
    setMirrorLoading(true)
    const uid = userIdRef.current
    setMirrorData(uid ? await getMirrorData(uid) : null)
    setMirrorLoading(false)
  }

  // 读取同意状态前先留白，避免门槛/对话之间闪烁
  if (consented === null) return <main className="h-[100dvh] bg-base" />
  // 首次进入：先过知情同意门槛
  if (!consented) return <Threshold onEnter={enterFromThreshold} />

  return (
    <main className="flex flex-col h-[100dvh]">
      <header className="flex items-center justify-between px-6 py-4">
        <h1 className="text-[13px] tracking-[0.45em] text-ink-soft">心 镜</h1>
        <div className="flex items-center gap-5">
          <button
            onClick={openMirror}
            aria-label="镜中回望"
            className="text-[10px] tracking-[0.3em] text-ink-faint hover:text-gold-dim transition-colors"
          >
            回望
          </button>
          <button
            onClick={enterStill}
            aria-label="进入停留"
            className="group flex items-center gap-2 text-ink-faint hover:text-gold-dim transition-colors"
          >
            <span className="text-[10px] tracking-[0.3em]">停留</span>
            <span className="w-2.5 h-2.5 rounded-full border border-current transition-colors" />
          </button>
        </div>
      </header>

      <ChatWindow messages={messages} isLoading={isLoading} fading={false} />

      <InputBar
        input={input}
        isLoading={isLoading}
        onInputChange={handleInputChange}
        onSubmit={onSubmit}
        voiceSupported={voice.supported}
        voiceEnabled={voice.enabled}
        voiceState={voice.state}
        onToggleVoice={voice.toggle}
      />

      {voice.error && (
        <p className="text-center text-[11px] text-rose-300/70 -mt-3 mb-3 px-5">{voice.error}</p>
      )}

      {still && <StillSpace onReturn={() => setStill(false)} />}
      {mirrorOpen && (
        <MirrorReport data={mirrorData} loading={mirrorLoading} onClose={() => setMirrorOpen(false)} />
      )}
    </main>
  )
}
