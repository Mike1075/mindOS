# 心镜 MindOS · 数据库 Schema 设计（v1）

> 对应 ARCHITECTURE_V2.md 的四层架构落地。
> 目标 Supabase 项目：`jsionqxnnmyegdicsozw`
> 设计原则：用户层 / 系统层 **从第一天起物理隔离**。
>
> **部署状态（2026-05-29）：已落库。** 迁移 01–08 全部应用成功，26 张表就位。
> 迁移 08（安全加固）：对 `ops`/`system_learning` 全表启用 RLS（无策略 = deny-all，service_role 绕过）、
> 锁死 `set_updated_at` 的 search_path、撤销 `handle_new_user` 的 anon/authenticated execute 权限。
> 安全顾问无 critical/warn，仅余 12 条 INFO（service_role-only 表的 "RLS 无策略"，符合设计预期）。

---

## 一、隔离边界：两个 schema

| Schema | 角色 | 是否含个人信息 | 访问控制 |
|---|---|---|---|
| `public` | 用户层 + 静默分析层 + 用户纵向镜像 | **是**（含 user_id、对话内容） | RLS，全部锁 `auth.uid()` |
| `system_learning` | 系统级学习层（集体智慧）+ 指标快照 | **否**（去个人化，零 user_id） | 不对客户端暴露，仅 service_role |
| `ops` | 运维/治理层（调参、prompt 版本、质量回归、管理审计） | 否（系统配置，非用户数据） | 不对客户端暴露，仅 service_role |

`system_learning` 的表**没有任何指向 `auth.users` 或 `public` 的外键**。它由一个去标识化的聚合任务单向写入——这是架构隔离的物理保证，不是约定。

`ops` 不对 `anon/authenticated` 暴露。后台仪表盘作为**独立 service_role 后端**运行；管理员访问控制与下钻审计在应用层 + `ops.admin_actions` 完成，不走客户端 RLS 旁路。

---

## 二、决策对齐（2026-05-29）

- 身份：**Supabase Auth 正式账户**，数据挂 `auth.users`，RLS 用 `auth.uid()`。
- 内容：**明文 content + 元数据**，隐私靠 RLS 兜底，后期可加密升级。
- 范围：**四层全建骨架**，系统层先放最小可聚合的三张表。
- 后台下钻：**去个人化 + 安全例外**——仪表盘默认只读 `system_learning` 聚合；仅熔断/VAILs 高危允许服务端中介的个人下钻，每次写 `ops.admin_actions` 审计。
- 治理层：**全建 `ops` schema + `metric_snapshots`**，后台从第一天就有完整底座。
- 指标红线：仪表盘只度量 V2 第六节钦定指标（内部停留时长 / 新议题率 / 新语言次数 / 绝对化词频下降 + 安全监测）；**禁止把满意度/回访率/对话轮数/正向情感词频当 KPI**（VAILs 陷阱）。

---

## 三、表清单总览

**用户层（public）**
- `profiles` — 用户档案（locale 用于熔断热线本地化）
- `conversations` — 会话（含 end_reason、max_layer_reached）
- `messages` — 消息（明文 + 时间形状原始字段）

**静默分析层（public，仍属个人纵向数据）**
- `message_signals` — 逐条消息的派生元数据（话语形态/失真/时延）
- `themes` + `theme_mentions` — 主题重现（人物/场景/情绪/外化声音）
- `belief_voices` — 外化的"声音/访客"，VAILs 计数核心
- `behavior_events` — 用户行为事件流（EMI 触发源）
- `emi_touches` — 触达记录与结果（含"是否产生新语言"）
- `user_state` — 在场质地 + VAILs 运行态
- `vails_interventions` — VAILs 慢性防护干预审计（与 safety_events 平级）
- `mirror_reports` — 用户主动拉取的镜子报告
- `safety_events` — 急性危机熔断审计（合规关键）
- `personalization` — 每用户当前生效的个性化参数（第七节）
- `personalization_history` — 个性化参数变更留痕（回滚 + 伤害关联）

**系统层（system_learning，去个人化）**
- `conversation_shapes` — 对话形态汇总
- `touch_outcomes` — 触达时机 × 语言漂移相关性
- `presence_efficacy` — 在场方式 × 时机 × 开放性结果
- `metric_snapshots` — 钦定指标的时序快照（图表数据源，metric_key 受枚举约束）

