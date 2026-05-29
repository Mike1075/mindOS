// 由 Supabase 生成（mcp generate_typescript_types）。需重新生成时请用 MCP，勿手改。
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      behavior_events: {
        Row: {
          conversation_id: string | null
          created_at: string
          event_type: Database['public']['Enums']['behavior_event_type']
          id: string
          occurred_at: string
          payload: Json
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          event_type: Database['public']['Enums']['behavior_event_type']
          id?: string
          occurred_at?: string
          payload?: Json
          user_id: string
        }
        Update: Partial<Database['public']['Tables']['behavior_events']['Insert']>
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          end_reason: Database['public']['Enums']['end_reason'] | null
          ended_at: string | null
          felt_sense_used: boolean
          id: string
          max_layer_reached: number
          personalization_snapshot: Json | null
          prompt_version_id: string | null
          started_at: string
          status: Database['public']['Enums']['conversation_status']
          turn_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          end_reason?: Database['public']['Enums']['end_reason'] | null
          ended_at?: string | null
          felt_sense_used?: boolean
          id?: string
          max_layer_reached?: number
          personalization_snapshot?: Json | null
          prompt_version_id?: string | null
          started_at?: string
          status?: Database['public']['Enums']['conversation_status']
          turn_count?: number
          user_id: string
        }
        Update: Partial<Database['public']['Tables']['conversations']['Insert']>
        Relationships: []
      }
      messages: {
        Row: {
          client_sent_at: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: Database['public']['Enums']['message_role']
          seq: number
          server_recv_at: string
          token_count: number | null
          user_id: string
        }
        Insert: {
          client_sent_at?: string | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: Database['public']['Enums']['message_role']
          seq: number
          server_recv_at?: string
          token_count?: number | null
          user_id: string
        }
        Update: Partial<Database['public']['Tables']['messages']['Insert']>
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: {
      behavior_event_type:
        | 'session_start'
        | 'session_end'
        | 'message_sent'
        | 'draft_discarded'
        | 'late_night_return'
        | 'rapid_return'
        | 'theme_revisit'
        | 'felt_sense_entered'
        | 'void_entered'
      conversation_status: 'active' | 'ended'
      emi_outcome: 'pending' | 'opened' | 'closed' | 'ignored' | 'new_language'
      end_reason: 'user_left' | 'turn_limit' | 'timeout' | 'void_mode' | 'crisis' | 'cooldown'
      message_role: 'user' | 'mirror' | 'system'
      safety_action: 'kill_switch' | 'downgrade' | 'hotline_shown'
      safety_trigger: 'rule_pattern' | 'haiku_filter' | 'llm_judge'
      theme_type: 'person' | 'scene' | 'emotion' | 'belief_voice'
      vails_action: 'reduce_focus' | 'cooldown' | 'open_exit' | 'presence_pullback'
      vails_rule: 'repeated_negative_voice' | 'rising_intensity' | 'peak_exit_guard' | 'dependency_signal'
    }
    CompositeTypes: { [_ in never]: never }
  }
}
