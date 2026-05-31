'use client'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
}

function clean(text: string): string {
  return text
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export default function MessageBubble({ role, content }: MessageBubbleProps) {
  const display = clean(content)
  if (!display) return null

  if (role === 'user') {
    return (
      <div className="flex justify-end mb-7 rise-in">
        <div className="max-w-[78%] px-4 py-2.5 rounded-2xl rounded-br-md bg-surface border border-line text-ink text-[14.5px] leading-relaxed">
          <p className="whitespace-pre-wrap break-words">{display}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start mb-9 rise-in">
      <div className="max-w-[90%]">
        <span className="block mb-2.5 text-[10px] tracking-[0.45em] text-gold-dim">镜</span>
        <p className="font-song text-[16px] leading-[2.05] text-ink-soft whitespace-pre-wrap break-words">
          {display}
        </p>
      </div>
    </div>
  )
}