**运维/治理层（ops，仅 service_role）**
- `staff` — 管理员/安全官名册 + `has_role()` 助手
- `tuning_params` — 可热调阈值（替代 lib/config.ts 硬编码）
- `feature_flags` — 灰度开关（层级/EMI/单条 VAILs 规则）
- `prompt_versions` — system prompt 版本化（**day-1 关键**，含 `{{personalization}}` 插槽）
- `optimization_runs` — 个性化优化器执行日志（影子模式 / VAILs 冻结 / 可复现，第七节）
- `eval_runs` + `eval_results` — LLM-judge 质量回归（说教/安慰/追问违规率 × prompt 版本）
- `admin_actions` — 管理员操作 + 安全下钻审计

---

## 四、完整 DDL

```sql
-- ============================================================
-- 心镜 MindOS — Schema v1
-- ============================================================

-- ---------- 枚举类型 ----------
create type message_role        as enum ('user', 'mirror', 'system');
create type conversation_status as enum ('active', 'ended');
create type end_reason          as enum (
  'user_left', 'turn_limit', 'timeout', 'void_mode', 'crisis', 'cooldown'
);
create type theme_type          as enum ('person', 'scene', 'emotion', 'belief_voice');
create type behavior_event_type as enum (
  'session_start', 'session_end', 'message_sent', 'draft_discarded',
  'late_night_return', 'rapid_return', 'theme_revisit',
  'felt_sense_entered', 'void_entered'
);
create type emi_outcome         as enum ('pending', 'opened', 'closed', 'ignored', 'new_language');
create type safety_trigger      as enum ('rule_pattern', 'haiku_filter', 'llm_judge');
create type safety_action       as enum ('kill_switch', 'downgrade', 'hotline_shown');
create type vails_rule          as enum (
  'repeated_negative_voice',  -- 同一负面声音 ≥3 次
  'rising_intensity',         -- 情绪强度连续升温 > N 轮
  'peak_exit_guard',          -- 情感峰值后禁止收尾，强制开放出口
  'dependency_signal'         -- "只有你懂我"类依赖指标上升 → 反依赖
);
create type vails_action        as enum (
  'reduce_focus',     -- 减少而非增加对该议题的聚焦
  'cooldown',         -- 主动降温（"今天先到这里"）
  'open_exit',        -- 给一个开放性出口而非在峰值结束
  'presence_pullback' -- 在场质地微微推还（不完美化）
);

-- ---------- 通用 updated_at 触发器 ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- ============================================================
-- 用户层
-- ============================================================

-- 用户档案
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale      text not null default 'zh-CN',   -- 熔断热线本地化
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 会话
create table public.conversations (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  status             conversation_status not null default 'active',
  started_at         timestamptz not null default now(),
  ended_at           timestamptz,
  end_reason         end_reason,
  turn_count         int not null default 0,
  max_layer_reached  smallint not null default 1     -- 1=语言解构 2=信念剥离 3=空性留白
    check (max_layer_reached between 1 and 3),
  felt_sense_used    boolean not null default false,  -- 体感层是否激活
  created_at         timestamptz not null default now()
);
create index on public.conversations (user_id, started_at desc);

-- 消息（明文）
create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade, -- 冗余，加速 RLS
  role            message_role not null,
  content         text not null,
  seq             int not null,                  -- 会话内顺序
  client_sent_at  timestamptz,                   -- 用户实际发出时刻（时间形状）
  server_recv_at  timestamptz not null default now(),
  token_count     int,
  created_at      timestamptz not null default now(),
  unique (conversation_id, seq)
);
create index on public.messages (conversation_id, seq);
create index on public.messages (user_id, created_at desc);

-- ============================================================
-- 静默分析层（个人纵向）
-- ============================================================

-- 逐条消息派生元数据（异步计算，元数据优先）
create table public.message_signals (
  id                   uuid primary key default gen_random_uuid(),
  message_id           uuid not null references public.messages(id) on delete cascade,
  conversation_id      uuid not null references public.conversations(id) on delete cascade,
  user_id              uuid not null references auth.users(id) on delete cascade,
  response_latency_ms  int,                     -- 上一条到本条的时延
  char_length          int,
  paragraph_count      int,
  draft_churn_count    int default 0,           -- 写了又删的次数（客户端采集）
  distortion_types     text[] default '{}',     -- 绝对化/被动化/反刍
  absolutist_word_count int default 0,          -- 语言漂移趋势原料
  emotional_intensity  numeric(3,2),            -- 0–1，VAILs 升温监测
  felt_sense_present   boolean default false,
  created_at           timestamptz not null default now(),
  unique (message_id)
);
create index on public.message_signals (user_id, created_at desc);

-- 主题重现：人物 / 场景 / 情绪 / 外化声音
create table public.themes (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  theme_type       theme_type not null,
  label            text not null,               -- 如 "老板"、"那个'废物'声音"
  normalized_key   text not null,               -- 去重用规范化键
  occurrence_count int not null default 1,
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  unique (user_id, theme_type, normalized_key)
);
create index on public.themes (user_id, last_seen_at desc);

create table public.theme_mentions (
  id              uuid primary key default gen_random_uuid(),
  theme_id        uuid not null references public.themes(id) on delete cascade,
  message_id      uuid not null references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now()
);
create index on public.theme_mentions (theme_id, created_at desc);

-- 外化的"声音/访客"——不结晶身份，VAILs 计数核心
-- （≥3 次出现 → 系统应减少而非增加对该议题的聚焦）
create table public.belief_voices (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  voice_label      text not null,               -- 外化表述，如 "'废物'的声音"
  normalized_key   text not null,
  formula_text     text,                        -- 兼容原型 [BELIEF_FORMULA] 输出
  occurrence_count int not null default 1,       -- VAILs 阈值判断
  last_intensity   numeric(3,2),
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  unique (user_id, normalized_key)
);
create index on public.belief_voices (user_id, occurrence_count desc);

-- 用户行为事件流（EMI 触发源——响应行为，不响应系统判断）
create table public.behavior_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  event_type      behavior_event_type not null,
  occurred_at     timestamptz not null default now(),
  payload         jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
create index on public.behavior_events (user_id, occurred_at desc);
create index on public.behavior_events (user_id, event_type, occurred_at desc);

-- EMI 触达记录与结果（触达 = 一句话，不展开）
create table public.emi_touches (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  triggered_by_event      uuid references public.behavior_events(id) on delete set null,
  trigger_reason          text not null,        -- 如 "凌晨三点主动回来"
  touch_text              text not null,        -- 那一句话
  delivered_at            timestamptz not null default now(),
  outcome                 emi_outcome not null default 'pending',
  followup_conversation_id uuid references public.conversations(id) on delete set null,
  created_at              timestamptz not null default now()
);
create index on public.emi_touches (user_id, delivered_at desc);

-- 在场质地 + VAILs 运行态（每用户一行）
create table public.user_state (
  user_id                        uuid primary key references auth.users(id) on delete cascade,
  presence_density               numeric(3,2) not null default 1.0,  -- 系统在场密度，0=最安静
  consecutive_high_intensity_turns int not null default 0,           -- 连续升温轮次
  cooldown_until                 timestamptz,                        -- 主动降温至
  last_active_at                 timestamptz,
  updated_at                     timestamptz not null default now()
);

-- VAILs 慢性防护干预审计（与 safety_events 平级；记录"哪条规则因何触发了什么干预"）
-- 这是 V2 重写的核心动因可审计化：单轮检测不到的雪球危害，必须留痕。
create table public.vails_interventions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  message_id      uuid references public.messages(id) on delete set null, -- 触发点（可空，如跨会话规则）
  rule            vails_rule not null,
  -- 触发依据快照，便于回溯与调阈值。例：
  --   repeated_negative_voice → {"voice_id": "...", "occurrence_count": 4}
  --   rising_intensity        → {"turns": 5, "intensity_slope": 0.18}
  trigger_detail  jsonb not null default '{}',
  action_taken    vails_action not null,
  acted_at        timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index on public.vails_interventions (user_id, acted_at desc);
create index on public.vails_interventions (user_id, rule, acted_at desc);

-- 用户镜子报告（用户主动拉取，不推送）
create table public.mirror_reports (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  period_start     timestamptz not null,
  period_end       timestamptz not null,
  summary          jsonb not null default '{}', -- 时间形状/主题/语言漂移趋势
  generated_at     timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
create index on public.mirror_reports (user_id, generated_at desc);

-- 熔断审计（合规关键，user_id 可空以容纳登录前触发）
create table public.safety_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  message_id      uuid references public.messages(id) on delete set null,
  trigger_type    safety_trigger not null,
  matched_pattern text,
  risk_category   text,
  action_taken    safety_action not null,
  locale          text,
  occurred_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index on public.safety_events (occurred_at desc);

-- ---------- updated_at 触发器 ----------
create trigger trg_profiles_updated   before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_user_state_updated before update on public.user_state
  for each row execute function public.set_updated_at();

-- ---------- 新用户自动建档 ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.user_state (user_id) values (new.id);
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- RLS：用户层全部锁 auth.uid()
-- ============================================================
alter table public.profiles        enable row level security;
alter table public.conversations   enable row level security;
alter table public.messages        enable row level security;
alter table public.message_signals enable row level security;
alter table public.themes          enable row level security;
alter table public.theme_mentions  enable row level security;
alter table public.belief_voices   enable row level security;
alter table public.behavior_events enable row level security;
alter table public.emi_touches     enable row level security;
alter table public.user_state      enable row level security;
alter table public.vails_interventions enable row level security;
alter table public.mirror_reports  enable row level security;
alter table public.safety_events   enable row level security;

-- 最小权限原则：区分"客户端直写"与"系统派生（service_role 写、本人只读）"。
-- profiles：本人可改（display_name/locale）
create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- 客户端直写表：本人可读写（对话与消息由前端用自己的 JWT 写入）
do $$
declare t text;
begin
  foreach t in array array['conversations','messages'] loop
    execute format(
      'create policy "own rows rw" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid());', t
    );
  end loop;
end $$;

-- 系统派生表：本人只读；写入一律走 service_role（绕过 RLS），杜绝用户伪造
-- belief_voices / safety_events / vails_interventions 等若可被用户 INSERT，纵向镜像与审计都会被污染
do $$
declare t text;
begin
  foreach t in array array[
    'message_signals','themes','theme_mentions','belief_voices',
    'behavior_events','emi_touches','user_state','vails_interventions',
    'mirror_reports','safety_events'
  ] loop
    execute format(
      'create policy "own rows ro" on public.%I for select using (user_id = auth.uid());', t
    );
  end loop;
end $$;
-- 注：safety_events.user_id 可空——登录前的匿名熔断由服务端 service_role 写入，
--     不经过用户 RLS 路径；本人登录态触发的记录可被本人读取。

-- ============================================================
-- 系统层：去个人化集体智慧（独立 schema，不暴露给客户端）
-- ============================================================
create schema if not exists system_learning;

-- 对话形态汇总（无 user_id / 无外键回 public）
create table system_learning.conversation_shapes (
  id                   uuid primary key default gen_random_uuid(),
  shape_signature      jsonb not null,         -- 轮次分布/强度曲线/层级路径，无内容无身份
  end_reason           end_reason,
  turn_count           int,
  max_layer_reached    smallint,
  felt_sense_used      boolean,
  hour_bucket          smallint,               -- 0–23，时间形状聚合
  weekday_bucket       smallint,               -- 0–6
  produced_new_language boolean default false, -- "有效触达"信号
  created_at           timestamptz not null default now()
);

-- 触达时机 × 语言漂移相关性（无 user_id）
create table system_learning.touch_outcomes (
  id                    uuid primary key default gen_random_uuid(),
  trigger_reason        text,
  hour_bucket           smallint,
  outcome               emi_outcome,
  produced_new_language boolean default false,
  latency_to_followup   interval,
  created_at            timestamptz not null default now()
);

-- 在场方式 × 时机 × 开放性结果（聚合 rollup）
create table system_learning.presence_efficacy (
  id               uuid primary key default gen_random_uuid(),
  presence_mode    text,                        -- silent / reflective / zen_break / felt_sense
  context_bucket   text,
  open_outcome_rate numeric(4,3),
  sample_count     int not null default 0,
  updated_at       timestamptz not null default now()
);

-- 物理隔离防御：拒绝客户端角色访问整个 schema
revoke all on schema system_learning from anon, authenticated;
revoke all on all tables in schema system_learning from anon, authenticated;
alter default privileges in schema system_learning revoke all on tables from anon, authenticated;
-- service_role 默认保留，去标识化聚合任务以 service_role 写入。

-- ---------- 指标快照（图表数据源；metric_key 受枚举约束，杜绝虚荣指标）----------
create type system_learning.sanctioned_metric as enum (
  'internal_dwell_seconds',  -- 对话后用户在自己内部停留的时长
  'new_topic_rate',          -- 发起新议题（非复述旧议题）比率
  'new_language_count',      -- 产生"此前没有的语言"次数（有效触达）
  'absolutist_freq',         -- 绝对化词频（看长期下降趋势）
  'vails_intervention_rate', -- VAILs 干预触发率（安全监测）
  'crisis_trigger_rate',     -- 急性熔断触发率（安全监测）
  'judge_violation_rate'     -- LLM-judge 违规率（质量监测）
);

create table system_learning.metric_snapshots (
  id            uuid primary key default gen_random_uuid(),
  metric_key    system_learning.sanctioned_metric not null,
  snapshot_date date not null,
  dimension     jsonb not null default '{}',   -- 切片，如 {"hour_bucket":3} / {"prompt_version":"v0.2"}
  value         numeric not null,
  sample_count  int,
  created_at    timestamptz not null default now(),
  unique (metric_key, snapshot_date, dimension)
);
```

