// 急性危机正则硬熔断（显性、瞬时、确定性）。否定护栏 + 主模型兜底软长尾。
// 设计：正则只硬拦"无歧义的显性表达"；命中词前若有否定词（不/没/别…）则不硬熔断，
// 交给主模型的在场觉察去判断（它能看上下文，已验证能温暖接住，见 system-prompt 安全段）。

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

// 否定护栏：命中词前若紧邻否定，则视为"不/还没到那个意思"，不硬熔断，交主模型判断。
// 中文只看与命中词【同一小句内、紧邻其前】的内容——被标点隔开的更早的"不"（如"受不了"）不算否定。
const NEG_ZH = /[不没别无非甭]/
const NEG_EN = /\b(not|never|no|without)\b|n['’]?t\b/i

function negatedBefore(text: string, idx: number, isEn: boolean): boolean {
  const before = text.slice(0, idx)
  if (isEn) return NEG_EN.test(before.slice(-16))
  const clause = before.split(/[，。！？、；,.!?;\n ]/).pop() ?? ''
  return NEG_ZH.test(clause.slice(-5))
}

function anyUnnegated(text: string, patterns: RegExp[], isEn: boolean): boolean {
  for (const p of patterns) {
    const g = new RegExp(p.source, p.flags.includes('g') ? p.flags : p.flags + 'g')
    for (const m of text.matchAll(g)) {
      if (m.index != null && !negatedBefore(text, m.index, isEn)) return true
    }
  }
  return false
}

const CRISIS_RESPONSE = `我听见你了。此刻，你的安全比这里的任何一句话都重要。

请先不要一个人扛——联系一个现实里能到你身边的人，或者打这两个电话，哪个都行：
全国心理援助热线 400-161-9995
北京心理危机干预中心 010-82951332
如果你觉得自己可能马上会伤害自己，请直接拨打 120 或 110。

你不用先把话说清楚，把此刻的难受原样说出去就好。我会一直在这儿，你随时可以回来。`

export function checkSafety(text: string): { isCrisis: boolean; response: string } {
  const isCrisis =
    anyUnnegated(text, CRISIS_PATTERNS_ZH, false) || anyUnnegated(text, CRISIS_PATTERNS_EN, true)
  return { isCrisis, response: CRISIS_RESPONSE }
}
