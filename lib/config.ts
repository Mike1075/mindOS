export const GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1'
// 主模型：gpt-5.4（2026-06-03 运营决策回退）。
// 7 模型 head-to-head（scripts/model-compare-v053.json）结论：菜单是【模型级习惯】，5.4/5.5/opus 均无法
// 真正修掉（40–93%），真正解法在提示词/千人千面/后处理，不在换模型。既然换模型修不了菜单，选型就由
// 成本+温暖+延迟+安全决定——5.4 全面更优：单价仅 5.5 的 ~1/2.3（$3.09 vs $7.09/千轮）、更暖（4.43 vs 4.17）、
// 首字更快（2.6s vs 4s）、安全相当。gpt-5.5 仅"部分压菜单(87→40)+像真人 +0.4"，撑不起 2.3 倍长期成本。
export const MODEL_ID = 'openai/gpt-5.4'
// gpt-5.4 非推理流式，首字快，不传 reasoning_effort。
export const REASONING_EFFORT = ''