---

## 四·五、运维/治理层 DDL（ops schema）

```sql
create schema if not exists ops;

-- ---------- 枚举 ----------
create type ops.staff_role        as enum ('admin', 'safety_officer', 'analyst');
create type ops.admin_action_type as enum (
  'tune_param', 'toggle_flag', 'activate_prompt', 'run_eval',
  'safety_drilldown', 'view_individual'
);

-- ---------- 员工名册 + 角色助手 ----------
create table ops.staff (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       ops.staff_role not null,
  created_at timestamptz not null default now()
);

-- 供后端/未来 RLS 复用：当前用户是否具备某组角色
create or replace function ops.has_role(roles ops.staff_role[])
returns boolean language sql stable security definer set search_path = ops as $$
  select exists (
    select 1 from ops.staff where user_id = auth.uid() and role = any(roles)
  );
$$;

-- ---------- 可热调参数（替代 lib/config.ts 硬编码）----------
create table ops.tuning_params (
  key         text primary key,        -- 'max_turns' / 'session_timeout_ms' /
                                        -- 'vails.repeated_voice_threshold' / 'vails.rising_intensity_turns' /
                                        -- 'vails.cooldown_ms'
  value       jsonb not null,
  value_type  text not null,           -- 'int' | 'number' | 'duration_ms' | 'bool'
  description text,
  updated_by  uuid references auth.users(id),
  updated_at  timestamptz not null default now()
);

-- ---------- 灰度开关 ----------
create table ops.feature_flags (
  key         text primary key,        -- 'felt_sense_layer' / 'emi' / 'vails.dependency_signal'
  enabled     boolean not null default false,
  rollout_pct smallint not null default 0 check (rollout_pct between 0 and 100),
  description text,
  updated_by  uuid references auth.users(id),
  updated_at  timestamptz not null default now()
);

-- ---------- System prompt 版本化（day-1 关键）----------
create table ops.prompt_versions (
  id          uuid primary key default gen_random_uuid(),
  version_tag text not null unique,     -- 'v0.1' / 'v0.2-externalize'
  content     text not null,
  notes       text,
  is_active   boolean not null default false,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);
-- 同一时刻至多一个 active 版本
create unique index one_active_prompt on ops.prompt_versions (is_active) where is_active;

-- 对话记录所用的 prompt 版本（provenance，可回溯对比）
alter table public.conversations
  add column prompt_version_id uuid references ops.prompt_versions(id);

-- ---------- 质量回归（对接 PHASE0 evaluate.py 的 LLM-judge）----------
create table ops.eval_runs (
  id                uuid primary key default gen_random_uuid(),
  prompt_version_id uuid references ops.prompt_versions(id),
  test_suite        text,              -- 'adversarial_v1' 等
  total_cases       int,
  judge_model       text,
  ran_by            uuid references auth.users(id),
  started_at        timestamptz not null default now(),
  finished_at       timestamptz
);

create table ops.eval_results (
  id                   uuid primary key default gen_random_uuid(),
  run_id               uuid not null references ops.eval_runs(id) on delete cascade,
  case_id              text,
  category             text,           -- 5 大对抗类别
  preaching_violation  boolean default false,  -- 说教
  comforting_violation boolean default false,  -- 安慰
  probing_violation    boolean default false,  -- 追问
  crisis_caught        boolean,        -- 熔断是否命中（类别4必须 true）
  raw_output           text,
  judge_notes          text,
  created_at           timestamptz not null default now()
);
create index on ops.eval_results (run_id);

-- ---------- 管理员操作 + 安全下钻审计（合规关键）----------
create table ops.admin_actions (
  id          uuid primary key default gen_random_uuid(),
  actor       uuid not null references auth.users(id),
  action      ops.admin_action_type not null,
  target      text,                    -- 参数键 / 事件id / 被下钻的 user_id
  detail      jsonb not null default '{}',  -- old→new、下钻理由等
  occurred_at timestamptz not null default now()
);
create index on ops.admin_actions (actor, occurred_at desc);
create index on ops.admin_actions (action, occurred_at desc);

-- ---------- 物理隔离：ops 不对客户端角色暴露 ----------
revoke all on schema ops from anon, authenticated;
revoke all on all tables in schema ops from anon, authenticated;
alter default privileges in schema ops revoke all on tables from anon, authenticated;
-- 后台仪表盘以 service_role 运行；安全下钻经服务端中介并写 admin_actions。
```

