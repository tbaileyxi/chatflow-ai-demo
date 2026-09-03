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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      arena_events: {
        Row: {
          category: string
          created_at: string
          id: string
          period_label: string | null
          prob_a: number | null
          score_a: number
          score_b: number
          side_a_label: string
          side_b_label: string
          slug: string
          source: Json
          starts_at: string
          status: string
          title: string
          updated_at: string
          winner: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          period_label?: string | null
          prob_a?: number | null
          score_a?: number
          score_b?: number
          side_a_label: string
          side_b_label: string
          slug: string
          source?: Json
          starts_at: string
          status?: string
          title: string
          updated_at?: string
          winner?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          period_label?: string | null
          prob_a?: number | null
          score_a?: number
          score_b?: number
          side_a_label?: string
          side_b_label?: string
          slug?: string
          source?: Json
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
          winner?: string | null
        }
        Relationships: []
      }
      arena_follows: {
        Row: {
          created_at: string
          followed: string
          follower: string
        }
        Insert: {
          created_at?: string
          followed: string
          follower: string
        }
        Update: {
          created_at?: string
          followed?: string
          follower?: string
        }
        Relationships: []
      }
      arena_live_odds: {
        Row: {
          game_id: string
          home_prob: number
          pm_a_outcome: string | null
          pm_condition: string | null
          updated_at: string
        }
        Insert: {
          game_id: string
          home_prob: number
          pm_a_outcome?: string | null
          pm_condition?: string | null
          updated_at?: string
        }
        Update: {
          game_id?: string
          home_prob?: number
          pm_a_outcome?: string | null
          pm_condition?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_live_odds_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_players: {
        Row: {
          avatar: string
          bankroll: number
          client_id: string
          created_at: string
          handle: string
          last_claim_date: string | null
          streak_days: number
          updated_at: string
        }
        Insert: {
          avatar?: string
          bankroll?: number
          client_id: string
          created_at?: string
          handle?: string
          last_claim_date?: string | null
          streak_days?: number
          updated_at?: string
        }
        Update: {
          avatar?: string
          bankroll?: number
          client_id?: string
          created_at?: string
          handle?: string
          last_claim_date?: string | null
          streak_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      arena_stakes: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          event_id: string | null
          game_id: string | null
          id: string
          payout: number | null
          settled: boolean
          side: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          event_id?: string | null
          game_id?: string | null
          id?: string
          payout?: number | null
          settled?: boolean
          side: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          event_id?: string | null
          game_id?: string | null
          id?: string
          payout?: number | null
          settled?: boolean
          side?: string
        }
        Relationships: [
          {
            foreignKeyName: "arena_stakes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "arena_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arena_stakes_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      arena_ticks: {
        Row: {
          created_at: string
          id: number
          prob: number
          target: string
        }
        Insert: {
          created_at?: string
          id?: never
          prob: number
          target: string
        }
        Update: {
          created_at?: string
          id?: never
          prob?: number
          target?: string
        }
        Relationships: []
      }
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
      bot_emit_log: {
        Row: {
          created_at: string
          excitement_score: number | null
          facts: Json
          huddle_id: string | null
          id: string
          message_text: string
          mode: string
          pushed: boolean
          source_ref: string | null
          team_id: string | null
        }
        Insert: {
          created_at?: string
          excitement_score?: number | null
          facts: Json
          huddle_id?: string | null
          id?: string
          message_text: string
          mode: string
          pushed?: boolean
          source_ref?: string | null
          team_id?: string | null
        }
        Update: {
          created_at?: string
          excitement_score?: number | null
          facts?: Json
          huddle_id?: string | null
          id?: string
          message_text?: string
          mode?: string
          pushed?: boolean
          source_ref?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_emit_log_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_emit_log_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles_with_official"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_emit_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_mode_subscriptions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
          venmo_username: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
          venmo_username?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
          venmo_username?: string | null
        }
        Relationships: []
      }
      chapter_leads: {
        Row: {
          address: string | null
          bounce_kind: string | null
          bounced: boolean
          chapter_name: string
          city: string | null
          claim_code: string | null
          claimed_at: string | null
          claimed_huddle_id: string | null
          clicked_app_store: boolean
          clicked_at: string | null
          contact_channel: string
          country: string | null
          created_at: string
          dedupe_key: string
          email: string | null
          emailed: boolean
          emailed_at: string | null
          facebook: string | null
          first_name: string | null
          follow_up_date: string | null
          id: string
          instagram: string | null
          last_error: string | null
          last_touch: string | null
          leader_name: string | null
          leader_role: string | null
          member_count: number | null
          notes: string | null
          opened_at: string | null
          org: string
          org_type: string
          phone: string | null
          score: number
          sequence_step: number
          source: string
          source_url: string | null
          state: string | null
          status: string
          twitter: string | null
          unsubscribed: boolean
          updated_at: string
          venue: string | null
          website: string | null
          year_established: number | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          bounce_kind?: string | null
          bounced?: boolean
          chapter_name: string
          city?: string | null
          claim_code?: string | null
          claimed_at?: string | null
          claimed_huddle_id?: string | null
          clicked_app_store?: boolean
          clicked_at?: string | null
          contact_channel?: string
          country?: string | null
          created_at?: string
          dedupe_key: string
          email?: string | null
          emailed?: boolean
          emailed_at?: string | null
          facebook?: string | null
          first_name?: string | null
          follow_up_date?: string | null
          id?: string
          instagram?: string | null
          last_error?: string | null
          last_touch?: string | null
          leader_name?: string | null
          leader_role?: string | null
          member_count?: number | null
          notes?: string | null
          opened_at?: string | null
          org: string
          org_type?: string
          phone?: string | null
          score?: number
          sequence_step?: number
          source: string
          source_url?: string | null
          state?: string | null
          status?: string
          twitter?: string | null
          unsubscribed?: boolean
          updated_at?: string
          venue?: string | null
          website?: string | null
          year_established?: number | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          bounce_kind?: string | null
          bounced?: boolean
          chapter_name?: string
          city?: string | null
          claim_code?: string | null
          claimed_at?: string | null
          claimed_huddle_id?: string | null
          clicked_app_store?: boolean
          clicked_at?: string | null
          contact_channel?: string
          country?: string | null
          created_at?: string
          dedupe_key?: string
          email?: string | null
          emailed?: boolean
          emailed_at?: string | null
          facebook?: string | null
          first_name?: string | null
          follow_up_date?: string | null
          id?: string
          instagram?: string | null
          last_error?: string | null
          last_touch?: string | null
          leader_name?: string | null
          leader_role?: string | null
          member_count?: number | null
          notes?: string | null
          opened_at?: string | null
          org?: string
          org_type?: string
          phone?: string | null
          score?: number
          sequence_step?: number
          source?: string
          source_url?: string | null
          state?: string | null
          status?: string
          twitter?: string | null
          unsubscribed?: boolean
          updated_at?: string
          venue?: string | null
          website?: string | null
          year_established?: number | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chapter_leads_claimed_huddle_id_fkey"
            columns: ["claimed_huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_leads_claimed_huddle_id_fkey"
            columns: ["claimed_huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles_with_official"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_ask_log: {
        Row: {
          answer_message_id: string | null
          created_at: string
          huddle_id: string
          id: string
          lane: string | null
          question: string
          user_id: string
        }
        Insert: {
          answer_message_id?: string | null
          created_at?: string
          huddle_id: string
          id?: string
          lane?: string | null
          question: string
          user_id: string
        }
        Update: {
          answer_message_id?: string | null
          created_at?: string
          huddle_id?: string
          id?: string
          lane?: string | null
          question?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_ask_log_answer_message_id_fkey"
            columns: ["answer_message_id"]
            isOneToOne: false
            referencedRelation: "huddle_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_ask_log_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_ask_log_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles_with_official"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_recap_log: {
        Row: {
          created_at: string
          huddle_id: string
          id: string
          kind: string
          message_id: string | null
        }
        Insert: {
          created_at?: string
          huddle_id: string
          id?: string
          kind: string
          message_id?: string | null
        }
        Update: {
          created_at?: string
          huddle_id?: string
          id?: string
          kind?: string
          message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_recap_log_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_recap_log_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles_with_official"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_recap_log_message_id_fkey"
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
      creator_leads: {
        Row: {
          avg_likes: number | null
          best_post: string | null
          bio: string | null
          display_name: string | null
          email: string | null
          emailed: boolean
          first_seen: string
          followers: number | null
          handle: string
          huddle_id: string | null
          id: string
          last_seen: string
          last_touch: string | null
          likes_seen: number | null
          notes: string | null
          org: string | null
          posts_seen: number | null
          sequence_step: number
          status: string
          team_id: string | null
          website: string | null
        }
        Insert: {
          avg_likes?: number | null
          best_post?: string | null
          bio?: string | null
          display_name?: string | null
          email?: string | null
          emailed?: boolean
          first_seen?: string
          followers?: number | null
          handle: string
          huddle_id?: string | null
          id?: string
          last_seen?: string
          last_touch?: string | null
          likes_seen?: number | null
          notes?: string | null
          org?: string | null
          posts_seen?: number | null
          sequence_step?: number
          status?: string
          team_id?: string | null
          website?: string | null
        }
        Update: {
          avg_likes?: number | null
          best_post?: string | null
          bio?: string | null
          display_name?: string | null
          email?: string | null
          emailed?: boolean
          first_seen?: string
          followers?: number | null
          handle?: string
          huddle_id?: string | null
          id?: string
          last_seen?: string
          last_touch?: string | null
          likes_seen?: number | null
          notes?: string | null
          org?: string | null
          posts_seen?: number | null
          sequence_step?: number
          status?: string
          team_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_leads_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_leads_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles_with_official"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_leads_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_content: {
        Row: {
          author: string | null
          content: string | null
          engagement_score: number | null
          event_id: string
          external_id: string
          id: string
          media_urls: string[] | null
          platform: string
          pulled_at: string
          source_id: string | null
          url: string | null
        }
        Insert: {
          author?: string | null
          content?: string | null
          engagement_score?: number | null
          event_id: string
          external_id: string
          id?: string
          media_urls?: string[] | null
          platform: string
          pulled_at?: string
          source_id?: string | null
          url?: string | null
        }
        Update: {
          author?: string | null
          content?: string | null
          engagement_score?: number | null
          event_id?: string
          external_id?: string
          id?: string
          media_urls?: string[] | null
          platform?: string
          pulled_at?: string
          source_id?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_content_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_content_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "event_content_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      event_content_sources: {
        Row: {
          active: boolean
          auto_discovered: boolean
          confidence: number | null
          created_at: string
          event_id: string
          id: string
          platform: string
          source_type: string
          source_value: string
        }
        Insert: {
          active?: boolean
          auto_discovered?: boolean
          confidence?: number | null
          created_at?: string
          event_id: string
          id?: string
          platform: string
          source_type: string
          source_value: string
        }
        Update: {
          active?: boolean
          auto_discovered?: boolean
          confidence?: number | null
          created_at?: string
          event_id?: string
          id?: string
          platform?: string
          source_type?: string
          source_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_content_sources_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          content_daily_pull_hour: number
          content_pulse_interval_minutes: number
          created_at: string
          description: string | null
          ends_at: string
          id: string
          image_url: string | null
          kalshi_market_ticker: string | null
          kalshi_market_url: string | null
          league: string | null
          name: string
          short_name: string | null
          sport: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          content_daily_pull_hour?: number
          content_pulse_interval_minutes?: number
          created_at?: string
          description?: string | null
          ends_at: string
          id?: string
          image_url?: string | null
          kalshi_market_ticker?: string | null
          kalshi_market_url?: string | null
          league?: string | null
          name: string
          short_name?: string | null
          sport: string
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          content_daily_pull_hour?: number
          content_pulse_interval_minutes?: number
          created_at?: string
          description?: string | null
          ends_at?: string
          id?: string
          image_url?: string | null
          kalshi_market_ticker?: string | null
          kalshi_market_url?: string | null
          league?: string | null
          name?: string
          short_name?: string | null
          sport?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "fade_ledgers_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles_with_official"
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
          {
            foreignKeyName: "fade_season_stats_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles_with_official"
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
          market_id: string | null
          origin_message_id: string | null
          paid_confirmed_at: string | null
          paid_confirmed_by: string | null
          paid_marked_at: string | null
          paid_marked_by: string | null
          poster_id: string
          settled_at: string | null
          settlement_status: string
          sport: string
          stake: number
          status: string
          total_target: string
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
          market_id?: string | null
          origin_message_id?: string | null
          paid_confirmed_at?: string | null
          paid_confirmed_by?: string | null
          paid_marked_at?: string | null
          paid_marked_by?: string | null
          poster_id: string
          settled_at?: string | null
          settlement_status?: string
          sport?: string
          stake?: number
          status?: string
          total_target?: string
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
          market_id?: string | null
          origin_message_id?: string | null
          paid_confirmed_at?: string | null
          paid_confirmed_by?: string | null
          paid_marked_at?: string | null
          paid_marked_by?: string | null
          poster_id?: string
          settled_at?: string | null
          settlement_status?: string
          sport?: string
          stake?: number
          status?: string
          total_target?: string
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
          {
            foreignKeyName: "fades_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles_with_official"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fades_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "kalshi_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fades_origin_message_id_fkey"
            columns: ["origin_message_id"]
            isOneToOne: false
            referencedRelation: "huddle_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_connections: {
        Row: {
          accepted_at: string | null
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          source: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          source?: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          source?: string
          status?: string
        }
        Relationships: []
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
      games: {
        Row: {
          away_score: number | null
          away_team_id: string | null
          clock: string | null
          created_at: string
          home_score: number | null
          home_team_id: string | null
          id: string
          last_synced_at: string | null
          odds_game_id: string
          period: string | null
          recap_posted_at: string | null
          sport_key: string
          start_time: string
          status: string
        }
        Insert: {
          away_score?: number | null
          away_team_id?: string | null
          clock?: string | null
          created_at?: string
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          last_synced_at?: string | null
          odds_game_id: string
          period?: string | null
          recap_posted_at?: string | null
          sport_key: string
          start_time: string
          status?: string
        }
        Update: {
          away_score?: number | null
          away_team_id?: string | null
          clock?: string | null
          created_at?: string
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          last_synced_at?: string | null
          odds_game_id?: string
          period?: string | null
          recap_posted_at?: string | null
          sport_key?: string
          start_time?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "games_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      huddle_admin_nudge_log: {
        Row: {
          created_at: string
          huddle_id: string
          id: string
        }
        Insert: {
          created_at?: string
          huddle_id: string
          id?: string
        }
        Update: {
          created_at?: string
          huddle_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "huddle_admin_nudge_log_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: true
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "huddle_admin_nudge_log_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: true
            referencedRelation: "huddles_with_official"
            referencedColumns: ["id"]
          },
        ]
      }
      huddle_admins: {
        Row: {
          created_at: string
          created_by: string | null
          huddle_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          huddle_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          huddle_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "huddle_admins_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "huddle_admins_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "huddle_admins_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles_with_official"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "huddle_admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      huddle_bans: {
        Row: {
          banned_by: string | null
          created_at: string
          huddle_id: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          banned_by?: string | null
          created_at?: string
          huddle_id: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          banned_by?: string | null
          created_at?: string
          huddle_id?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "huddle_bans_banned_by_fkey"
            columns: ["banned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "huddle_bans_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "huddle_bans_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles_with_official"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "huddle_bans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
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
          {
            foreignKeyName: "huddle_chatbot_settings_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: true
            referencedRelation: "huddles_with_official"
            referencedColumns: ["id"]
          },
        ]
      }
      huddle_event_subscriptions: {
        Row: {
          event_id: string
          huddle_id: string
          id: string
          subscribed_at: string
          subscribed_by: string
        }
        Insert: {
          event_id: string
          huddle_id: string
          id?: string
          subscribed_at?: string
          subscribed_by: string
        }
        Update: {
          event_id?: string
          huddle_id?: string
          id?: string
          subscribed_at?: string
          subscribed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "huddle_event_subscriptions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
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
          {
            foreignKeyName: "huddle_join_requests_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles_with_official"
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
          {
            foreignKeyName: "huddle_member_subscriptions_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles_with_official"
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
          {
            foreignKeyName: "huddle_members_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles_with_official"
            referencedColumns: ["id"]
          },
        ]
      }
      huddle_members_seeded_backup: {
        Row: {
          backed_up_at: string | null
          huddle_id: string | null
          id: string | null
          joined_at: string | null
          last_read_at: string | null
          last_seen_at: string | null
          user_id: string | null
        }
        Insert: {
          backed_up_at?: string | null
          huddle_id?: string | null
          id?: string | null
          joined_at?: string | null
          last_read_at?: string | null
          last_seen_at?: string | null
          user_id?: string | null
        }
        Update: {
          backed_up_at?: string | null
          huddle_id?: string | null
          id?: string | null
          joined_at?: string | null
          last_read_at?: string | null
          last_seen_at?: string | null
          user_id?: string | null
        }
        Relationships: []
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
          {
            foreignKeyName: "huddle_pickem_settings_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: true
            referencedRelation: "huddles_with_official"
            referencedColumns: ["id"]
          },
        ]
      }
      huddle_pings: {
        Row: {
          created_at: string | null
          game_id: string | null
          huddle_id: string
          id: string
          sender_id: string
        }
        Insert: {
          created_at?: string | null
          game_id?: string | null
          huddle_id: string
          id?: string
          sender_id: string
        }
        Update: {
          created_at?: string | null
          game_id?: string | null
          huddle_id?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "huddle_pings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "huddle_pings_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "huddle_pings_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles_with_official"
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
          {
            foreignKeyName: "huddle_pricing_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: true
            referencedRelation: "huddles_with_official"
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
          {
            foreignKeyName: "huddle_subscriptions_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: true
            referencedRelation: "huddles_with_official"
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
          official_status: string
          owner_id: string
          parent_team_id: string | null
          photo_url: string | null
          team_id: string
          updated_at: string
          verification_expires_at: string | null
          website_url: string | null
          x_handle: string | null
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
          official_status?: string
          owner_id: string
          parent_team_id?: string | null
          photo_url?: string | null
          team_id: string
          updated_at?: string
          verification_expires_at?: string | null
          website_url?: string | null
          x_handle?: string | null
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
          official_status?: string
          owner_id?: string
          parent_team_id?: string | null
          photo_url?: string | null
          team_id?: string
          updated_at?: string
          verification_expires_at?: string | null
          website_url?: string | null
          x_handle?: string | null
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
      kalshi_markets: {
        Row: {
          created_at: string | null
          current_yes_price: number | null
          event_start_time: string | null
          huddle_id: string | null
          id: string
          is_resolved: boolean | null
          kalshi_event_ticker: string | null
          kalshi_ticker: string
          market_type: string | null
          metadata: Json | null
          posted_at: string | null
          question: string
          resolution: string | null
          resolved_at: string | null
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_yes_price?: number | null
          event_start_time?: string | null
          huddle_id?: string | null
          id?: string
          is_resolved?: boolean | null
          kalshi_event_ticker?: string | null
          kalshi_ticker: string
          market_type?: string | null
          metadata?: Json | null
          posted_at?: string | null
          question: string
          resolution?: string | null
          resolved_at?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_yes_price?: number | null
          event_start_time?: string | null
          huddle_id?: string | null
          id?: string
          is_resolved?: boolean | null
          kalshi_event_ticker?: string | null
          kalshi_ticker?: string
          market_type?: string | null
          metadata?: Json | null
          posted_at?: string | null
          question?: string
          resolution?: string | null
          resolved_at?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kalshi_markets_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kalshi_markets_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles_with_official"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kalshi_markets_team_id_fkey"
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
          end_time: string | null
          id: string
          is_pinned: boolean | null
          is_special_event: boolean | null
          linked_team_ids: string[] | null
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
          end_time?: string | null
          id?: string
          is_pinned?: boolean | null
          is_special_event?: boolean | null
          linked_team_ids?: string[] | null
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
          end_time?: string | null
          id?: string
          is_pinned?: boolean | null
          is_special_event?: boolean | null
          linked_team_ids?: string[] | null
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
            foreignKeyName: "notifications_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles_with_official"
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
      outreach_teams: {
        Row: {
          added_at: string
          team: string
        }
        Insert: {
          added_at?: string
          team: string
        }
        Update: {
          added_at?: string
          team?: string
        }
        Relationships: []
      }
      pending_clips: {
        Row: {
          attempts: number
          created_at: string
          game_provider_id: string
          huddle_ids: string[]
          id: string
          opponent: string | null
          play_key: string
          play_text: string | null
          scorer: string | null
          search_after: string
          status: string
          team_id: string
          team_name: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          game_provider_id: string
          huddle_ids?: string[]
          id?: string
          opponent?: string | null
          play_key: string
          play_text?: string | null
          scorer?: string | null
          search_after: string
          status?: string
          team_id: string
          team_name: string
        }
        Update: {
          attempts?: number
          created_at?: string
          game_provider_id?: string
          huddle_ids?: string[]
          id?: string
          opponent?: string | null
          play_key?: string
          play_text?: string | null
          scorer?: string | null
          search_after?: string
          status?: string
          team_id?: string
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_clips_team_id_fkey"
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
            foreignKeyName: "pickem_instances_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles_with_official"
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
            foreignKeyName: "posts_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles_with_official"
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
      presence_notification_log: {
        Row: {
          huddle_id: string
          id: string
          notified_at: string
          recipient_id: string | null
          user_id: string
        }
        Insert: {
          huddle_id: string
          id?: string
          notified_at?: string
          recipient_id?: string | null
          user_id: string
        }
        Update: {
          huddle_id?: string
          id?: string
          notified_at?: string
          recipient_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presence_notification_log_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presence_notification_log_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles_with_official"
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
          email_hash: string | null
          expo_push_token: string | null
          founding_purchased_at: string | null
          founding_spot_number: number | null
          founding_tier: string | null
          game_pings_enabled: boolean | null
          has_lifetime_verified_huddle_code: boolean | null
          id: string
          is_app_admin: boolean
          is_founding_member: boolean | null
          is_premium: boolean | null
          last_login_at: string | null
          onboarding_completed: boolean
          phone_hash: string | null
          phone_number: string | null
          premium_expires_at: string | null
          premium_since: string | null
          signup_method: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
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
          email_hash?: string | null
          expo_push_token?: string | null
          founding_purchased_at?: string | null
          founding_spot_number?: number | null
          founding_tier?: string | null
          game_pings_enabled?: boolean | null
          has_lifetime_verified_huddle_code?: boolean | null
          id?: string
          is_app_admin?: boolean
          is_founding_member?: boolean | null
          is_premium?: boolean | null
          last_login_at?: string | null
          onboarding_completed?: boolean
          phone_hash?: string | null
          phone_number?: string | null
          premium_expires_at?: string | null
          premium_since?: string | null
          signup_method?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
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
          email_hash?: string | null
          expo_push_token?: string | null
          founding_purchased_at?: string | null
          founding_spot_number?: number | null
          founding_tier?: string | null
          game_pings_enabled?: boolean | null
          has_lifetime_verified_huddle_code?: boolean | null
          id?: string
          is_app_admin?: boolean
          is_founding_member?: boolean | null
          is_premium?: boolean | null
          last_login_at?: string | null
          onboarding_completed?: boolean
          phone_hash?: string | null
          phone_number?: string | null
          premium_expires_at?: string | null
          premium_since?: string | null
          signup_method?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
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
          {
            foreignKeyName: "pulse_runs_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles_with_official"
            referencedColumns: ["id"]
          },
        ]
      }
      pulse_scheduler_state: {
        Row: {
          cursor_index: number
          id: string
          updated_at: string
        }
        Insert: {
          cursor_index?: number
          id?: string
          updated_at?: string
        }
        Update: {
          cursor_index?: number
          id?: string
          updated_at?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "reddit_daily_counts_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles_with_official"
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
      referrals: {
        Row: {
          created_at: string | null
          id: string
          joined_at: string | null
          new_user_id: string | null
          referral_code: string | null
          referred_by: string
          source_share_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          joined_at?: string | null
          new_user_id?: string | null
          referral_code?: string | null
          referred_by: string
          source_share_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          joined_at?: string | null
          new_user_id?: string | null
          referral_code?: string | null
          referred_by?: string
          source_share_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_source_share_id_fkey"
            columns: ["source_share_id"]
            isOneToOne: false
            referencedRelation: "shares"
            referencedColumns: ["id"]
          },
        ]
      }
      room_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          expires_at: string | null
          huddle_id: string
          id: string
          invite_code: string
          invited_user_id: string | null
          inviter_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          expires_at?: string | null
          huddle_id: string
          id?: string
          invite_code: string
          invited_user_id?: string | null
          inviter_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          expires_at?: string | null
          huddle_id?: string
          id?: string
          invite_code?: string
          invited_user_id?: string | null
          inviter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_invites_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_invites_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles_with_official"
            referencedColumns: ["id"]
          },
        ]
      }
      seen_events: {
        Row: {
          created_at: string
          emitted: boolean
          emitted_at: string | null
          event_id: string
          excitement_score: number | null
          game_id: string
          id: string
          team_id: string | null
        }
        Insert: {
          created_at?: string
          emitted?: boolean
          emitted_at?: string | null
          event_id: string
          excitement_score?: number | null
          game_id: string
          id?: string
          team_id?: string | null
        }
        Update: {
          created_at?: string
          emitted?: boolean
          emitted_at?: string | null
          event_id?: string
          excitement_score?: number | null
          game_id?: string
          id?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seen_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      seen_news: {
        Row: {
          category: string | null
          cluster_size: number | null
          created_at: string
          emitted: boolean
          emitted_at: string | null
          entry_id: string
          id: string
          link: string
          llm_score: number | null
          published_at: string | null
          source: string | null
          team_id: string
          title: string
        }
        Insert: {
          category?: string | null
          cluster_size?: number | null
          created_at?: string
          emitted?: boolean
          emitted_at?: string | null
          entry_id: string
          id?: string
          link: string
          llm_score?: number | null
          published_at?: string | null
          source?: string | null
          team_id: string
          title: string
        }
        Update: {
          category?: string | null
          cluster_size?: number | null
          created_at?: string
          emitted?: boolean
          emitted_at?: string | null
          entry_id?: string
          id?: string
          link?: string
          llm_score?: number | null
          published_at?: string | null
          source?: string | null
          team_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "seen_news_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      shadow_bets: {
        Row: {
          chips_risked: number
          chips_won: number | null
          huddle_id: string
          id: string
          is_settled: boolean | null
          market_id: string
          placed_at: string | null
          position: string
          potential_payout: number
          user_id: string
          won: boolean | null
        }
        Insert: {
          chips_risked: number
          chips_won?: number | null
          huddle_id: string
          id?: string
          is_settled?: boolean | null
          market_id: string
          placed_at?: string | null
          position: string
          potential_payout?: number
          user_id: string
          won?: boolean | null
        }
        Update: {
          chips_risked?: number
          chips_won?: number | null
          huddle_id?: string
          id?: string
          is_settled?: boolean | null
          market_id?: string
          placed_at?: string | null
          position?: string
          potential_payout?: number
          user_id?: string
          won?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "shadow_bets_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shadow_bets_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles_with_official"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shadow_bets_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "kalshi_markets"
            referencedColumns: ["id"]
          },
        ]
      }
      shares: {
        Row: {
          bet_id: string | null
          created_at: string | null
          id: string
          platform: string
          shared_content_type: string
          user_id: string
        }
        Insert: {
          bet_id?: string | null
          created_at?: string | null
          id?: string
          platform: string
          shared_content_type?: string
          user_id: string
        }
        Update: {
          bet_id?: string | null
          created_at?: string | null
          id?: string
          platform?: string
          shared_content_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shares_bet_id_fkey"
            columns: ["bet_id"]
            isOneToOne: false
            referencedRelation: "shadow_bets"
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
      sponsor_claims: {
        Row: {
          amount_paid_cents: number
          balance_due_cents: number
          balance_due_date: string | null
          business_name: string | null
          claimed_at: string | null
          created_at: string
          id: string
          league: string
          plan: string | null
          reserved_at: string | null
          sponsor_email: string | null
          sponsor_phone: string | null
          square_checkout_id: string | null
          square_order_id: string | null
          square_payment_id: string | null
          status: string
          team_key: string
          team_name: string
          updated_at: string
          website: string | null
        }
        Insert: {
          amount_paid_cents?: number
          balance_due_cents?: number
          balance_due_date?: string | null
          business_name?: string | null
          claimed_at?: string | null
          created_at?: string
          id?: string
          league: string
          plan?: string | null
          reserved_at?: string | null
          sponsor_email?: string | null
          sponsor_phone?: string | null
          square_checkout_id?: string | null
          square_order_id?: string | null
          square_payment_id?: string | null
          status?: string
          team_key: string
          team_name: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          amount_paid_cents?: number
          balance_due_cents?: number
          balance_due_date?: string | null
          business_name?: string | null
          claimed_at?: string | null
          created_at?: string
          id?: string
          league?: string
          plan?: string | null
          reserved_at?: string | null
          sponsor_email?: string | null
          sponsor_phone?: string | null
          square_checkout_id?: string | null
          square_order_id?: string | null
          square_payment_id?: string | null
          status?: string
          team_key?: string
          team_name?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      sponsor_impressions: {
        Row: {
          created_at: string
          huddle_id: string | null
          id: string
          kind: string
          sponsor_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          huddle_id?: string | null
          id?: string
          kind?: string
          sponsor_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          huddle_id?: string | null
          id?: string
          kind?: string
          sponsor_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_impressions_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_impressions_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles_with_official"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_impressions_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "team_sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_inquiries: {
        Row: {
          brand_name: string
          bundle_size: number
          contact_name: string
          created_at: string
          email: string
          free_months: number
          id: string
          league: string
          message: string | null
          monthly_total: number
          other_teams: string | null
          phone: string | null
          team_id: string | null
          team_name: string
          type: string
        }
        Insert: {
          brand_name: string
          bundle_size?: number
          contact_name: string
          created_at?: string
          email: string
          free_months?: number
          id?: string
          league: string
          message?: string | null
          monthly_total?: number
          other_teams?: string | null
          phone?: string | null
          team_id?: string | null
          team_name: string
          type: string
        }
        Update: {
          brand_name?: string
          bundle_size?: number
          contact_name?: string
          created_at?: string
          email?: string
          free_months?: number
          id?: string
          league?: string
          message?: string | null
          monthly_total?: number
          other_teams?: string | null
          phone?: string | null
          team_id?: string | null
          team_name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_inquiries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_leads: {
        Row: {
          apollo_org_id: string | null
          apollo_person_id: string | null
          best_angle: string | null
          best_package: string | null
          bounce_kind: string | null
          bounced: boolean
          clicked_app_store: boolean
          clicked_at: string | null
          company: string
          contact_email: string | null
          contact_name: string | null
          contact_title: string | null
          created_at: string
          distance_miles: number | null
          domain: string | null
          email_confidence: string | null
          emailed: boolean
          emailed_at: string | null
          follow_up_date: string | null
          id: string
          instagram_handle: string | null
          last_error: string | null
          last_touch: string | null
          linkedin_url: string | null
          market: string | null
          notes: string | null
          opened_at: string | null
          phone: string | null
          priority: string | null
          rating: number | null
          region: string | null
          review_count: number | null
          school: string | null
          sequence_step: number
          sponsor_score: number | null
          sponsor_signal: string | null
          status: string
          unsubscribed: boolean
          updated_at: string
          vertical: string
          website: string | null
        }
        Insert: {
          apollo_org_id?: string | null
          apollo_person_id?: string | null
          best_angle?: string | null
          best_package?: string | null
          bounce_kind?: string | null
          bounced?: boolean
          clicked_app_store?: boolean
          clicked_at?: string | null
          company: string
          contact_email?: string | null
          contact_name?: string | null
          contact_title?: string | null
          created_at?: string
          distance_miles?: number | null
          domain?: string | null
          email_confidence?: string | null
          emailed?: boolean
          emailed_at?: string | null
          follow_up_date?: string | null
          id?: string
          instagram_handle?: string | null
          last_error?: string | null
          last_touch?: string | null
          linkedin_url?: string | null
          market?: string | null
          notes?: string | null
          opened_at?: string | null
          phone?: string | null
          priority?: string | null
          rating?: number | null
          region?: string | null
          review_count?: number | null
          school?: string | null
          sequence_step?: number
          sponsor_score?: number | null
          sponsor_signal?: string | null
          status?: string
          unsubscribed?: boolean
          updated_at?: string
          vertical: string
          website?: string | null
        }
        Update: {
          apollo_org_id?: string | null
          apollo_person_id?: string | null
          best_angle?: string | null
          best_package?: string | null
          bounce_kind?: string | null
          bounced?: boolean
          clicked_app_store?: boolean
          clicked_at?: string | null
          company?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_title?: string | null
          created_at?: string
          distance_miles?: number | null
          domain?: string | null
          email_confidence?: string | null
          emailed?: boolean
          emailed_at?: string | null
          follow_up_date?: string | null
          id?: string
          instagram_handle?: string | null
          last_error?: string | null
          last_touch?: string | null
          linkedin_url?: string | null
          market?: string | null
          notes?: string | null
          opened_at?: string | null
          phone?: string | null
          priority?: string | null
          rating?: number | null
          region?: string | null
          review_count?: number | null
          school?: string | null
          sequence_step?: number
          sponsor_score?: number | null
          sponsor_signal?: string | null
          status?: string
          unsubscribed?: boolean
          updated_at?: string
          vertical?: string
          website?: string | null
        }
        Relationships: []
      }
      sponsor_reservations: {
        Row: {
          created_at: string
          deposit_amount: number
          id: string
          reservation_date: string
          reserved_by_company: string
          reserved_by_name: string
          reserved_email: string
          status: string
          stripe_payment_id: string | null
          stripe_session_id: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deposit_amount?: number
          id?: string
          reservation_date?: string
          reserved_by_company: string
          reserved_by_name: string
          reserved_email: string
          status?: string
          stripe_payment_id?: string | null
          stripe_session_id?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deposit_amount?: number
          id?: string
          reservation_date?: string
          reserved_by_company?: string
          reserved_by_name?: string
          reserved_email?: string
          status?: string
          stripe_payment_id?: string | null
          stripe_session_id?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_reservations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_teams: {
        Row: {
          brand_name: string | null
          claimed_by: string | null
          created_at: string
          id: string
          notes: string | null
          status: string
          team_id: string
          updated_at: string
        }
        Insert: {
          brand_name?: string | null
          claimed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          brand_name?: string | null
          claimed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_waitlist: {
        Row: {
          company: string
          created_at: string
          email: string
          id: string
          name: string
          team_id: string
        }
        Insert: {
          company: string
          created_at?: string
          email: string
          id?: string
          name: string
          team_id: string
        }
        Update: {
          company?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_waitlist_team_id_fkey"
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
      subscriptions: {
        Row: {
          auto_renews: boolean
          created_at: string
          entitlement_id: string
          huddle_id: string | null
          id: string
          original_transaction_id: string | null
          period_end: string | null
          period_start: string
          product_id: string
          raw_event: Json | null
          rc_app_user_id: string | null
          status: string
          store: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_renews?: boolean
          created_at?: string
          entitlement_id: string
          huddle_id?: string | null
          id?: string
          original_transaction_id?: string | null
          period_end?: string | null
          period_start: string
          product_id: string
          raw_event?: Json | null
          rc_app_user_id?: string | null
          status?: string
          store?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_renews?: boolean
          created_at?: string
          entitlement_id?: string
          huddle_id?: string | null
          id?: string
          original_transaction_id?: string | null
          period_end?: string | null
          period_start?: string
          product_id?: string
          raw_event?: Json | null
          rc_app_user_id?: string | null
          status?: string
          store?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_huddle_id_fkey"
            columns: ["huddle_id"]
            isOneToOne: false
            referencedRelation: "huddles_with_official"
            referencedColumns: ["id"]
          },
        ]
      }
      team_feeds: {
        Row: {
          created_at: string
          feed_url: string
          id: string
          is_active: boolean
          source_label: string | null
          team_id: string
        }
        Insert: {
          created_at?: string
          feed_url: string
          id?: string
          is_active?: boolean
          source_label?: string | null
          team_id: string
        }
        Update: {
          created_at?: string
          feed_url?: string
          id?: string
          is_active?: boolean
          source_label?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_feeds_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_progress: {
        Row: {
          found: number
          kind: string
          searched_at: string
          team: string
        }
        Insert: {
          found?: number
          kind: string
          searched_at?: string
          team: string
        }
        Update: {
          found?: number
          kind?: string
          searched_at?: string
          team?: string
        }
        Relationships: []
      }
      team_sponsors: {
        Row: {
          brand_name: string
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          link_url: string
          logo_url: string | null
          start_date: string
          team_id: string
          tier: number
        }
        Insert: {
          brand_name: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          link_url: string
          logo_url?: string | null
          start_date?: string
          team_id: string
          tier?: number
        }
        Update: {
          brand_name?: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          link_url?: string
          logo_url?: string | null
          start_date?: string
          team_id?: string
          tier?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_sponsors_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
      teams_live_state: {
        Row: {
          active_game_id: string | null
          active_opponent_team_id: string | null
          away_score: number | null
          cooldown_ends_at: string | null
          home_score: number | null
          is_home_team: boolean | null
          state: string
          team_id: string
          updated_at: string
        }
        Insert: {
          active_game_id?: string | null
          active_opponent_team_id?: string | null
          away_score?: number | null
          cooldown_ends_at?: string | null
          home_score?: number | null
          is_home_team?: boolean | null
          state?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          active_game_id?: string | null
          active_opponent_team_id?: string | null
          away_score?: number | null
          cooldown_ends_at?: string | null
          home_score?: number | null
          is_home_team?: boolean | null
          state?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_live_state_active_game_id_fkey"
            columns: ["active_game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_live_state_active_opponent_team_id_fkey"
            columns: ["active_opponent_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_live_state_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
      user_portfolios: {
        Row: {
          created_at: string | null
          is_premium: boolean | null
          last_free_claim_at: string | null
          last_reset_at: string | null
          minimum_chips: number | null
          starting_chips: number | null
          total_bets: number | null
          total_chips: number | null
          total_losses: number | null
          total_wins: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          is_premium?: boolean | null
          last_free_claim_at?: string | null
          last_reset_at?: string | null
          minimum_chips?: number | null
          starting_chips?: number | null
          total_bets?: number | null
          total_chips?: number | null
          total_losses?: number | null
          total_wins?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          is_premium?: boolean | null
          last_free_claim_at?: string | null
          last_reset_at?: string | null
          minimum_chips?: number | null
          starting_chips?: number | null
          total_bets?: number | null
          total_chips?: number | null
          total_losses?: number | null
          total_wins?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      huddles_with_official: {
        Row: {
          bio: string | null
          created_at: string | null
          event_id: string | null
          id: string | null
          is_official: boolean | null
          is_official_team_huddle: boolean | null
          is_private: boolean | null
          is_verified: boolean | null
          last_message_at: string | null
          member_count: number | null
          name: string | null
          official_status: string | null
          owner_id: string | null
          parent_team_id: string | null
          team_id: string | null
          updated_at: string | null
          verification_expires_at: string | null
          website_url: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string | null
          is_official?: never
          is_official_team_huddle?: boolean | null
          is_private?: boolean | null
          is_verified?: boolean | null
          last_message_at?: string | null
          member_count?: number | null
          name?: string | null
          official_status?: string | null
          owner_id?: string | null
          parent_team_id?: string | null
          team_id?: string | null
          updated_at?: string | null
          verification_expires_at?: string | null
          website_url?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string | null
          is_official?: never
          is_official_team_huddle?: boolean | null
          is_private?: boolean | null
          is_verified?: boolean | null
          last_message_at?: string | null
          member_count?: number | null
          name?: string | null
          official_status?: string | null
          owner_id?: string | null
          parent_team_id?: string | null
          team_id?: string | null
          updated_at?: string | null
          verification_expires_at?: string | null
          website_url?: string | null
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
      sponsor_claim_status: {
        Row: {
          status: string | null
          team_key: string | null
        }
        Insert: {
          status?: string | null
          team_key?: string | null
        }
        Update: {
          status?: string | null
          team_key?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_fade: { Args: { p_fade_id: string }; Returns: Json }
      accept_room_invite: {
        Args: { p_invite_code: string }
        Returns: {
          already_member: boolean
          huddle_id: string
          inviter_id: string
        }[]
      }
      activate_official_huddle: {
        Args: { p_entitlement_id?: string; p_huddle_id: string }
        Returns: {
          huddle_id: string
          status: string
        }[]
      }
      approve_huddle_join_request: {
        Args: { request_id: string }
        Returns: undefined
      }
      arena_claim_daily: {
        Args: { p_client: string; p_day?: string; p_handle?: string }
        Returns: Json
      }
      arena_place_stake: {
        Args: {
          p_amount: number
          p_client: string
          p_game: string
          p_side: string
        }
        Returns: Json
      }
      arena_place_stake_v2: {
        Args: {
          p_amount: number
          p_client: string
          p_event?: string
          p_game?: string
          p_side: string
        }
        Returns: Json
      }
      arena_set_avatar: {
        Args: { p_avatar: string; p_client: string }
        Returns: undefined
      }
      arena_settle_event: { Args: { p_event: string }; Returns: Json }
      arena_settle_game: { Args: { p_game: string }; Returns: Json }
      arena_toggle_follow: {
        Args: { p_client: string; p_target: string }
        Returns: Json
      }
      calculate_post_vote_score: {
        Args: { post_uuid: string }
        Returns: number
      }
      can_set_room_photo: { Args: { p_path: string }; Returns: boolean }
      claim_chapter_huddle: {
        Args: { p_code: string }
        Returns: {
          created: boolean
          huddle_id: string
          huddle_name: string
        }[]
      }
      claim_founding_spot: {
        Args: { p_promo_code: string; p_tier: string; p_user_id: string }
        Returns: number
      }
      claim_free_chips: { Args: never; Returns: Json }
      cleanup_old_presence_notifications: { Args: never; Returns: undefined }
      close_stale_live_games: { Args: never; Returns: number }
      co_huddlers: {
        Args: { p_limit?: number }
        Returns: {
          shared_huddles: number
          user_id: string
        }[]
      }
      connect_to: {
        Args: { p_source?: string; p_user_id: string }
        Returns: undefined
      }
      create_room_invite_code: {
        Args: { p_huddle_id: string }
        Returns: {
          invite_code: string
        }[]
      }
      delete_team_cascade: {
        Args: { team_id_input: string }
        Returns: undefined
      }
      discoverable_huddles: {
        Args: { p_limit?: number; p_search?: string }
        Returns: {
          bio: string
          id: string
          is_member: boolean
          is_official: boolean
          is_private: boolean
          known_count: number
          known_names: string[]
          member_count: number
          name: string
          team_logo_url: string
          team_name: string
        }[]
      }
      expire_fades: { Args: never; Returns: number }
      flip_huddle_official_status: {
        Args: { p_huddle_id: string; p_status: string }
        Returns: {
          huddle_id: string
          official_status: string
        }[]
      }
      gen_claim_code: { Args: never; Returns: string }
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
      get_huddle_leaderboard: {
        Args: { p_huddle_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          profit: number
          rank: number
          total_bets: number
          total_chips: number
          total_losses: number
          total_wins: number
          user_id: string
          username: string
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
      get_invite_preview: {
        Args: { p_invite_code: string }
        Returns: {
          huddle_name: string
          inviter_name: string
          member_count: number
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
      get_room_live_context: { Args: { p_room_id: string }; Returns: Json }
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
      hash_email: { Args: { p_email: string }; Returns: string }
      is_huddle_member: {
        Args: { _huddle_id: string; _user_id: string }
        Returns: boolean
      }
      join_team_huddle: {
        Args: { p_team_id: string }
        Returns: {
          already_member: boolean
          created: boolean
          huddle_id: string
        }[]
      }
      known_people: {
        Args: never
        Returns: {
          avatar_url: string
          connected_at: string
          display_name: string
          source: string
          user_id: string
          username: string
        }[]
      }
      match_contacts: {
        Args: { p_hashes: string[] }
        Returns: {
          already_connected: boolean
          avatar_url: string
          display_name: string
          matched_hash: string
          user_id: string
          username: string
        }[]
      }
      place_shadow_bet: {
        Args: { p_huddle_id: string; p_market_id: string; p_position: string }
        Returns: Json
      }
      post_fade:
        | {
            Args: {
              p_away_team: string
              p_fade_type: string
              p_game_commence_time: string
              p_game_id: string
              p_home_team: string
              p_huddle_id: string
              p_line_description: string
              p_line_value: number
              p_sport: string
              p_stake: number
              p_total_target: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_away_team: string
              p_fade_type: string
              p_game_commence_time: string
              p_game_id: string
              p_home_team: string
              p_huddle_id: string
              p_line_description: string
              p_line_value: number
              p_market_id?: string
              p_origin_message_id?: string
              p_sport: string
              p_stake: number
              p_total_target: string
            }
            Returns: Json
          }
      recalculate_entry_total: {
        Args: { _entry_id: string }
        Returns: undefined
      }
      reset_weekly_chips: { Args: never; Returns: number }
      settle_fade: {
        Args: { p_away_score: number; p_fade_id: string; p_home_score: number }
        Returns: Json
      }
      settle_fade_by_market: { Args: { p_fade_id: string }; Returns: Json }
      settle_shadow_bets: {
        Args: { p_market_id: string; p_resolution: string }
        Returns: number
      }
      team_card_url: { Args: { p_team_id: string }; Returns: string }
      upsert_fade_season: {
        Args: {
          p_huddle_id: string
          p_points_delta: number
          p_user_id: string
          p_won: boolean
        }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "member", "huddle_owner", "content_admin"],
      pickem_league: ["nfl", "ncaaf"],
    },
  },
} as const
