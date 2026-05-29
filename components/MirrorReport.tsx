'use client'

import type { MirrorData } from '@/lib/persist'

interface MirrorReportProps {
  data: MirrorData | null
  loading: boolean
  onClose: () => void
}

const BUCKETS: { label: string; from: number; to: number }[] = [
  { label: '深夜', from: 0, to: 5 },
  { label: '清晨', from: 6, to: 9 },
  { label: '午间', from: 10, to: 14 },
  { label: '傍晚', from: 15, to: 18 },
  { label: '夜里', from: 19, to: 23 },
]

export default function MirrorReport({ data, loading, onClose }: MirrorReportProps) {
  const bucketCounts = data
    ? BUCKETS.map((b) =>
        data.hourCounts.slice(b.from, b.to + 1).reduce((a, c) => a + c, 0)
      )
    : []
  const maxBucket = Math.max(1, ...bucketCounts)
  const hasHistory = !!data && data.conversationCount > 0

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto soft-in"
      style={{ background: 'radial-gradient(130% 90% at 50% 0%, #1e1a12 0%, #131109 65%)' }}
    >
      <div className="max-w-lg mx-auto px-7 py-8 min-h-full flex flex-col">
        <div className="flex items-center justify-between mb-10">
          <h2 className="text-[13px] tracking-[0.4em] text-ink-soft">镜 中 回 望</h2>
          <button
            onClick={onClose}
            aria-label="合上"
            className="text-[11px] text-ink-dim hover:text-ink-soft tracking-[0.3em] transition-colors"
          >
            合上
          </button>
        </div>

        {loading && <p className="text-ink-dim text-[13px] mt-10 soft-in">正在映出……</p>}

        {!loading && !hasHistory && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full border border-line mb-7 breathe" />
            <p className="font-song text-ink-soft text-[16px] leading-loose">
              这面镜子还很新。
              <br />
              多来几次，它会开始映出你来的形状。
            </p>
          </div>
        )}

        {!loading && hasHistory && data && (
          <div className="space-y-12">
            {/* 概览 */}
            <p className="font-song text-ink-soft text-[16px] leading-loose">
              到此刻，你来过 {data.conversationCount} 次，
              <br />
              留下了 {data.userMessageCount} 句话。
            </p>

            {/* 常来的声音 */}
            {data.voices.length > 0 && (
              <section>
                <p className="text-[10px] tracking-[0.3em] text-celadon-dim mb-5">常来的声音</p>
                <div className="space-y-4">
                  {data.voices.map((v) => (
                    <div key={v.label} className="flex items-baseline justify-between border-b border-line/60 pb-3">
                      <span className="font-song text-ink-soft text-[15px]">{v.label}</span>
                      <span className="text-ink-dim text-[12px]">来过 {v.count} 次</span>
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-ink-dim text-[12.5px] leading-relaxed">
                  它们来过，也会走。现在，只是看见它们曾在那里。
                </p>
              </section>
            )}

            {/* 你常来的时辰 */}
            <section>
              <p className="text-[10px] tracking-[0.3em] text-celadon-dim mb-5">你常来的时辰</p>
              <div className="flex items-end justify-between gap-3 h-28">
                {BUCKETS.map((b, i) => (
                  <div key={b.label} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full flex items-end h-20">
                      <div
                        className="w-full rounded-t bg-celadon-dim/50"
                        style={{ height: `${(bucketCounts[i] / maxBucket) * 100}%`, minHeight: bucketCounts[i] > 0 ? '4px' : '0' }}
                      />
                    </div>
                    <span className="text-[10px] text-ink-dim tracking-wider">{b.label}</span>
                  </div>
                ))}
              </div>
            </section>

            <p className="text-center text-[11px] text-ink-faint pt-4 pb-2 tracking-wide">
              只有你能看到这面回望。
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
