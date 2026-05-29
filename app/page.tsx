'use client'

import { useChat } from 'ai/react'
import { useEffect, useRef, useState, FormEvent } from 'react'
import ChatWindow from '@/components/ChatWindow'
import InputBar from '@/components/InputBar'
import StillSpace from '@/components/StillSpace'

export default function Home() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
  })

  const [sessionEnded, setSessionEnded] = useState(false)
  const [still, setStill] = useState(false)
  const processed = useRef<Set<string>>(new Set())

  // 检测会话软上限（开放性收束），仅禁用输入，不弹任何提取式界面
  useEffect(() => {
    if (isLoading) return
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'assistant') return
    if (processed.current.has(last.id)) return
    processed.current.add(last.id)
    if (last.content.includes('[SESSION_END]')) setSessionEnded(true)
  }, [messages, isLoading])

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    handleSubmit(e)
  }

  return (
    <main className="flex flex-col h-[100dvh]">
      <header className="flex items-center justify-between px-6 py-4">
        <h1 className="text-[13px] tracking-[0.45em] text-ink-soft">心 镜</h1>
        <button
          onClick={() => setStill(true)}
          aria-label="进入停留"
          className="group flex items-center gap-2 text-ink-faint hover:text-celadon-dim transition-colors"
        >
          <span className="text-[10px] tracking-[0.3em]">停留</span>
          <span className="w-2.5 h-2.5 rounded-full border border-current transition-colors" />
        </button>
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
    </main>
  )
}
