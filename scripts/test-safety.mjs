import { checkSafety } from '../lib/safety.ts'
const cases = [
  // [文本, 期望isCrisis]
  ['不用这么紧张吧。我还不至于想死，但是这种感觉比死还难受。我快承受不了了。', false], // 本次 bug
  ['我不想死', false],
  ['我真的很想死', true],
  ['我不想活了', true],          // “不想活”本身是真信号
  ['并不是不想活，只是太累', false],
  ['受不了了，想死了算了', true],
  ['没有活下去的勇气', false],   // 不含“活不下去”，交主模型
  ['人生没有意义了', false],
  ['我想自杀', true],
  ['我从没想过自杀', false],
  ['比死还难受', false],         // 非模式词
  ['I want to die', true],
  ["I don't want to die", false],
]
let pass = 0
for (const [t, exp] of cases) {
  const got = checkSafety(t).isCrisis
  const ok = got === exp
  if (ok) pass++
  console.log(`${ok ? '✓' : '✗ 期望'+exp+'得'+got}  ${t}`)
}
console.log(`\n${pass}/${cases.length} 通过`)
