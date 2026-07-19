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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      entries: {
        Row: {
          category: string
          created_at: string
          entry_ninja_ref: string | null
          event_id: string
          id: string
          jacket_size: string | null
          merch: Json
          payment_ref: string | null
          payment_status: string
          total_cents: number
          tshirt_size: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          entry_ninja_ref?: string | null
          event_id: string
          id?: string
          jacket_size?: string | null
          merch?: Json
          payment_ref?: string | null
          payment_status?: string
          total_cents?: number
          tshirt_size?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          entry_ninja_ref?: string | null
          event_id?: string
          id?: string
          jacket_size?: string | null
          merch?: Json
          payment_ref?: string | null
          payment_status?: string
          total_cents?: number
          tshirt_size?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          description: string | null
          discipline: string
          distance_km: number
          entry_ninja_id: string | null
          entry_ninja_url: string | null
          event_date: string
          hero_color: string | null
          id: string
          location: string
          map_query: string | null
          name: string
          schedule: Json
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discipline: string
          distance_km?: number
          entry_ninja_id?: string | null
          entry_ninja_url?: string | null
          event_date: string
          hero_color?: string | null
          id?: string
          location: string
          map_query?: string | null
          name: string
          schedule?: Json
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discipline?: string
          distance_km?: number
          entry_ninja_id?: string | null
          entry_ninja_url?: string | null
          event_date?: string
          hero_color?: string | null
          id?: string
          location?: string
          map_query?: string | null
          name?: string
          schedule?: Json
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      feed_posts: {
        Row: {
          author: string
          body: string
          created_at: string
          event_id: string | null
          id: string
          pinned: boolean
          post_type: string
          posted_at: string
          title: string
          updated_at: string
        }
        Insert: {
          author?: string
          body: string
          created_at?: string
          event_id?: string | null
          id?: string
          pinned?: boolean
          post_type?: string
          posted_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          author?: string
          body?: string
          created_at?: string
          event_id?: string | null
          id?: string
          pinned?: boolean
          post_type?: string
          posted_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_posts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          entry_ninja_id: string | null
          full_name: string | null
          id: string
          jacket_size: string | null
          phone: string | null
          tshirt_size: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          entry_ninja_id?: string | null
          full_name?: string | null
          id: string
          jacket_size?: string | null
          phone?: string | null
          tshirt_size?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          entry_ninja_id?: string | null
          full_name?: string | null
          id?: string
          jacket_size?: string | null
          phone?: string | null
          tshirt_size?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promos: {
        Row: {
          accent: string
          brand: string
          code: string
          created_at: string
          discount: string
          expires: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          accent?: string
          brand: string
          code: string
          created_at?: string
          discount: string
          expires?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          accent?: string
          brand?: string
          code?: string
          created_at?: string
          discount?: string
          expires?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      sponsors: {
        Row: {
          accent: string
          active: boolean
          created_at: string
          id: string
          logo_text: string
          name: string
          sort_order: number
          tier: string
          updated_at: string
          url: string | null
        }
        Insert: {
          accent?: string
          active?: boolean
          created_at?: string
          id?: string
          logo_text: string
          name: string
          sort_order?: number
          tier?: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          accent?: string
          active?: boolean
          created_at?: string
          id?: string
          logo_text?: string
          name?: string
          sort_order?: number
          tier?: string
          updated_at?: string
          url?: string | null
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
          role: Database["public"]["Enums"]["app_role"]
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "rider"
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
      app_role: ["admin", "rider"],
    },
  },
} as const
