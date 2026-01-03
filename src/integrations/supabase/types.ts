export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      bears_trending: {
        Row: {
          author_username: string | null
          content: string | null
          created_at: string
          embed_url: string
          fetched_at: string
          id: string
          likes: number
          post_id: string
          rank_score: number | null
          retweets: number
        }
        Insert: {
          author_username?: string | null
          content?: string | null
          created_at?: string
          embed_url: string
          fetched_at?: string
          id?: string
          likes?: number
          post_id: string
          rank_score?: number | null
          retweets?: number
        }
        Update: {
          author_username?: string | null
          content?: string | null
          created_at?: string
          embed_url?: string
          fetched_at?: string
          id?: string
          likes?: number
          post_id?: string
          rank_score?: number | null
          retweets?: number
        }
        Relationships: []
      }
      boosts: {
        Row: {
          amount: number
          booster_id: string
          created_at: string
          id: string
          message_id: string
          stripe_payment_id: string | null
        }
        Insert: {
          amount: number
          booster_id: string
          created_at?: string
          id?: string
          message_id: string
          stripe_payment_id?: string | null
        }
        Update: {
          amount?: number
          booster_id?: string
          created_at?: string
          id?: string
          message_id?: string
          stripe_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "boosts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "huddle_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      content_admin_teams: {
        Row: {
          created_at: string
          created_by: string
          id: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: []
      }
      content_reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          details: string | null
          id: string
          reason: string
          reported_post_id: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reported_post_id: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reported_post_id?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_reports_reported_post_id_fkey"
            columns: ["reported_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      fade_ledgers: {
        Row: {
          created_at: string
          current_streak_a: number
          huddle_id: string
          id: string
          last_fade_at: string | null
          net_points: number
          total_fades: number
          user_a_id: string
          user_a_wins: number
          user_b_id: string
          user_b_wins: number
        }
        Insert: {
          created_at?: string
          current_streak_a?: number
          huddle_id: string
          id?: string
          last_fade_at?: string | null
          net_points?: number
          total_fades?: number
          user_a_id: string
          user_a_wins?: number
          user_b_id: string
          user_b_wins?: number
        }
        Update: {
          created_at?: string
          current_streak_a?: number
          huddle_id?: string
          id?: string
          last_fade_at?: string | null
          net_points?: number
          total_fades?: number
          user_a_id?: string
          user_a_wins?: number
          user_b_id?: string
          user_b_wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "fade_ledgers_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
        ]
      }
      fade_season_stats: {
        Row: {
          current_streak: number
          huddle_id: string
          id: string
          season_year: number
          total_losses: number
          total_points: number
          total_wins: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          huddle_id: string
          id?: string
          season_year?: number
          total_losses?: number
          total_points?: number
          total_wins?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          huddle_id?: string
          id?: string
          season_year?: number
          total_losses?: number
          total_points?: number
          total_wins?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fade_season_stats_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
        ]
      }
      fades: {
        Row: {
          accepter_id: string | null
          away_team: string
          created_at: string
          fade_type: string
          final_score_away: number | null
          final_score_home: number | null
          game_commence_time: string
          game_id: string
          home_team: string
          huddle_id: string
          id: string
          line_description: string
          line_value: number
          locked_at: string | null
          poster_id: string
          settled_at: string | null
          sport: string
          stake: number
          status: string
          winner_id: string | null
        }
        Insert: {
          accepter_id?: string | null
          away_team: string
          created_at?: string
          fade_type: string
          final_score_away?: number | null
          final_score_home?: number | null
          game_commence_time: string
          game_id: string
          home_team: string
          huddle_id: string
          id?: string
          line_description: string
          line_value: number
          locked_at?: string | null
          poster_id: string
          settled_at?: string | null
          sport?: string
          stake?: number
          status?: string
          winner_id?: string | null
        }
        Update: {
          accepter_id?: string | null
          away_team?: string
          created_at?: string
          fade_type?: string
          final_score_away?: number | null
          final_score_home?: number | null
          game_commence_time?: string
          game_id?: string
          home_team?: string
          huddle_id?: string
          id?: string
          line_description?: string
          line_value?: number
          locked_at?: string | null
          poster_id?: string
          settled_at?: string | null
          sport?: string
          stake?: number
          status?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fades_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_states: {
        Row: {
          created_at: string
          game_id: string
          id: string
          last_clock: string | null
          last_period: number
          last_score: string
          last_status: string
          teams: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          last_clock?: string | null
          last_period?: number
          last_score: string
          last_status: string
          teams: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          last_clock?: string | null
          last_period?: number
          last_score?: string
          last_status?: string
          teams?: Json
          updated_at?: string
        }
        Relationships: []
      }
      huddle_chatbot_settings: {
        Row: {
          created_at: string | null
          huddle_id: string
          id: string
          is_enabled: boolean
          personality: string | null
          response_max_words: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          huddle_id: string
          id?: string
          is_enabled?: boolean
          personality?: string | null
          response_max_words?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          huddle_id?: string
          id?: string
          is_enabled?: boolean
          personality?: string | null
          response_max_words?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "huddle_chatbot_settings_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: true
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
        ]
      }
      huddle_join_requests: {
        Row: {
          created_at: string
          huddle_id: string
          id: string
          message: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          huddle_id: string
          id?: string
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          huddle_id?: string
          id?: string
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "huddle_join_requests_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
        ]
      }
      huddle_member_subscriptions: {
        Row: {
          created_at: string
          expires_at: string
          huddle_id: string
          id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          huddle_id: string
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          huddle_id?: string
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "huddle_member_subscriptions_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
        ]
      }
      huddle_members: {
        Row: {
          huddle_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          last_seen_at: string | null
          user_id: string
        }
        Insert: {
          huddle_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          last_seen_at?: string | null
          user_id: string
        }
        Update: {
          huddle_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          last_seen_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "huddle_members_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
        ]
      }
      huddle_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "huddle_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "huddle_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      huddle_messages: {
        Row: {
          boost_amount: number | null
          content: string
          created_at: string
          embed_code: string | null
          embeds: Json | null
          huddle_id: string
          id: string
          is_bot_message: boolean | null
          is_pulse_moment: boolean | null
          is_team_agent_message: boolean | null
          media_type: string | null
          media_url: string | null
          message_type: string | null
          origin_post_id: string | null
          origin_team_id: string | null
          poll_data: Json | null
          pulse_expires_at: string | null
          pulse_source: string | null
          reply_to_id: string | null
          user_id: string
        }
        Insert: {
          boost_amount?: number | null
          content: string
          created_at?: string
          embed_code?: string | null
          embeds?: Json | null
          huddle_id: string
          id?: string
          is_bot_message?: boolean | null
          is_pulse_moment?: boolean | null
          is_team_agent_message?: boolean | null
          media_type?: string | null
          media_url?: string | null
          message_type?: string | null
          origin_post_id?: string | null
          origin_team_id?: string | null
          poll_data?: Json | null
          pulse_expires_at?: string | null
          pulse_source?: string | null
          reply_to_id?: string | null
          user_id: string
        }
        Update: {
          boost_amount?: number | null
          content?: string
          created_at?: string
          embed_code?: string | null
          embeds?: Json | null
          huddle_id?: string
          id?: string
          is_bot_message?: boolean | null
          is_pulse_moment?: boolean | null
          is_team_agent_message?: boolean | null
          media_type?: string | null
          media_url?: string | null
          message_type?: string | null
          origin_post_id?: string | null
          origin_team_id?: string | null
          poll_data?: Json | null
          pulse_expires_at?: string | null
          pulse_source?: string | null
          reply_to_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "huddle_messages_origin_post_fk"
            columns: ["origin_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "huddle_messages_origin_team_id_fkey"
            columns: ["origin_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "huddle_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "huddle_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      huddle_pickem_settings: {
        Row: {
          auto_create_weekly: boolean
          created_at: string
          huddle_id: string
          id: string
          is_enabled: boolean
          league: string
          max_games: number
          updated_at: string
        }
        Insert: {
          auto_create_weekly?: boolean
          created_at?: string
          huddle_id: string
          id?: string
          is_enabled?: boolean
          league?: string
          max_games?: number
          updated_at?: string
        }
        Update: {
          auto_create_weekly?: boolean
          created_at?: string
          huddle_id?: string
          id?: string
          is_enabled?: boolean
          league?: string
          max_games?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "huddle_pickem_settings_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: true
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
        ]
      }
      huddle_pricing: {
        Row: {
          created_at: string
          huddle_id: string
          id: string
          is_enabled: boolean
          price_per_month: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          huddle_id: string
          id?: string
          is_enabled?: boolean
          price_per_month: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          huddle_id?: string
          id?: string
          is_enabled?: boolean
          price_per_month?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "huddle_pricing_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: true
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
        ]
      }
      huddle_subscriptions: {
        Row: {
          created_at: string
          expires_at: string
          huddle_id: string
          id: string
          owner_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          huddle_id: string
          id?: string
          owner_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          huddle_id?: string
          id?: string
          owner_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "huddle_subscriptions_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: true
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
        ]
      }
      huddles: {
        Row: {
          bio: string | null
          created_at: string
          event_id: string | null
          id: string
          is_official_team_huddle: boolean | null
          is_private: boolean | null
          is_verified: boolean | null
          last_message_at: string | null
          member_count: number | null
          name: string
          owner_id: string
          parent_team_id: string | null
          team_id: string
          updated_at: string
          verification_expires_at: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          is_official_team_huddle?: boolean | null
          is_private?: boolean | null
          is_verified?: boolean | null
          last_message_at?: string | null
          member_count?: number | null
          name: string
          owner_id: string
          parent_team_id?: string | null
          team_id: string
          updated_at?: string
          verification_expires_at?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          is_official_team_huddle?: boolean | null
          is_private?: boolean | null
          is_verified?: boolean | null
          last_message_at?: string | null
          member_count?: number | null
          name?: string
          owner_id?: string
          parent_team_id?: string | null
          team_id?: string
          updated_at?: string
          verification_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "huddles_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "live_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "huddles_parent_team_id_fkey"
            columns: ["parent_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "huddles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      live_events: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_pinned: boolean | null
          name: string
          network: string | null
          score_team1: number | null
          score_team2: number | null
          start_time: string
          status: string
          subtitle: string | null
          team1_id: string | null
          team2_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_pinned?: boolean | null
          name: string
          network?: string | null
          score_team1?: number | null
          score_team2?: number | null
          start_time: string
          status?: string
          subtitle?: string | null
          team1_id?: string | null
          team2_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_pinned?: boolean | null
          name?: string
          network?: string | null
          score_team1?: number | null
          score_team2?: number | null
          start_time?: string
          status?: string
          subtitle?: string | null
          team1_id?: string | null
          team2_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_events_team1_id_fkey"
            columns: ["team1_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_events_team2_id_fkey"
            columns: ["team2_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      message_heat_reactions: {
        Row: {
          created_at: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_heat_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "huddle_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          browser_push_enabled: boolean | null
          created_at: string | null
          game_end_enabled: boolean | null
          game_start_enabled: boolean | null
          id: string
          in_app_notifications: boolean | null
          only_followed_teams: boolean | null
          only_huddle_teams: boolean | null
          score_update_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          browser_push_enabled?: boolean | null
          created_at?: string | null
          game_end_enabled?: boolean | null
          game_start_enabled?: boolean | null
          id?: string
          in_app_notifications?: boolean | null
          only_followed_teams?: boolean | null
          only_huddle_teams?: boolean | null
          score_update_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          browser_push_enabled?: boolean | null
          created_at?: string | null
          game_end_enabled?: boolean | null
          game_start_enabled?: boolean | null
          id?: string
          in_app_notifications?: boolean | null
          only_followed_teams?: boolean | null
          only_huddle_teams?: boolean | null
          score_update_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          clicked_at: string | null
          created_at: string | null
          data: Json | null
          delivered_at: string | null
          game_id: string | null
          huddle_id: string | null
          id: string
          read_at: string | null
          team_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          clicked_at?: string | null
          created_at?: string | null
          data?: Json | null
          delivered_at?: string | null
          game_id?: string | null
          huddle_id?: string | null
          id?: string
          read_at?: string | null
          team_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          clicked_at?: string | null
          created_at?: string | null
          data?: Json | null
          delivered_at?: string | null
          game_id?: string | null
          huddle_id?: string | null
          id?: string
          read_at?: string | null
          team_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      pickem_entries: {
        Row: {
          created_at: string
          id: string
          instance_id: string
          total_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_id: string
          total_score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_id?: string
          total_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pickem_entries_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "pickem_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      pickem_games: {
        Row: {
          away_team: string
          created_at: string
          espn_game_id: string
          home_team: string
          id: string
          match_id: string | null
          start_time: string
          status: string
          updated_at: string
          week_id: string
          winning_team: string | null
        }
        Insert: {
          away_team: string
          created_at?: string
          espn_game_id: string
          home_team: string
          id?: string
          match_id?: string | null
          start_time: string
          status?: string
          updated_at?: string
          week_id: string
          winning_team?: string | null
        }
        Update: {
          away_team?: string
          created_at?: string
          espn_game_id?: string
          home_team?: string
          id?: string
          match_id?: string | null
          start_time?: string
          status?: string
          updated_at?: string
          week_id?: string
          winning_team?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pickem_games_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "pickem_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      pickem_instance_games: {
        Row: {
          game_id: string
          instance_id: string
        }
        Insert: {
          game_id: string
          instance_id: string
        }
        Update: {
          game_id?: string
          instance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pickem_instance_games_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "pickem_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickem_instance_games_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "pickem_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      pickem_instances: {
        Row: {
          created_at: string
          created_by: string
          huddle_id: string
          id: string
          status: string
          title: string | null
          updated_at: string
          week_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          huddle_id: string
          id?: string
          status?: string
          title?: string | null
          updated_at?: string
          week_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          huddle_id?: string
          id?: string
          status?: string
          title?: string | null
          updated_at?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pickem_instances_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickem_instances_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "pickem_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      pickem_picks: {
        Row: {
          created_at: string
          entry_id: string
          game_id: string
          id: string
          is_correct: boolean | null
          picked_team: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          game_id: string
          id?: string
          is_correct?: boolean | null
          picked_team: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          game_id?: string
          id?: string
          is_correct?: boolean | null
          picked_team?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pickem_picks_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "pickem_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickem_picks_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "pickem_games"
            referencedColumns: ["id"]
          },
        ]
      }
      pickem_weeks: {
        Row: {
          created_at: string
          end_at: string
          id: string
          league: Database["public"]["Enums"]["pickem_league"]
          season_year: number
          start_at: string
          updated_at: string
          week_number: number
        }
        Insert: {
          created_at?: string
          end_at: string
          id?: string
          league: Database["public"]["Enums"]["pickem_league"]
          season_year: number
          start_at: string
          updated_at?: string
          week_number: number
        }
        Update: {
          created_at?: string
          end_at?: string
          id?: string
          league?: Database["public"]["Enums"]["pickem_league"]
          season_year?: number
          start_at?: string
          updated_at?: string
          week_number?: number
        }
        Relationships: []
      }
      poll_votes: {
        Row: {
          created_at: string | null
          id: string
          message_id: string | null
          option_id: number
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_id?: string | null
          option_id: number
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message_id?: string | null
          option_id?: number
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "huddle_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          delivery_status: string | null
          embed_code: string | null
          embeds: Json | null
          huddle_id: string | null
          id: string
          is_agent_post: boolean | null
          is_spotlight: boolean | null
          is_team_agent_message: boolean | null
          media_url: string | null
          message_type: string | null
          origin_team_id: string | null
          poll_data: Json | null
          scheduled_at: string | null
          target_audience: string[] | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string
          delivery_status?: string | null
          embed_code?: string | null
          embeds?: Json | null
          huddle_id?: string | null
          id?: string
          is_agent_post?: boolean | null
          is_spotlight?: boolean | null
          is_team_agent_message?: boolean | null
          media_url?: string | null
          message_type?: string | null
          origin_team_id?: string | null
          poll_data?: Json | null
          scheduled_at?: string | null
          target_audience?: string[] | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          delivery_status?: string | null
          embed_code?: string | null
          embeds?: Json | null
          huddle_id?: string | null
          id?: string
          is_agent_post?: boolean | null
          is_spotlight?: boolean | null
          is_team_agent_message?: boolean | null
          media_url?: string | null
          message_type?: string | null
          origin_team_id?: string | null
          poll_data?: Json | null
          scheduled_at?: string | null
          target_audience?: string[] | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_origin_team_id_fkey"
            columns: ["origin_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned_at: string | null
          banned_reason: string | null
          bio: string | null
          blocked_at: string | null
          created_at: string
          display_name: string | null
          founding_purchased_at: string | null
          founding_spot_number: number | null
          founding_tier: string | null
          has_lifetime_verified_huddle_code: boolean | null
          id: string
          is_founding_member: boolean | null
          last_login_at: string | null
          onboarding_completed: boolean
          phone_number: string | null
          signup_method: string | null
          status: string | null
          updated_at: string
          user_id: string
          username: string | null
          verified_huddle_promo_code: string | null
        }
        Insert: {
          avatar_url?: string | null
          banned_at?: string | null
          banned_reason?: string | null
          bio?: string | null
          blocked_at?: string | null
          created_at?: string
          display_name?: string | null
          founding_purchased_at?: string | null
          founding_spot_number?: number | null
          founding_tier?: string | null
          has_lifetime_verified_huddle_code?: boolean | null
          id?: string
          is_founding_member?: boolean | null
          last_login_at?: string | null
          onboarding_completed?: boolean
          phone_number?: string | null
          signup_method?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
          verified_huddle_promo_code?: string | null
        }
        Update: {
          avatar_url?: string | null
          banned_at?: string | null
          banned_reason?: string | null
          bio?: string | null
          blocked_at?: string | null
          created_at?: string
          display_name?: string | null
          founding_purchased_at?: string | null
          founding_spot_number?: number | null
          founding_tier?: string | null
          has_lifetime_verified_huddle_code?: boolean | null
          id?: string
          is_founding_member?: boolean | null
          last_login_at?: string | null
          onboarding_completed?: boolean
          phone_number?: string | null
          signup_method?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
          verified_huddle_promo_code?: string | null
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          current_uses: number | null
          description: string | null
          discount_type: string
          discount_value: number | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          discount_type: string
          discount_value?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          discount_type?: string
          discount_value?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
        }
        Relationships: []
      }
      pulse_runs: {
        Row: {
          event_id: string | null
          huddle_id: string
          id: string
          items_found: number
          items_inserted: number
          queries_used: string[] | null
          ran_at: string
          source: string
          xai_debug: Json
          xai_has_key: boolean
          xai_model: string | null
          xai_tool_calls_total: number
          xai_web_search_calls: number
          xai_x_search_calls: number
        }
        Insert: {
          event_id?: string | null
          huddle_id: string
          id?: string
          items_found?: number
          items_inserted?: number
          queries_used?: string[] | null
          ran_at?: string
          source?: string
          xai_debug?: Json
          xai_has_key?: boolean
          xai_model?: string | null
          xai_tool_calls_total?: number
          xai_web_search_calls?: number
          xai_x_search_calls?: number
        }
        Update: {
          event_id?: string | null
          huddle_id?: string
          id?: string
          items_found?: number
          items_inserted?: number
          queries_used?: string[] | null
          ran_at?: string
          source?: string
          xai_debug?: Json
          xai_has_key?: boolean
          xai_model?: string | null
          xai_tool_calls_total?: number
          xai_web_search_calls?: number
          xai_x_search_calls?: number
        }
        Relationships: [
          {
            foreignKeyName: "pulse_runs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "live_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pulse_runs_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
        ]
      }
      reddit_daily_counts: {
        Row: {
          huddle_id: string
          id: string
          post_count: number | null
          post_date: string
        }
        Insert: {
          huddle_id: string
          id?: string
          post_count?: number | null
          post_date?: string
        }
        Update: {
          huddle_id?: string
          id?: string
          post_count?: number | null
          post_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "reddit_daily_counts_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
        ]
      }
      reddit_posts_log: {
        Row: {
          content_hash: string | null
          created_at: string
          id: string
          posted_to_huddle_at: string | null
          reddit_post_id: string
          team_id: string
          title: string | null
          url: string | null
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          id?: string
          posted_to_huddle_at?: string | null
          reddit_post_id: string
          team_id: string
          title?: string | null
          url?: string | null
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          id?: string
          posted_to_huddle_at?: string | null
          reddit_post_id?: string
          team_id?: string
          title?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reddit_posts_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      social_sources: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          source_type: string
          source_url: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          source_type?: string
          source_url: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          source_type?: string
          source_url?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_sources_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      spotlight_reports: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      spotlight_votes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
          vote_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
          vote_type: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
          vote_type?: string
        }
        Relationships: []
      }
      subscription_audit_log: {
        Row: {
          action: string
          created_at: string
          huddle_id: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          huddle_id: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          huddle_id?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      team_subreddits: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          rss_url: string
          subreddit_name: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          rss_url: string
          subreddit_name: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          rss_url?: string
          subreddit_name?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_subreddits_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_trending: {
        Row: {
          author_username: string | null
          content: string | null
          created_at: string
          embed_url: string
          fetched_at: string
          grok_analysis: Json | null
          has_media: boolean | null
          highlight_worthy: boolean | null
          id: string
          likes: number
          media_type: string | null
          post_id: string
          quality_score: number | null
          rank_score: number
          replies: number
          retweets: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          team_id: string | null
          topics: string[] | null
        }
        Insert: {
          author_username?: string | null
          content?: string | null
          created_at?: string
          embed_url: string
          fetched_at?: string
          grok_analysis?: Json | null
          has_media?: boolean | null
          highlight_worthy?: boolean | null
          id?: string
          likes?: number
          media_type?: string | null
          post_id: string
          quality_score?: number | null
          rank_score?: number
          replies?: number
          retweets?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          team_id?: string | null
          topics?: string[] | null
        }
        Update: {
          author_username?: string | null
          content?: string | null
          created_at?: string
          embed_url?: string
          fetched_at?: string
          grok_analysis?: Json | null
          has_media?: boolean | null
          highlight_worthy?: boolean | null
          id?: string
          likes?: number
          media_type?: string | null
          post_id?: string
          quality_score?: number | null
          rank_score?: number
          replies?: number
          retweets?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          team_id?: string | null
          topics?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "team_trending_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          team_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          team_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          team_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      teams: {
        Row: {
          city: string
          conference: string | null
          created_at: string
          description: string | null
          division: string | null
          featured_order: number | null
          highlightly_display_name: string | null
          highlightly_id: number | null
          id: string
          league: string | null
          logo_url: string | null
          name: string
          sponsor: string | null
          sponsor_url: string | null
          stats: Json | null
          status: string | null
          updated_at: string
        }
        Insert: {
          city: string
          conference?: string | null
          created_at?: string
          description?: string | null
          division?: string | null
          featured_order?: number | null
          highlightly_display_name?: string | null
          highlightly_id?: number | null
          id?: string
          league?: string | null
          logo_url?: string | null
          name: string
          sponsor?: string | null
          sponsor_url?: string | null
          stats?: Json | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          city?: string
          conference?: string | null
          created_at?: string
          description?: string | null
          division?: string | null
          featured_order?: number | null
          highlightly_display_name?: string | null
          highlightly_id?: number | null
          id?: string
          league?: string | null
          logo_url?: string | null
          name?: string
          sponsor?: string | null
          sponsor_url?: string | null
          stats?: Json | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          purchased_at: string
          stripe_payment_id: string | null
          team_id: string
          tier: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          purchased_at?: string
          stripe_payment_id?: string | null
          team_id: string
          tier: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          purchased_at?: string
          stripe_payment_id?: string | null
          team_id?: string
          tier?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_email_notifications: {
        Row: {
          created_at: string
          id: string
          last_email_sent_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_email_sent_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_email_sent_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_follows: {
        Row: {
          created_at: string
          id: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_follows_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_huddle_join_request: {
        Args: { request_id: string }
        Returns: undefined
      }
      calculate_post_vote_score: {
        Args: { post_uuid: string }
        Returns: number
      }
      claim_founding_spot: {
        Args: { p_promo_code: string; p_tier: string; p_user_id: string }
        Returns: number
      }
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_founding_counts: {
        Args: never
        Returns: {
          charter_count: number
          founding_count: number
          total_count: number
        }[]
      }
      get_huddle_subscription_status: {
        Args: { target_huddle_id: string }
        Returns: {
          expires_at: string
          is_verified: boolean
          status: string
        }[]
      }
      get_or_create_system_user: { Args: never; Returns: string }
      get_pickem_leaderboard: {
        Args: { target_instance_id: string }
        Returns: {
          display_name: string
          instance_id: string
          rank: number
          total_score: number
          user_id: string
          username: string
        }[]
      }
      get_pickem_season_leaderboard: {
        Args: { target_league?: string; target_season?: number }
        Returns: {
          display_name: string
          entries_played: number
          league: string
          rank: number
          season_year: number
          total_correct_picks: number
          user_id: string
          username: string
          win_percentage: number
        }[]
      }
      get_pickem_user_totals: {
        Args: { target_user_id?: string }
        Returns: {
          entries_played: number
          league: string
          season_year: number
          total_correct: number
          user_id: string
        }[]
      }
      get_poll_vote_counts: {
        Args: { post_uuid: string }
        Returns: {
          option_id: number
          vote_count: number
        }[]
      }
      get_post_vote_counts: {
        Args: { post_uuid: string }
        Returns: {
          down_votes: number
          total_votes: number
          up_votes: number
        }[]
      }
      get_public_profile: {
        Args: { target_user_id: string }
        Returns: {
          avatar_url: string
          bio: string
          display_name: string
          user_id: string
          username: string
        }[]
      }
      get_user_active_badge: {
        Args: { target_user_id: string }
        Returns: {
          team_id: string
          team_logo_url: string
          team_name: string
          tier: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_huddle_member: {
        Args: { _huddle_id: string; _user_id: string }
        Returns: boolean
      }
      recalculate_entry_total: {
        Args: { _entry_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "member" | "huddle_owner" | "content_admin"
      pickem_league: "nfl" | "ncaaf"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "member", "huddle_owner", "content_admin"],
      pickem_league: ["nfl", "ncaaf"],
    },
  },
} as const