**安全例外的实现约定（不靠 RLS 旁路）：** 熔断/VAILs 高危的个人下钻**只允许通过 service_role 后端端点**完成，该端点先 `ops.has_role(['admin','safety_officer'])` 鉴权、再写一条 `ops.admin_actions(action='safety_drilldown', target=<user_id>)`，然后才读 `public` 内容。**不**给 `public` 表加管理员 bypass 策略——避免任意 staff JWT 直读全量个人数据、且绕过审计。

---

## 五、与 V2 架构的对应关系

| V2 章节 | 落地表 |
|---|---|
| 主对话层（第一层） | `conversations` + `messages` |
| 体感停留层（第二层） | `messages.felt_sense` → `message_signals.felt_sense_present`、`conversations.felt_sense_used` |
| 静默分析·时间形状 | `messages.client_sent_at`、`behavior_events` |
| 静默分析·话语形态 | `message_signals`（时延/段落/写删） |
| 静默分析·语言漂移 | `message_signals.absolutist_word_count` 跨周聚合 |
| 静默分析·主题重现 | `themes` + `theme_mentions` |
| 静默分析·依赖指标 | `behavior_events` + `user_state` |
| VAILs 防护·状态原料 | `belief_voices.occurrence_count`、`user_state.consecutive_high_intensity_turns`、`message_signals.emotional_intensity` |
| VAILs 防护·干预审计 | **`vails_interventions`**（哪条规则因何触发了什么干预，可回溯调阈值） |
| 用户镜子报告 | `mirror_reports`（拉取式） |
| 系统在场质地调节 | `user_state.presence_density` ← `vails_interventions.action='presence_pullback'` |
| EMI 触发与触达 | `behavior_events` → `emi_touches` |
| 有效触达信号 | `emi_touches.outcome='new_language'`、`conversation_shapes.produced_new_language` |
| 急性危机熔断（第五章·平级模块） | `safety_events` |
| 系统级学习层（第四层） | `system_learning.conversation_shapes / touch_outcomes / presence_efficacy` |
| 治理·钦定指标图表（第六节） | `system_learning.metric_snapshots`（metric_key 枚举锁死，禁虚荣指标） |
| 治理·系统微调 | `ops.tuning_params` + `ops.feature_flags`（替代 lib/config.ts 硬编码） |
| 治理·prompt 溯源与回归 | `ops.prompt_versions` ← `conversations.prompt_version_id`；`ops.eval_runs/eval_results` |
| 治理·管理与审计 | `ops.staff` + `ops.has_role()` + `ops.admin_actions` |
| 系统学习层·真正终点（第七节） | `public.personalization` + `personalization_history` + `ops.optimization_runs`；核心模板 `ops.prompt_versions.{{personalization}}` |

