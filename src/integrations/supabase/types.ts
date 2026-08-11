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
      admin_qa_messages: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          is_admin_msg: boolean
          is_bot: boolean
          thread_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_admin_msg?: boolean
          is_bot?: boolean
          thread_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_admin_msg?: boolean
          is_bot?: boolean
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_qa_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "admin_qa_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_qa_threads: {
        Row: {
          created_at: string
          event_id: string
          id: string
          last_message_at: string | null
          rider_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          last_message_at?: string | null
          rider_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          last_message_at?: string | null
          rider_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_qa_threads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          created_at: string
          device: string | null
          duration_ms: number | null
          event_name: string
          id: string
          path: string
          props: Json
          referrer: string | null
          route_label: string | null
          session_id: string
          user_agent: string | null
          user_id: string | null
          viewport_width: number | null
        }
        Insert: {
          created_at?: string
          device?: string | null
          duration_ms?: number | null
          event_name?: string
          id?: string
          path: string
          props?: Json
          referrer?: string | null
          route_label?: string | null
          session_id: string
          user_agent?: string | null
          user_id?: string | null
          viewport_width?: number | null
        }
        Update: {
          created_at?: string
          device?: string | null
          duration_ms?: number | null
          event_name?: string
          id?: string
          path?: string
          props?: Json
          referrer?: string | null
          route_label?: string | null
          session_id?: string
          user_agent?: string | null
          user_id?: string | null
          viewport_width?: number | null
        }
        Relationships: []
      }
      entrants: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          id_number_hash: string | null
          id_number_last4: string | null
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          id_number_hash?: string | null
          id_number_last4?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          id_number_hash?: string | null
          id_number_last4?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
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
      event_chat_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          event_id: string
          id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          event_id: string
          id?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          event_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_chat_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_entrants: {
        Row: {
          batch: string | null
          bib_number: string | null
          category: string | null
          created_at: string
          entrant_id: string
          event_id: string
          external_id: string | null
          extras: Json
          finished_at: string | null
          id: string
          jacket_size: string | null
          notes: string | null
          started_at: string | null
          tshirt_size: string | null
          updated_at: string
        }
        Insert: {
          batch?: string | null
          bib_number?: string | null
          category?: string | null
          created_at?: string
          entrant_id: string
          event_id: string
          external_id?: string | null
          extras?: Json
          finished_at?: string | null
          id?: string
          jacket_size?: string | null
          notes?: string | null
          started_at?: string | null
          tshirt_size?: string | null
          updated_at?: string
        }
        Update: {
          batch?: string | null
          bib_number?: string | null
          category?: string | null
          created_at?: string
          entrant_id?: string
          event_id?: string
          external_id?: string | null
          extras?: Json
          finished_at?: string | null
          id?: string
          jacket_size?: string | null
          notes?: string | null
          started_at?: string | null
          tshirt_size?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_entrants_entrant_id_fkey"
            columns: ["entrant_id"]
            isOneToOne: false
            referencedRelation: "entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_entrants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_info_blocks: {
        Row: {
          created_at: string
          distance_km: number | null
          elevation_m: number | null
          emergency_contacts: Json
          event_id: string
          faqs: Json
          gpx_url: string | null
          map_embed_url: string | null
          packing_list: Json
          parking_notes: string | null
          route_description: string | null
          rules_md: string | null
          updated_at: string
          venue_address: string | null
          venue_lat: number | null
          venue_lng: number | null
          waivers_md: string | null
        }
        Insert: {
          created_at?: string
          distance_km?: number | null
          elevation_m?: number | null
          emergency_contacts?: Json
          event_id: string
          faqs?: Json
          gpx_url?: string | null
          map_embed_url?: string | null
          packing_list?: Json
          parking_notes?: string | null
          route_description?: string | null
          rules_md?: string | null
          updated_at?: string
          venue_address?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
          waivers_md?: string | null
        }
        Update: {
          created_at?: string
          distance_km?: number | null
          elevation_m?: number | null
          emergency_contacts?: Json
          event_id?: string
          faqs?: Json
          gpx_url?: string | null
          map_embed_url?: string | null
          packing_list?: Json
          parking_notes?: string | null
          route_description?: string | null
          rules_md?: string | null
          updated_at?: string
          venue_address?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
          waivers_md?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_info_blocks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rooming: {
        Row: {
          created_at: string
          email: string | null
          entrant_id: string | null
          event_id: string
          full_name: string
          id: string
          notes: string | null
          room_type: string | null
          tent_number: string | null
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          entrant_id?: string | null
          event_id: string
          full_name: string
          id?: string
          notes?: string | null
          room_type?: string | null
          tent_number?: string | null
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          entrant_id?: string | null
          event_id?: string
          full_name?: string
          id?: string
          notes?: string | null
          room_type?: string | null
          tent_number?: string | null
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_rooming_entrant_id_fkey"
            columns: ["entrant_id"]
            isOneToOne: false
            referencedRelation: "entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rooming_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rooming_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "event_venues"
            referencedColumns: ["id"]
          },
        ]
      }
      event_venues: {
        Row: {
          address: string | null
          created_at: string
          event_id: string
          id: string
          name: string
          notes: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          event_id: string
          id?: string
          name: string
          notes?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          notes?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_venues_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          auto_created: boolean
          batches: Json
          classes: Json
          cover_url: string | null
          created_at: string
          days: Json
          description: string | null
          discipline: string
          distance_km: number
          entry_ninja_id: string | null
          entry_ninja_url: string | null
          event_date: string
          faq_url: string | null
          has_toilets: boolean
          hero_color: string | null
          id: string
          lifecycle: string
          location: string
          logo_url: string | null
          map_query: string | null
          name: string
          schedule: Json
          slug: string | null
          social_links: Json
          spectator_food: string | null
          spectator_mode: boolean
          spectator_notes: string | null
          spectator_parking: string | null
          status: string
          title_sponsor_logo_url: string | null
          title_sponsor_name: string | null
          title_sponsor_url: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          auto_created?: boolean
          batches?: Json
          classes?: Json
          cover_url?: string | null
          created_at?: string
          days?: Json
          description?: string | null
          discipline: string
          distance_km?: number
          entry_ninja_id?: string | null
          entry_ninja_url?: string | null
          event_date: string
          faq_url?: string | null
          has_toilets?: boolean
          hero_color?: string | null
          id?: string
          lifecycle?: string
          location: string
          logo_url?: string | null
          map_query?: string | null
          name: string
          schedule?: Json
          slug?: string | null
          social_links?: Json
          spectator_food?: string | null
          spectator_mode?: boolean
          spectator_notes?: string | null
          spectator_parking?: string | null
          status?: string
          title_sponsor_logo_url?: string | null
          title_sponsor_name?: string | null
          title_sponsor_url?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          auto_created?: boolean
          batches?: Json
          classes?: Json
          cover_url?: string | null
          created_at?: string
          days?: Json
          description?: string | null
          discipline?: string
          distance_km?: number
          entry_ninja_id?: string | null
          entry_ninja_url?: string | null
          event_date?: string
          faq_url?: string | null
          has_toilets?: boolean
          hero_color?: string | null
          id?: string
          lifecycle?: string
          location?: string
          logo_url?: string | null
          map_query?: string | null
          name?: string
          schedule?: Json
          slug?: string | null
          social_links?: Json
          spectator_food?: string | null
          spectator_mode?: boolean
          spectator_notes?: string | null
          spectator_parking?: string | null
          status?: string
          title_sponsor_logo_url?: string | null
          title_sponsor_name?: string | null
          title_sponsor_url?: string | null
          updated_at?: string
          website_url?: string | null
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
      feedback: {
        Row: {
          category: string
          created_at: string
          email: string | null
          id: string
          message: string
          name: string | null
          page_path: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          email?: string | null
          id?: string
          message: string
          name?: string | null
          page_path?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          name?: string | null
          page_path?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      packing_checklist_state: {
        Row: {
          checked: boolean
          event_id: string
          item_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          checked?: boolean
          event_id: string
          item_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          checked?: boolean
          event_id?: string
          item_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "packing_checklist_state_event_id_fkey"
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
          logo_url: string | null
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          accent?: string
          brand: string
          code: string
          created_at?: string
          discount: string
          expires?: string | null
          id?: string
          logo_url?: string | null
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          accent?: string
          brand?: string
          code?: string
          created_at?: string
          discount?: string
          expires?: string | null
          id?: string
          logo_url?: string | null
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
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
          logo_url: string | null
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
          logo_url?: string | null
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
          logo_url?: string | null
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
      is_admin: { Args: never; Returns: boolean }
      is_event_entrant: { Args: { _event_id: string }; Returns: boolean }
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
