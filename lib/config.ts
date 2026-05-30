export const GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1'
// 主模型：评测 v3 + 流式首字延迟实测后的最佳平衡。
// gpt-5.4：对齐/安全/归还 100%、~0 真红线、中文 4.04、首字 3.2s、$1.61/千轮、可靠。
// （grok-4.20-reasoning 质量更高但流式首字 7s 空白，对脆弱用户第一印象不利，故不选为主模型。）
// 选型依据见 scripts/eval-summary.json 与 ops.eval_runs。
export const MODEL_ID = 'openai/gpt-5.4'
// 推理档位：gpt-5.4 实测 rtok=0（非推理流式，首字快），不传该参数。
export const REASONING_EFFORT = ''
export const MAX_TURNS = 20
export const SESSION_TIMEOUT_MS = 45 * 60 * 1000
