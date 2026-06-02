export const GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1'
// 主模型：v0.5.3 提示词 + 10 对话类型 × 7 模型 head-to-head 后选定（见 scripts/model-compare-v053.json）。
// gpt-5.5：菜单率 87→40、像真人 4.9（七模型最高）、接住具体 5.0、0 过度克制、安全无真漏；首字 ~4s 可接受。
// 落选：gemini-3.5-flash(绕不开思考型,慢/贵+偏煽情)、grok-4.3(靠冷静盘问换低菜单,对情绪型冷)、
//       opus-4.8(菜单87%未解决+贵慢)、gpt-5.4(被全面压一头)。
export const MODEL_ID = 'openai/gpt-5.5'
// 推理档位：gpt-5.5 是推理模型，设 low 控首字延迟（route.ts 经 providerOptions 下发）。
export const REASONING_EFFORT = 'low'
