'use client'

// 停留空间：用户主动进入的安静留白（不是系统在峰值时把人推进来）。
// 对齐 V2 — 用户掌控，随时可回；只是停在这里，不需要做什么。

interface StillSpaceProps {
  onReturn: () => void
}

export default function StillSpace({ onReturn }: StillSpaceProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8 soft-in"
      style={{ background: 'radial-gradient(130% 90% at 50% 38%, #2a1a40 0%, #150b20 70%)' }}
    >
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-14 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full border border-gold-dim/40 breathe" />
          <div className="absolute w-2 h-2 rounded-full bg-gold/60" />
        </div>

        <p className="font-song text-ink-soft text-[18px] leading-loose mb-3">只是停在这里。</p>
        <p className="text-ink-dim text-[13px] leading-relaxed mb-16">
          不需要做什么。
          <br />
          让呼吸跟着这个圆，慢下来。
        </p>

        <button
          onClick={onReturn}
          className="text-[12px] text-ink-dim hover:text-ink-soft transition-colors tracking-[0.3em] border border-line hover:border-gold-dim rounded-full px-7 py-2.5"
        >
          回到对话
        </button>
      </div>
    </div>
  )
}
