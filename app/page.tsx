'use client'

import { useChat } from 'ai/react'
import { useEffect, useState, useRef, FormEvent } from 'react'
import ChatWindow from '@/components/ChatWindow'
import InputBar from '@/components/InputBar'
import VoidSpace from '@/components/VoidSpace'

interface VoidData {
  formula: string
  quote: string
}

function parseVoidContent(content: string): VoidData {
  const formulaMatch = content.match(/\[BELIEF_FORMULA\]:\s*(.+?)(?:\n|$)/)
  const quoteMatch = content.match(/\[VOID_QUOTE\]:\s*(.+?)(?:\n|$)/)
  return {
    formula: formulaMatch?.[1]?.trim() ?? '',
    quote: quoteMatch?.[1]?.trim() ?? '',
  }
}

export default function Home() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
  })

  const [voidData, setVoidData] = useState<VoidData | null>(null)
  const [chatFading, setChatFading] = useState(false)
  const [sessionEnded, setSessionEnded] = useState(false)
  const processedMessageIds = useRef<Set<string>>(new Set())

  // Detect void mode and session end in completed assistant messages
  useEffect(() => {
    if (isLoading) return
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'assistant') return
    if (processedMessageIds.current.has(last.id)) return

    processedMessageIds.current.add(last.id)

    if (last.content.includes('[SESSION_END]')) {
      setSessionEnded(true)
      return
    }

    if (last.content.includes('[VOID_MODE]')) {
      const data = parseVoidContent(last.content)
      // Fade chat out then show void space
      setChatFading(true)
      setTimeout(() => {
        setVoidData(data)
        setChatFading(false)
      }, 1500)
    }
  }, [messages, isLoading])

  function handleVoidReturn() {
    setVoidData(null)
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    handleSubmit(e)
  }

  return (
    <main className="flex flex-col h-screen max-w-2xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a]">
        <div>
          <h1 className="text-[13px] tracking-[0.2em] text-[#666]">心 镜</h1>
        </div>
        <p className="text-[10px] text-[#333] tracking-widest">MINDOS · Phase 0</p>
      </header>

      {/* Chat area */}
      <ChatWindow messages={messages} isLoading={isLoading} fading={chatFading} />

      {/* Input */}
      <InputBar
        input={input}
        isLoading={isLoading}
        disabled={sessionEnded || !!voidData}
        onInputChange={handleInputChange}
        onSubmit={onSubmit}
      />

      {/* Void space overlay */}
      {voidData && (
        <VoidSpace formula={voidData.formula} quote={voidData.quote} onReturn={handleVoidReturn} />
      )}
    </main>
  )
}