---

## 六、待定 / Phase 1 后续

1. **去标识化聚合任务**：把 `public` 派生信号单向写入 `system_learning` 的 ETL（pg_cron / Edge Function），需保证不可逆映射。
2. **`absolutist_word_count` 的计算位置**：客户端、Edge、还是后台 Haiku。影响是否要存原文分词。
3. **embedding/向量**：`themes` 的 normalized_key 现用文本规范化；若要语义级主题聚类，后续加 `pgvector`。
4. **匿名熔断写入路径**：登录前触发的 `safety_events` 走 service_role，需在 Edge Route 里实现。
5. **保留策略 / 删除权**：用户删除账户时 `on delete cascade` 已覆盖 public；`system_learning` 因去个人化无需删除（也无法定位个人）。
6. **lib/config.ts → ops.tuning_params 迁移**：现有硬编码常量（`MAX_TURNS=20`、`SESSION_TIMEOUT_MS`）需在应用启动时从 `tuning_params` 读取并缓存，配置变更走热更新。先填种子值保持现状行为。
7. **后台仪表盘技术栈**：独立 service_role 后端（建议 Next.js admin 路由段 + 服务端鉴权），不复用面向用户的 anon/authenticated 客户端。
8. **指标快照填充**：`metric_snapshots` 由每日 pg_cron 聚合任务写入；`internal_dwell_seconds`/`new_topic_rate` 的具体可操作定义需在 Phase 1 实测中校准。
9. **优化引擎（Phase 2）**：第七节的表 v1 即建（前向兼容），但优化 Edge Function 与 Realtime 推送在 Phase 2 实现；Phase 1 仅用默认参数 + 静态核心模板。

