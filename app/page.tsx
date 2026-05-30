'use client'

import { useChat, type Message } from 'ai/react'
import { useEffect, useRef, useState, FormEvent } from 'react'
import ChatWindow from '@/components/ChatWindow'
import InputBar from '@/components/InputBar'
import StillSpace from '@/components/StillSpace'
import MirrorReport from '@/components/MirrorReport'
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

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
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

  const [sessionEnded, setSessionEnded] = useState(false)
  const [still, setStill] = useState(false)
  const [mirrorOpen, setMirrorOpen] = useState(false)
  const [mirrorData, setMirrorData] = useState<MirrorData | null>(null)
  const [mirrorLoading, setMirrorLoading] = useState(false)
  const processed = useRef<Set<string>>(new Set())

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

  // 检测会话软上限（开放性收束），仅禁用输入
  useEffect(() => {
    if (isLoading) return
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'assistant') return
    if (processed.current.has(last.id)) return
    processed.current.add(last.id)
    if (last.content.includes('[SESSION_END]')) setSessionEnded(true)
  }, [messages, isLoading])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!input.trim()) return
    pendingUserText.current = input
    sentAtRef.current = new Date().toISOString()
    // 读取在场质地（静默分析层反哺），随请求传给路由注入提示词
    const presence = userIdRef.current ? await getPresenceContext(userIdRef.current) : null
    handleSubmit(e, { body: { presence } })
  }

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
        disabled={sessionEnded}
        onInputChange={handleInputChange}
        onSubmit={onSubmit}
      />

      {still && <StillSpace onReturn={() => setStill(false)} />}
      {mirrorOpen && (
        <MirrorReport data={mirrorData} loading={mirrorLoading} onClose={() => setMirrorOpen(false)} />
      )}
    </main>
  )
}
