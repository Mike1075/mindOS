'use client'

// 客户端持久化层（best-effort）。任何失败都静默降级，绝不影响对话本身。
// 写入路径全部受 RLS 约束：conversations/messages 本人可写，behavior_events 本人可插入自身事件。

import { getSupabase } from './supabase'
import type { Json } from './database.types'

let cachedUserId: string | null = null

/** 确保有一个用户身份（匿名登录）。返回 user id，失败返回 null（降级为无状态）。 */
export async function ensureUser(): Promise<string | null> {
  const sb = getSupabase()
  if (!sb) return null
  if (cachedUserId) return cachedUserId
  try {
    const {
      data: { session },
    } = await sb.auth.getSession()
    if (session?.user) {
      cachedUserId = session.user.id
      return cachedUserId
    }
    const { data, error } = await sb.auth.signInAnonymously()
    if (error || !data.user) return null
    cachedUserId = data.user.id
    return cachedUserId
  } catch {
    return null
  }
}

/** 懒创建会话，返回 conversation id。 */
export async function createConversation(userId: string): Promise<string | null> {
  const sb = getSupabase()
  if (!sb) return null
  try {
    const { data, error } = await sb
      .from('conversations')
      .insert({ user_id: userId })
      .select('id')
      .single()
    if (error || !data) return null
    return data.id
  } catch {
    return null
  }
}

/** 持久化一轮对话：用户消息(seq) + 镜子回应(seq+1)，并更新会话轮次。 */
export async function persistTurn(params: {
  conversationId: string
  userId: string
  seq: number
  userText: string
  mirrorText: string
  clientSentAt?: string | null
}): Promise<void> {
  const sb = getSupabase()
  if (!sb) return
  const { conversationId, userId, seq, userText, mirrorText, clientSentAt } = params
  try {
    await sb.from('messages').insert([
      {
        conversation_id: conversationId,
        user_id: userId,
        role: 'user',
        content: userText,
        seq,
        client_sent_at: clientSentAt ?? null,
      },
      {
        conversation_id: conversationId,
        user_id: userId,
        role: 'mirror',
        content: mirrorText,
        seq: seq + 1,
      },
    ])
    await sb
      .from('conversations')
      .update({ turn_count: Math.floor(seq / 2) + 1 })
      .eq('id', conversationId)
  } catch {
    /* no-op */
  }
}

export interface PresenceContext {
  repeatedVoices: string[]
}

/**
 * 读取本用户当前的"在场质地"信号（RLS：本人可读）。
 * 只保留"反复负面声音→不与固化身份共谋"这一条；已退役"升温→变冷"的强度/冷却信号
 * （生态学谬误 + 实测无效，违背"先是个温暖的人"的全局原则）。
 */
export async function getPresenceContext(userId: string): Promise<PresenceContext | null> {
  const sb = getSupabase()
  if (!sb) return null
  try {
    const { data: voices } = await sb
      .from('belief_voices')
      .select('voice_label, occurrence_count')
      .eq('user_id', userId)
      .gte('occurrence_count', 3)
    const repeatedVoices = (voices ?? []).map((v) => v.voice_label)
    return { repeatedVoices }
  } catch {
    return null
  }
}

export interface MirrorData {
  conversationCount: number
  userMessageCount: number
  voices: { label: string; count: number }[]
  hourCounts: number[] // 长度 24
}

/**
 * 用户镜子报告数据：跨时间的纵向模式。用户主动拉取，绝不推送（V2 §3）。
 * 全部从本人 RLS 可读的源表实时计算，不落库、不在对话中弹出。
 */
export async function getMirrorData(userId: string): Promise<MirrorData | null> {
  const sb = getSupabase()
  if (!sb) return null
  try {
    const [convRes, voicesRes, msgRes] = await Promise.all([
      sb.from('conversations').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      sb
        .from('belief_voices')
        .select('voice_label, occurrence_count')
        .eq('user_id', userId)
        .order('occurrence_count', { ascending: false }),
      sb.from('messages').select('created_at').eq('user_id', userId).eq('role', 'user'),
    ])
    const hourCounts = new Array(24).fill(0)
    const msgs = msgRes.data ?? []
    msgs.forEach((m) => {
      hourCounts[new Date(m.created_at).getHours()]++
    })
    return {
      conversationCount: convRes.count ?? 0,
      userMessageCount: msgs.length,
      voices: (voicesRes.data ?? []).map((v) => ({ label: v.voice_label, count: v.occurrence_count })),
      hourCounts,
    }
  } catch {
    return null
  }
}

type ClientEvent = 'session_start' | 'message_sent' | 'draft_discarded' | 'void_entered'

/** 行为事件埋点（EMI 触发源 / 时间形状原料）。 */
export async function logEvent(
  userId: string,
  eventType: ClientEvent,
  conversationId?: string | null,
  payload?: Record<string, unknown>,
): Promise<void> {
  const sb = getSupabase()
  if (!sb) return
  try {
    await sb.from('behavior_events').insert({
      user_id: userId,
      event_type: eventType,
      conversation_id: conversationId ?? null,
      payload: (payload ?? {}) as Json,
    })
  } catch {
    /* no-op */
  }
}