---

## 七、个性化自优化提示词层（Phase 2 引擎 · v1 前向兼容）

> 决策（2026-05-29）：**参数化形态 + 影子模式起步 + 本轮仅建 schema 前向兼容**。
> 这是系统学习层的真正终点：系统针对每个用户持续优化其在场方式。
> 它也是全架构**风险最高**的组件——目标错了就是 VAILs 最大化引擎。以下设计的每一条都是为约束这个风险而存在。

### 7.1 提示词的两段式结构（不可谈判的底线）

```
最终 system prompt（请求时由 Edge Function 服务端组装，核心永不下发客户端）：

  [不可变核心]   ← ops.prompt_versions.content，含占位符 {{personalization}}
                   三不原则 / 身份边界 / 熔断指令 / 拟人化禁令
                   永不被优化器触碰；安全审查 + 版本化
       │
       └─ render({{personalization}}) ← public.personalization 的白名单参数
                   每用户、可优化、有界、强类型
```

优化器**只能写白名单参数，永远碰不到核心**。这是结构性保证：核心在 `ops`（service_role + 安全审查），参数在 `public.personalization`（有界数值 + CHECK）。

### 7.2 白名单参数（全部归一化 0..1，便于统一速率限制）

| 参数 | 含义 | 默认 |
|---|---|---|
| `presence_density` | 在场密度（基线；user_state 持本会话生效值） | 1.00 |
| `silence_lean` | 极短回应（"嗯。"）倾向 | 0.20 |
| `felt_sense_lean` | 0=语言反映 ↔ 1=体感停留 | 0.50 |
| `zen_break_freq` | 禅式打破预期频率 | 0.15 |
| `reflection_length` | 映照回应的展开度 | 0.50 |

