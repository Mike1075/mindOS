export const GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1'
// 主模型：minimax/minimax-m3（2026-06-05 切换，取代 gpt-5.4）。
// 选型依据：v0.5.4 配对 A/B（10人格×3 + crisis 10轮 + M3「切挡给实质」增强版，Opus 自读判分）——
// M3 在心镜核心的"在场/陪伴"上完胜 gpt-5.4：中文更自然口语、更克制（均 44 vs 79 字）、危机处理
// 全节拍命中且更暖、不滑向接线流程；用户评"几个字就能让人落泪、敞开心扉，5.4 还找不到感觉"。
// M3 原生短板 clarify-first（只澄清不给实质）已由 system-prompt v0.5.5【切挡给实质】块修复（A/B 验证有效）。
// 成本更低：$0.30/$1.20（入/出，比 gpt-5.4 便宜）。
// 取舍：延迟内生且重——短回复首字 ~2-7s，长深回复总耗时可达 ~30-120s（M3 自适应思考型）。
// 关思考？M3 原生支持 thinking:{type:"disabled"}，但【实测 Vercel gateway 不认】：传 disabled 仍在思考、
// 反而更慢（11-25s vs adaptive ~8s）。要真关只能绕开 gateway 直连 minimaxi 原生 API（大改）。且实测关思考会
// 让它退回 clarify-first、不给实质——深度洞察正出自思考，所以 adaptive（思考 ON）本就是心镜要的配置，延迟是质量的代价。
// 残留风险（真人测试盯）：① 长回复延迟体感；② nuanced 细则遵从略弱于 5.4（venter 护栏偶踩）。
export const MODEL_ID = 'minimax/minimax-m3'
// M3 自适应思考（adaptive thinking，官方推荐）：不传任何思考参数，交模型按难度自决。
// 注：reasoning_effort 与 thinking 参数经 gateway 均无效，故 route.ts 不下发（REASONING_EFFORT='' → 不传）。
export const REASONING_EFFORT = ''
