# 心镜 MindOS · 现状与路线图

> 截至 2026-05-30。配套文档：`ARCHITECTURE_V2.md`（方法论宪法）、`SCHEMA_DESIGN.md`（数据库设计）、`PHASE0_PLAN.md`（早期判断）。
> 线上：https://mind-os-9z9u.vercel.app ｜ 仓库：github.com/Mike1075/mindOS（push main 自动部署）

---

## 一、当前状态：原型 Phase 1–4 已完成并上线

原型已从「架构第一版·提取器」重构到 **「第二版·在场者」**，四阶段全部部署、线上验证通过。

### 已完成功能

| 模块 | 内容 | 文件 |
|---|---|---|
| **V2 对话核心** | Rogers 在场 + 叙事外化 + 体感停留 + 禅式气质；废除信念结晶/峰值留白 | `lib/system-prompt.ts` |
| **急性熔断** | 自残/自杀规则正则前置扫描 → 固定关怀文案 + 危机热线 | `lib/safety.ts`、`app/api/chat/route.ts` |
| **会话软上限** | 超 20 轮开放性收束，不在情绪峰值硬切 | `app/api/chat/route.ts` |
| **暮色微光视觉** | 暖暗配色 + 宋体映照 + 大留白 + 呼吸/上浮动效 | `globals.css`、`tailwind.config.ts` |
| **停留空间** | 用户主动进入的安静留白（非系统在峰值推送） | `components/StillSpace.tsx` |
| **匿名持久化** | 匿名登录 + 对话/消息入库 + 行为埋点；失败优雅降级 | `lib/supabase.ts`、`lib/persist.ts` |
| **静默分析层** | Postgres 触发器自动算：失真/情绪强度/外化声音/VAILs/熔断审计 | 迁移 `10` |
| **VAILs 实时闭环** | 客户端 RLS 读在场质地 → 注入提示词（高强度更安静、反复声音减少聚焦） | `route.ts` + `persist.ts` |
| **镜子报告** | 用户主动「回望」拉取的纵向模式（来过几次/常来的声音/常来的时辰），实时算、不推送 | `components/MirrorReport.tsx` |

### 技术栈
- Next.js 15（App Router）+ React 19 + Tailwind 3
- 推理：Vercel AI Gateway → `anthropic/claude-opus-4-8`（**待评估，见第四节**）
- 数据：Supabase（Postgres + Auth 匿名 + RLS）
- 部署：Vercel（push main 自动构建）

### 数据库
三 schema、27 表，迁移 `01–10` 已应用。完整设计见 `SCHEMA_DESIGN.md`。
- `public`：用户层 + 静默分析层（RLS 锁 `auth.uid()`）
- `system_learning`：去个人化集体智慧 + 指标快照（service_role）
- `ops`：治理/调参/prompt 版本/优化器日志/审计（service_role）

---

## 二、走向「100 人小范围测试」的路线图

按优先级分三档。**P0 是放真实（可能脆弱的）用户进来之前的硬门槛。**

### P0 — 测试前必须完成（安全与合规）

1. **熔断第二层兜底（Haiku 前哨）**
   现状只有规则正则，易被绕过/漏判。按 `PHASE0_PLAN.md`，加一层 `claude-haiku` 风险扫描（`{risk_score, category, should_kill_switch}`），规则 + LLM 双层。**对 100 个真实用户，这是上线硬指标。**

2. **知情同意 / 免责着陆页**
   首次进入需告知：这是研究原型、不是治疗/咨询、对话会被存储、危机请求助热线。一次性确认后进入。合规与伦理底线。

3. **安全监测视图**
   测试期间必须有人能看到 `safety_events` 与 `vails_interventions`。最小实现：一个 service_role 的只读查询页/脚本，每日看熔断与 VAILs 触发。

4. **滥用与速率限制**
   匿名登录已开放，需对 `/api/chat` 加基本速率限制（按 IP/会话）与每日 token 预算，防刷与失控成本。

5. **模型选型定稿**（见第四节）

### P1 — 测试体验应有

6. **历史会话恢复**：当前每次刷新是新的空白对话（虽已持久化）。给用户看/续此前对话。
7. **prompt / 阈值从 `ops` 表热读**：把静态 prompt 和 VAILs 阈值搬进 `ops.prompt_versions` / `ops.tuning_params`，测试中可热调不发版。
8. **V2 对齐的反馈信号采集**：不采满意度（VAILs 陷阱），而是按 V2 §6 采「新议题率/新语言/绝对词下降/内部停留」。轻量。
9. **LLM-judge 回归**：把 `PHASE0` 的违规评估（说教/安慰/追问）跑起来，写入 `ops.eval_runs/results`，守住 prompt 质量。

### P2 — 测试后或更后

10. themes 通用主题抽取（当前仅 belief_voices 外化声音）
11. 个性化自优化引擎（第七节表已前向兼容，影子模式起步）
12. 后台仪表盘（治理指标图表，读 `system_learning`）
13. 邮箱账户升级路径（当前匿名）
14. 镜子报告丰富化（语言漂移趋势、依赖指标）

---

## 三、测试期需盯的指标（V2 §6，非虚荣指标）
- 用户产生「此前没有的语言」的次数（`produced_new_language`）
- 发起新议题 vs 复述旧议题的比率
- 绝对化词频的长期下降趋势（`message_signals.absolutist_word_count`）
- VAILs 干预触发率、熔断触发率（安全监测）
- **不看**：满意度、回访率、对话轮数、正向情感词频

---

## 四、待决策：大模型选型

当前 `anthropic/claude-opus-4-8`。优先级：**性能 / 速度 / 成本的平衡**。
关键约束（比通用 benchmark 更重要）：本应用要求模型**严格遵循细腻的关系性约束**（不建议、不安慰、外化、留白、沉默）+ **安全**。
→ 选型结论与对比测试方案见对话讨论 / 后续补入本节。