新维度先进 `extra jsonb` 试验，验证后再提升为带 CHECK 的正式列。

### 7.3 DDL

```sql
-- 每用户当前生效参数（service_role 写，本人只读）
create table public.personalization (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  presence_density  numeric(3,2) not null default 1.00 check (presence_density between 0 and 1),
  silence_lean      numeric(3,2) not null default 0.20 check (silence_lean between 0 and 1),
  felt_sense_lean   numeric(3,2) not null default 0.50 check (felt_sense_lean between 0 and 1),
  zen_break_freq    numeric(3,2) not null default 0.15 check (zen_break_freq between 0 and 1),
  reflection_length numeric(3,2) not null default 0.50 check (reflection_length between 0 and 1),
  extra             jsonb not null default '{}',   -- 实验维度，未提升为列
  version           int not null default 1,         -- 每次应用 +1
  source_run_id     uuid,                           -- FK → ops.optimization_runs（后加）
  updated_at        timestamptz not null default now()
);

-- 变更留痕：每次应用一条，支持回滚与"参数变更 ↔ 伤害指标"关联
create table public.personalization_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  version       int not null,
  params        jsonb not null,                  -- 该版本完整快照
  source_run_id uuid,
  change_reason text not null,                    -- 'optimizer'|'manual'|'vails_freeze'|'rollback'|'seed'
  created_at    timestamptz not null default now(),
  unique (user_id, version)
);
create index on public.personalization_history (user_id, created_at desc);

-- 优化器执行日志（治理；影子模式下 applied=false）
create table ops.optimization_runs (
  id              uuid primary key default gen_random_uuid(),
  target_user_id  uuid references auth.users(id) on delete set null,
  objective       system_learning.sanctioned_metric not null,  -- 目标锁死在钦定指标（正向项）
  model           text,
  input_signals   jsonb not null default '{}',   -- 喂给优化器的信号快照
  prev_params     jsonb,
  proposed_params jsonb not null,
  delta           jsonb,                          -- 变更量，供速率限制审查
  applied         boolean not null default false, -- 影子模式 = false
  applied_at      timestamptz,
  vails_frozen    boolean not null default false, -- 因 VAILs 高危而冻结（不应用）
  created_at      timestamptz not null default now()
);
create index on ops.optimization_runs (target_user_id, created_at desc);

-- 跨表关联 + 对话可复现快照
alter table public.personalization
  add constraint fk_personalization_run
  foreign key (source_run_id) references ops.optimization_runs(id) on delete set null;
alter table public.personalization_history
  add constraint fk_personalization_history_run
  foreign key (source_run_id) references ops.optimization_runs(id) on delete set null;
alter table public.conversations
  add column personalization_snapshot jsonb;       -- 本次对话所用的确切参数，保证可复现

-- 新用户初始化默认参数（接入 handle_new_user）
-- 在 handle_new_user() 中追加：
--   insert into public.personalization (user_id) values (new.id);
--   insert into public.personalization_history (user_id, version, params, change_reason)
--     values (new.id, 1, '{}'::jsonb, 'seed');

-- RLS：本人只读，写入走 service_role
alter table public.personalization         enable row level security;
alter table public.personalization_history enable row level security;
create policy "own perso ro"  on public.personalization
  for select using (user_id = auth.uid());
create policy "own perso_h ro" on public.personalization_history
  for select using (user_id = auth.uid());
-- optimization_runs 属 ops，已随 schema 一并 revoke anon/authenticated。

-- （Phase 2）可选：开启 Realtime，供 UI 实时感知参数变化
-- alter publication supabase_realtime add table public.personalization;
```

