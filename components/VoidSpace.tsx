'use client'

import { useEffect, useState } from 'react'

interface VoidSpaceProps {
  formula: string
  quote: string
  onReturn: () => void
}

export default function VoidSpace({ formula, quote, onReturn }: VoidSpaceProps) {
  const [secondsLeft, setSecondsLeft] = useState(60)
  const [canReturn, setCanReturn] = useState(false)

  useEffect(() => {
    if (secondsLeft <= 0) {
      setCanReturn(true)
      return
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft])

  return (
    <div className="fixed inset-0 bg-void flex flex-col items-center justify-center px-8 void-enter z-50">
      <div className="max-w-lg w-full text-center space-y-12">
        {/* Belief formula */}
        <div className="space-y-2">
          <p className="text-[10px] tracking-[0.3em] text-[#444] uppercase">信念公式</p>
          <p className="text-[22px] font-light text-[#c0c0b8] leading-snug tracking-wide">
            {formula}
          </p>
        </div>

        {/* Void quote */}
        <div>
          <p className="text-[14px] text-[#666] leading-relaxed italic">
            {quote}
          </p>
        </div>

        {/* Timer / return button */}
        <div className="pt-4">
          {!canReturn ? (
            <p className="text-[11px] text-[#333]">
              {secondsLeft} 秒后可以继续
            </p>
          ) : (
            <button
              onClick={onReturn}
              className="text-[12px] text-[#555] hover:text-[#888] transition-colors tracking-widest border border-[#2a2a2a] px-6 py-2 rounded-full hover:border-[#444]"
            >
              回到当下
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
