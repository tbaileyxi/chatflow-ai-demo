export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
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
      huddle_members: {
        Row: {
          huddle_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          huddle_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          huddle_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
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
          content: string
          created_at: string
          embed_code: string | null
          huddle_id: string
          id: string
          is_team_agent_message: boolean | null
          media_type: string | null
          media_url: string | null
          poll_data: Json | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          embed_code?: string | null
          huddle_id: string
          id?: string
          is_team_agent_message?: boolean | null
          media_type?: string | null
          media_url?: string | null
          poll_data?: Json | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          embed_code?: string | null
          huddle_id?: string
          id?: string
          is_team_agent_message?: boolean | null
          media_type?: string | null
          media_url?: string | null
          poll_data?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      huddles: {
        Row: {
          created_at: string
          id: string
          is_private: boolean | null
          last_message_at: string | null
          member_count: number | null
          name: string
          owner_id: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_private?: boolean | null
          last_message_at?: string | null
          member_count?: number | null
          name: string
          owner_id: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_private?: boolean | null
          last_message_at?: string | null
          member_count?: number | null
          name?: string
          owner_id?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "huddles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string | null
          id: string
          option_id: number
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          option_id: number
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          option_id?: number
          post_id?: string
          user_id?: string
        }
        Relationships: []
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
          huddle_id: string | null
          id: string
          is_agent_post: boolean | null
          is_spotlight: boolean | null
          is_team_agent_message: boolean | null
          media_url: string | null
          message_type: string | null
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
          huddle_id?: string | null
          id?: string
          is_agent_post?: boolean | null
          is_spotlight?: boolean | null
          is_team_agent_message?: boolean | null
          media_url?: string | null
          message_type?: string | null
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
          huddle_id?: string | null
          id?: string
          is_agent_post?: boolean | null
          is_spotlight?: boolean | null
          is_team_agent_message?: boolean | null
          media_url?: string | null
          message_type?: string | null
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
          id: string
          last_login_at: string | null
          phone_number: string | null
          signup_method: string | null
          status: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          banned_at?: string | null
          banned_reason?: string | null
          bio?: string | null
          blocked_at?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_login_at?: string | null
          phone_number?: string | null
          signup_method?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          banned_at?: string | null
          banned_reason?: string | null
          bio?: string | null
          blocked_at?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_login_at?: string | null
          phone_number?: string | null
          signup_method?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
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
          id: string
          league: string | null
          logo_url: string | null
          name: string
          sponsor: string | null
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
          id?: string
          league?: string | null
          logo_url?: string | null
          name: string
          sponsor?: string | null
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
          id?: string
          league?: string | null
          logo_url?: string | null
          name?: string
          sponsor?: string | null
          stats?: Json | null
          status?: string | null
          updated_at?: string
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
      calculate_post_vote_score: {
        Args: { post_uuid: string }
        Returns: number
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_public_profile: {
        Args: { target_user_id: string }
        Returns: {
          user_id: string
          display_name: string
          username: string
          avatar_url: string
          bio: string
        }[]
      }
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      is_huddle_member: {
        Args: { _huddle_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "member" | "huddle_owner"
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
      app_role: ["admin", "member", "huddle_owner"],
    },
  },
} as const
