'use client'

import { FormEvent, KeyboardEvent, useRef, useEffect } from 'react'

interface InputBarProps {
  input: string
  isLoading: boolean
  disabled: boolean
  onInputChange: (value: string) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
}

export default function InputBar({ input, isLoading, disabled, onInputChange, onSubmit }: InputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [input])

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!disabled && !isLoading && input.trim()) {
        const form = e.currentTarget.closest('form')
        form?.requestSubmit()
      }
    }
  }

  return (
    <div className="border-t border-[#1e1e1e] px-4 py-4">
      <form onSubmit={onSubmit} className="flex items-end gap-3 max-w-2xl mx-auto">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLoading}
          placeholder={disabled ? '此刻已足够。请离开，去觉察。' : '带着你真实的状态，说话……'}
          rows={1}
          className="flex-1 resize-none bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 text-[14px] text-mirror placeholder-[#444] focus:outline-none focus:border-[#444] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        />
        <button
          type="submit"
          disabled={disabled || isLoading || !input.trim()}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-[#1e1e1e] text-[#666] hover:text-[#aaa] hover:bg-[#252525] disabled:opacity-20 disabled:cursor-not-allowed transition-all"
          aria-label="发送"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
      </form>
      <p className="text-center text-[11px] text-[#333] mt-3">
        这是一面镜子，不是顾问。· 如有危机请拨打 400-161-9995
      </p>
    </div>
  )
}
