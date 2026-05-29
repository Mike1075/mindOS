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
  }, [messages])

  return (
    <div
      className={`flex-1 overflow-y-auto px-6 py-8 transition-opacity duration-1500 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <p className="text-[#444] text-sm tracking-widest text-center">
            带着你此刻真实的状态，开口说话。
          </p>
        </div>
      )}

      {messages
        .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
        .map((msg) => (
          <MessageBubble
            key={msg.id}
            role={msg.role as 'user' | 'assistant'}
            content={msg.content}
          />
        ))}

      {isLoading && (
        <div className="flex justify-start mb-6">
          <div className="flex gap-1 pt-2">
            <span className="w-1 h-1 rounded-full bg-[#444] animate-pulse" style={{ animationDelay: '0ms' }} />
            <span className="w-1 h-1 rounded-full bg-[#444] animate-pulse" style={{ animationDelay: '200ms' }} />
            <span className="w-1 h-1 rounded-full bg-[#444] animate-pulse" style={{ animationDelay: '400ms' }} />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
