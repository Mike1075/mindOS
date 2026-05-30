'use client'

import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'

interface Message {
  id: string
  role: string
  content: string
}

interface ChatWindowProps {
  messages: Message[]
  isLoading: boolean
  fading: boolean
}

export default function ChatWindow({ messages, isLoading, fading }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  return (
    <div className={`flex-1 overflow-y-auto px-6 py-10 ${fading ? 'fade-leave' : 'fade-stay'}`}>
      <div className="max-w-2xl mx-auto">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[58vh] text-center soft-in">
            <div className="w-14 h-14 rounded-full border border-line mb-9 breathe" />
            <p className="font-song text-ink-soft text-[17px] leading-loose">
              带着你此刻真实的状态，
              <br />
              开口说话。
            </p>
            <p className="mt-5 text-ink-faint text-[12px] tracking-[0.2em]">这里没有要去的地方。</p>
          </div>
        )}

        {messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => (
            <MessageBubble key={m.id} role={m.role as 'user' | 'assistant'} content={m.content} />
          ))}

        {isLoading && (
          <div className="flex justify-start mb-9">
            <div className="flex gap-1.5 pt-1">
              {[0, 200, 400].map((d) => (
                <span
                  key={d}
                  className="w-1.5 h-1.5 rounded-full bg-gold-dim"
                  style={{ animation: 'dotPulse 1.4s ease-in-out infinite', animationDelay: `${d}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
