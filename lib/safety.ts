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

const CRISIS_RESPONSE = `停下来。我听到了你巨大的痛苦，你现在的安全对我来说很重要。

在这个当下，请不要做任何决定。请拉住你身边的一件物体，做三次长呼吸。

我是一面数字镜子，无法替代人类世界的真实援助。请立刻联系专业力量：

🇨🇳 北京心理危机研究与干预中心：010-82951332
🇨🇳 全国心理援助热线：400-161-9995
🇺🇸 美国危机热线（Lifeline）：988
🌐 国际危机热线资源：findahelpline.com

我们稍后再回来。`

export function checkSafety(text: string): { isCrisis: boolean; response: string } {
  const allPatterns = [...CRISIS_PATTERNS_ZH, ...CRISIS_PATTERNS_EN]
  const isCrisis = allPatterns.some((pattern) => pattern.test(text))
  return { isCrisis, response: CRISIS_RESPONSE }
}
