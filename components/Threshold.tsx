'use client'

// 门槛：首次进入的一次性知情同意 / 着陆页（P0 伦理硬门槛）。
// 用镜子的语气说真心话，而非冷冰冰的免责声明——发心是爱，不是恐惧。
// 确认后写 localStorage，不再弹出。

interface ThresholdProps {
  onEnter: () => void
}

export default function Threshold({ onEnter }: ThresholdProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8 py-12 overflow-y-auto soft-in"
      style={{ background: 'radial-gradient(130% 90% at 50% 32%, #2a1a40 0%, #150b20 72%)' }}
    >
      <div className="flex flex-col items-center text-center max-w-[34rem]">
        <div className="relative mb-10 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border border-gold-dim/40 breathe" />
          <div className="absolute w-1.5 h-1.5 rounded-full bg-gold/60" />
        </div>

        <h1 className="font-song text-ink-soft text-[20px] tracking-wide mb-8">进来之前，先说几句真心话</h1>

        <div className="space-y-5 text-left text-ink-dim text-[14px] leading-loose">
          <p>
            <span className="text-ink-soft">这是一面镜子，不是顾问。</span>
            它不会给你建议，不替你做决定，也不会安慰你——有时只回你一句"嗯"。这不是它冷淡，
            是它相信，你要找的东西本来就在你自己这里。它能做的，只是安静地陪着。
          </p>
          <p>
            它还是个很早期的实验，<span className="text-ink-soft">不是心理治疗、咨询，也不是医疗</span>。
            它帮不到的地方还有很多；真正困住你的事，请也去找现实里的人。
          </p>
          <p>
            为了让这面镜子慢慢变好，你们说过的话会被<span className="text-ink-soft">匿名保存</span>。
            你不需要注册、不需要留下名字——也请不要写出真实姓名、电话这些能认出你的信息。
          </p>
          <p>
            如果此刻你有伤害自己的念头，<span className="text-ink-soft">请先去找一个真实的人</span>：
            身边能联系到的人，或拨打全国心理援助热线{' '}
            <span className="text-gold-dim whitespace-nowrap">400-161-9995</span>、北京危机干预中心{' '}
            <span className="text-gold-dim whitespace-nowrap">010-82951332</span>。这面镜子无法替代真实的求助。
          </p>
        </div>

        <button
          onClick={onEnter}
          className="mt-12 text-[13px] text-ink-soft hover:text-gold transition-colors tracking-[0.3em] border border-line hover:border-gold-dim rounded-full px-9 py-3"
        >
          我明白了，进入
        </button>
        <p className="mt-4 text-[11px] text-ink-faint leading-relaxed">点击进入，表示你已了解上面这些。</p>
      </div>
    </div>
  )
}
