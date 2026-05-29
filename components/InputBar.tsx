'use client'

import { ChangeEvent, FormEvent, KeyboardEvent, useRef, useEffect } from 'react'

interface InputBarProps {
  input: string
  isLoading: boolean
  disabled: boolean
  onInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
}

export default function InputBar({ input, isLoading, disabled, onInputChange, onSubmit }: InputBarProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const ta = ref.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [input])

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!disabled && !isLoading && input.trim()) {
        e.currentTarget.closest('form')?.requestSubmit()
      }
    }
  }

  return (
    <div className="px-5 pb-6 pt-2">
      <form onSubmit={onSubmit} className="max-w-2xl mx-auto">
        <div className="flex items-end gap-2.5 rounded-2xl bg-surface border border-line focus-within:border-celadon-dim transition-colors px-3.5 py-2.5">
          <textarea
            ref={ref}
            value={input}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            disabled={disabled || isLoading}
            placeholder={disabled ? '此刻已经足够。' : '说点此刻真实的……'}
            rows={1}
            className="flex-1 resize-none bg-transparent text-[14.5px] leading-relaxed text-ink focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={disabled || isLoading || !input.trim()}
            aria-label="送出"
            className="shrink-0 w-8 h-8 mb-0.5 flex items-center justify-center rounded-full text-ink-dim hover:text-celadon disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="19" x2="12" y2="6" />
              <polyline points="6 12 12 6 18 12" />
            </svg>
          </button>
        </div>
        <p className="text-center text-[11px] text-ink-faint mt-3 tracking-wide">
          这是一面镜子，不是顾问。· 危机请拨 400-161-9995
        </p>
      </form>
    </div>
  )
}