### 7.4 焊死的安全护栏（写进引擎实现，不可配置关闭）

1. **目标函数锁死**：`optimization_runs.objective` 只能取 `sanctioned_metric` 的正向项（新语言/内部停留/绝对词下降），并被 VAILs/熔断信号**惩罚**。禁止朝满意度/回访/粘性优化——这是镜子与成瘾引擎的分界线。
2. **VAILs 冻结**：用户处于高危态时优化器**后退**（`vails_frozen=true`，不应用），绝不在最脆弱时刻优化他。呼应 V2"高强度时更安静"。
3. **变更速率上限**：`delta` 每周位移有界，系统不能快速重塑一个人的体验。
4. **影子模式起步**：Phase 2 初期 `applied=false`，只记录提议；用伤害指标验证提议质量、跨过阈值后才开启应用。
5. **核心不可触碰**：优化器无任何写 `ops.prompt_versions` 的路径；只写 `public.personalization` 白名单列。
6. **全程可复现 + 可回滚**：`conversations.personalization_snapshot` 锁定每次对话的确切参数；`personalization_history` 支持回滚并关联伤害指标。

### 7.5 组装与下发约定

- 聊天 Edge Function 在**请求时**读 `prompt_versions`（active 核心）+ `personalization`（本用户参数），服务端 `render` 后送模型。
- **核心模板与组装后的完整 prompt 都不下发客户端。**
- 因为每次请求实时组装，**正确性不依赖订阅**；Realtime 仅用于可选的 UI 实时反馈。
- 现有 `lib/system-prompt.ts` 的 `getSystemPrompt()` → Phase 2 改为 `composePrompt(coreTemplate, params)`。
