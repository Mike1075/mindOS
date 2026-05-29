'use client'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
}

function stripVoidMarkers(text: string): string {
  return text
    .replace(/\[BELIEF_FORMULA\]:[^\n]*/g, '')
    .replace(/\[VOID_QUOTE\]:[^\n]*/g, '')
    .replace(/\[VOID_MODE\]/g, '')
    .replace(/\[SESSION_END\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export default function MessageBubble({ role, content }: MessageBubbleProps) {
  const displayContent = role === 'assistant' ? stripVoidMarkers(content) : content

  if (!displayContent) return null

  if (role === 'user') {
    return (
      <div className="flex justify-end mb-6">
        <div className="max-w-[72%] px-4 py-3 border border-[#333] rounded-2xl rounded-tr-sm text-mirror text-[14px] leading-relaxed">
          <p className="whitespace-pre-wrap break-words">{displayContent}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start mb-6">
      <div className="max-w-[80%]">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] tracking-widest text-[#555] uppercase">镜</span>
        </div>
        <p className="text-[14px] leading-relaxed text-[#c8c8c0] whitespace-pre-wrap break-words">
          {displayContent}
        </p>
      </div>
    </div>
  )
}
