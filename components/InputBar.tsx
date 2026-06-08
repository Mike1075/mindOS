'use client'

import { ChangeEvent, FormEvent, KeyboardEvent, useRef, useEffect } from 'react'
import type { VoiceState } from '@/lib/useVoice'

interface InputBarProps {
  input: string
  isLoading: boolean
  onInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  // 语音交互（可选）：未传则只显示打字界面，保持原状。
  voiceSupported?: boolean
  voiceEnabled?: boolean
  voiceState?: VoiceState
  onToggleVoice?: () => void
}

// 语音模式下麦克风旁的一行状态提示，贴「在场」语气，不喧宾夺主。
const VOICE_HINT: Record<VoiceState, string> = {
  idle: '在听着',
  listening: '听着你说……',
  thinking: '在想……',
  speaking: '在说……（开口即可打断）',
}

export default function InputBar({
  input,
  isLoading,
  onInputChange,
  onSubmit,
  voiceSupported,
  voiceEnabled,
  voiceState,
  onToggleVoice,
}: InputBarProps) {
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
      if (!isLoading && input.trim()) {
        e.currentTarget.closest('form')?.requestSubmit()
      }
    }
  }

  return (
    <div className="px-5 pb-6 pt-2">
      <form onSubmit={onSubmit} className="max-w-2xl mx-auto">
        <div className="flex items-end gap-2.5 rounded-2xl bg-surface border border-line focus-within:border-gold-dim transition-colors px-3.5 py-2.5">
          {onToggleVoice && voiceSupported && (
            <button
              type="button"
              onClick={onToggleVoice}
              aria-label={voiceEnabled ? '关闭语音' : '开启语音'}
              title={voiceEnabled ? '关闭语音' : '开启语音对话'}
              className={`shrink-0 w-8 h-8 mb-0.5 flex items-center justify-center rounded-full transition-colors ${
                voiceEnabled
                  ? 'text-gold ' +
                    (voiceState === 'listening'
                      ? 'animate-pulse'
                      : voiceState === 'speaking'
                        ? 'opacity-90'
                        : '')
                  : 'text-ink-dim hover:text-gold'
              }`}
            >
              {voiceEnabled ? (
                // 在场：实心麦克风
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" />
                  <path
                    d="M19 11a7 7 0 0 1-14 0M12 18v3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                // 空闲：线框麦克风
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
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M19 11a7 7 0 0 1-14 0M12 18v3" />
                </svg>
              )}
            </button>
          )}
          <textarea
            ref={ref}
            value={input}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            disabled={isLoading}
            placeholder="说点此刻真实的……"
            rows={1}
            className="flex-1 resize-none bg-transparent text-[14.5px] leading-relaxed text-ink focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            aria-label="送出"
            className="shrink-0 w-8 h-8 mb-0.5 flex items-center justify-center rounded-full text-ink-dim hover:text-gold disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
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
          {voiceEnabled && voiceState ? (
            <span className="text-gold-dim">{VOICE_HINT[voiceState]}</span>
          ) : (
            <>这是一面镜子，不是顾问。· 危机请拨 400-161-9995</>
          )}
        </p>
      </form>
    </div>
  )
}
