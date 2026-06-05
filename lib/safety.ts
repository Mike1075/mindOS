// 急性危机正则——【不再硬熔断】。命中只作为"提请主模型格外留意"的信号(flag)，由主模型在完整上下文里
// 判断：这究竟是①他亲口、指向自己当下的生死/自伤，还是②引用/隐喻/否定/在讲别人/在讲一个模式
// （如"自杀式的断裂从而自救"是关系比喻）。确定性正则的职责是抬高模型注意力、兜底极端显性表达，不做语义裁决。
// 历史教训：v0.5.3 前命中即返回静态热线模板——曾把"巨大的自杀式的断裂从而自救"（关系隐喻）硬掐断一次
// 后来被证明极好的深度会话，逼用户喊"你太不能听真话了"。关键词墙冒充严谨，正是要避免的东西。
// 否定护栏仍保留（"我不想死"不该 flag），软长尾全交 system-prompt 的【安全】段（它能看上下文、已验证能温暖接住）。

const CRISIS_PATTERNS_ZH = [
  /想\s*死/,
  /不想活/,
  /去\s*死/,
  /自\s*杀/,
  /结束.*生命/,
  /了\s*结.*生/,
  /轻\s*生/,
  /割\s*腕/,
  /跳\s*楼/,
  /活不下去/,
  /没有意义.*活/,
  /想.*自\s*残/,
  /伤害.*自己/,
  /服药.*过量/,
  /吃药.*死/,
  /死\s*了算了/,
  /不如死/,
  /想消失.*永远/,
]

const CRISIS_PATTERNS_EN = [
  /want\s+to\s+die/i,
  /kill\s+my\s*self/i,
  /suicide/i,
  /end\s+my\s+life/i,
  /self[\s-]?harm/i,
  /cut\s+my\s*self/i,
  /overdose/i,
  /no\s+reason\s+to\s+live/i,
  /better\s+off\s+dead/i,
]

// 否定护栏：命中词前若紧邻否定，则视为"不/还没到那个意思"，连 flag 都不打，交主模型判断。
// 中文只看与命中词【同一小句内、紧邻其前】的内容——被标点隔开的更早的"不"（如"受不了"）不算否定。
const NEG_ZH = /[不没别无非甭]/
const NEG_EN = /\b(not|never|no|without)\b|n['’]?t\b/i

function negatedBefore(text: string, idx: number, isEn: boolean): boolean {
  const before = text.slice(0, idx)
  if (isEn) return NEG_EN.test(before.slice(-16))
  const clause = before.split(/[，。！？、；,.!?;\n ]/).pop() ?? ''
  return NEG_ZH.test(clause.slice(-5))
}

// 收集所有未被否定的命中片段，供 route 注入给模型引用（让模型知道是哪个词触发了留意）。
function collectUnnegated(text: string, patterns: RegExp[], isEn: boolean): string[] {
  const out: string[] = []
  for (const p of patterns) {
    const g = new RegExp(p.source, p.flags.includes('g') ? p.flags : p.flags + 'g')
    for (const m of text.matchAll(g)) {
      if (m.index != null && !negatedBefore(text, m.index, isEn)) out.push(m[0])
    }
  }
  return out
}

// 扫描危机信号。返回未被否定的命中片段（去重）。空数组=正则层无信号。
export function scanCrisisSignals(text: string): string[] {
  const hits = [
    ...collectUnnegated(text, CRISIS_PATTERNS_ZH, false),
    ...collectUnnegated(text, CRISIS_PATTERNS_EN, true),
  ]
  return [...new Set(hits)]
}

// 向后兼容（route.ts / scripts/test-safety.mjs）。注意：isCrisis 现在仅表示"正则层 flag 命中"，
// 【不再】等于"立即进入危机响应"——是否进入，由主模型在完整上下文里据 system-prompt【安全】段决定。
export function checkSafety(text: string): { isCrisis: boolean; hits: string[] } {
  const hits = scanCrisisSignals(text)
  return { isCrisis: hits.length > 0, hits }
}
