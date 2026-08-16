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
          channel: string
          created_at: string
          event_id: string
          id: string
          last_message_at: string | null
          rider_user_id: string | null
          updated_at: string
          wa_name: string | null
          wa_phone: string | null
        }
        Insert: {
          channel?: string
          created_at?: string
          event_id: string
          id?: string
          last_message_at?: string | null
          rider_user_id?: string | null
          updated_at?: string
          wa_name?: string | null
          wa_phone?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          event_id?: string
          id?: string
          last_message_at?: string | null
          rider_user_id?: string | null
          updated_at?: string
          wa_name?: string | null
          wa_phone?: string | null
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
      content_audit_runs: {
        Row: {
          created_at: string
          error: string | null
          events_checked: number
          id: string
          issue_count: number
          issues: Json
          run_at: string
          status: string
          summary: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          events_checked?: number
          id?: string
          issue_count?: number
          issues?: Json
          run_at?: string
          status?: string
          summary?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          events_checked?: number
          id?: string
          issue_count?: number
          issues?: Json
          run_at?: string
          status?: string
          summary?: string | null
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
      event_bot_knowledge: {
        Row: {
          content: string
          created_at: string
          event_id: string
          last_error: string | null
          refreshed_at: string | null
          sources: Json
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          event_id: string
          last_error?: string | null
          refreshed_at?: string | null
          sources?: Json
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          event_id?: string
          last_error?: string | null
          refreshed_at?: string | null
          sources?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_bot_knowledge_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
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
          amount_due_cents: number | null
          amount_paid_cents: number | null
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
          paid: boolean | null
          payment_synced_at: string | null
          registration_ref: string | null
          started_at: string | null
          tshirt_size: string | null
          updated_at: string
        }
        Insert: {
          amount_due_cents?: number | null
          amount_paid_cents?: number | null
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
          paid?: boolean | null
          payment_synced_at?: string | null
          registration_ref?: string | null
          started_at?: string | null
          tshirt_size?: string | null
          updated_at?: string
        }
        Update: {
          amount_due_cents?: number | null
          amount_paid_cents?: number | null
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
          paid?: boolean | null
          payment_synced_at?: string | null
          registration_ref?: string | null
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
      event_faq_learned: {
        Row: {
          answer: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          event_id: string | null
          expires_on: string | null
          id: string
          question: string
          source_message_id: string | null
          source_thread_id: string | null
          status: string
          times_used: number
          updated_at: string
        }
        Insert: {
          answer: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          expires_on?: string | null
          id?: string
          question: string
          source_message_id?: string | null
          source_thread_id?: string | null
          status?: string
          times_used?: number
          updated_at?: string
        }
        Update: {
          answer?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          expires_on?: string | null
          id?: string
          question?: string
          source_message_id?: string | null
          source_thread_id?: string | null
          status?: string
          times_used?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_faq_learned_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_faq_learned_source_thread_id_fkey"
            columns: ["source_thread_id"]
            isOneToOne: false
            referencedRelation: "admin_qa_threads"
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
      event_merch_options: {
        Row: {
          created_at: string
          en_item_id: number | null
          event_id: string
          id: string
          name: string
          options: Json
          position: number
          synced_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          en_item_id?: number | null
          event_id: string
          id?: string
          name: string
          options?: Json
          position?: number
          synced_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          en_item_id?: number | null
          event_id?: string
          id?: string
          name?: string
          options?: Json
          position?: number
          synced_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_merch_options_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_photos_cache: {
        Row: {
          album_url: string | null
          created_at: string
          event_id: string
          last_error: string | null
          photos: Json
          refreshed_at: string | null
          updated_at: string
        }
        Insert: {
          album_url?: string | null
          created_at?: string
          event_id: string
          last_error?: string | null
          photos?: Json
          refreshed_at?: string | null
          updated_at?: string
        }
        Update: {
          album_url?: string | null
          created_at?: string
          event_id?: string
          last_error?: string | null
          photos?: Json
          refreshed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_photos_cache_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_result_sets: {
        Row: {
          column_map: Json
          created_at: string
          event_id: string
          id: string
          imported_at: string
          kind: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          column_map?: Json
          created_at?: string
          event_id: string
          id?: string
          imported_at?: string
          kind?: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          column_map?: Json
          created_at?: string
          event_id?: string
          id?: string
          imported_at?: string
          kind?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_result_sets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_results: {
        Row: {
          batch: string | null
          bib_number: string | null
          category: string | null
          created_at: string
          event_entrant_id: string | null
          event_id: string
          extras: Json
          full_name: string
          gap_text: string | null
          id: string
          position: number | null
          result_set_id: string
          status: string | null
          time_ms: number | null
          time_text: string | null
          updated_at: string
        }
        Insert: {
          batch?: string | null
          bib_number?: string | null
          category?: string | null
          created_at?: string
          event_entrant_id?: string | null
          event_id: string
          extras?: Json
          full_name: string
          gap_text?: string | null
          id?: string
          position?: number | null
          result_set_id: string
          status?: string | null
          time_ms?: number | null
          time_text?: string | null
          updated_at?: string
        }
        Update: {
          batch?: string | null
          bib_number?: string | null
          category?: string | null
          created_at?: string
          event_entrant_id?: string | null
          event_id?: string
          extras?: Json
          full_name?: string
          gap_text?: string | null
          id?: string
          position?: number | null
          result_set_id?: string
          status?: string | null
          time_ms?: number | null
          time_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_results_event_entrant_id_fkey"
            columns: ["event_entrant_id"]
            isOneToOne: false
            referencedRelation: "event_entrants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_results_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_results_result_set_id_fkey"
            columns: ["result_set_id"]
            isOneToOne: false
            referencedRelation: "event_result_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rooming: {
        Row: {
          created_at: string
          email: string | null
          entrant_id: string | null
          event_entrant_id: string | null
          event_id: string
          full_name: string
          id: string
          location_hint: string | null
          match_source: string
          notes: string | null
          room_type: string | null
          tent_number: string | null
          updated_at: string
          venue_id: string | null
          village_spot_id: string | null
          village_tent_id: string | null
          village_zone_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          entrant_id?: string | null
          event_entrant_id?: string | null
          event_id: string
          full_name: string
          id?: string
          location_hint?: string | null
          match_source?: string
          notes?: string | null
          room_type?: string | null
          tent_number?: string | null
          updated_at?: string
          venue_id?: string | null
          village_spot_id?: string | null
          village_tent_id?: string | null
          village_zone_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          entrant_id?: string | null
          event_entrant_id?: string | null
          event_id?: string
          full_name?: string
          id?: string
          location_hint?: string | null
          match_source?: string
          notes?: string | null
          room_type?: string | null
          tent_number?: string | null
          updated_at?: string
          venue_id?: string | null
          village_spot_id?: string | null
          village_tent_id?: string | null
          village_zone_id?: string | null
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
            foreignKeyName: "event_rooming_event_entrant_id_fkey"
            columns: ["event_entrant_id"]
            isOneToOne: false
            referencedRelation: "event_entrants"
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
      event_schedule_sync: {
        Row: {
          applied_at: string | null
          auto_apply: boolean
          created_at: string
          event_id: string
          items: Json
          last_error: string | null
          sources: Json
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          auto_apply?: boolean
          created_at?: string
          event_id: string
          items?: Json
          last_error?: string | null
          sources?: Json
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          auto_apply?: boolean
          created_at?: string
          event_id?: string
          items?: Json
          last_error?: string | null
          sources?: Json
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_schedule_sync_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
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
          rooming_sheet_error: string | null
          rooming_sheet_range: string | null
          rooming_sheet_rows: number | null
          rooming_sheet_synced_at: string | null
          rooming_sheet_url: string | null
          sort_order: number
          updated_at: string
          village_spot_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          event_id: string
          id?: string
          name: string
          notes?: string | null
          rooming_sheet_error?: string | null
          rooming_sheet_range?: string | null
          rooming_sheet_rows?: number | null
          rooming_sheet_synced_at?: string | null
          rooming_sheet_url?: string | null
          sort_order?: number
          updated_at?: string
          village_spot_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          notes?: string | null
          rooming_sheet_error?: string | null
          rooming_sheet_range?: string | null
          rooming_sheet_rows?: number | null
          rooming_sheet_synced_at?: string | null
          rooming_sheet_url?: string | null
          sort_order?: number
          updated_at?: string
          village_spot_id?: string | null
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
      event_village_maps: {
        Row: {
          created_at: string
          event_id: string
          geo: Json
          hotspots: Json
          image_url: string | null
          intro: string | null
          updated_at: string
          zones: Json
        }
        Insert: {
          created_at?: string
          event_id: string
          geo?: Json
          hotspots?: Json
          image_url?: string | null
          intro?: string | null
          updated_at?: string
          zones?: Json
        }
        Update: {
          created_at?: string
          event_id?: string
          geo?: Json
          hotspots?: Json
          image_url?: string | null
          intro?: string | null
          updated_at?: string
          zones?: Json
        }
        Relationships: [
          {
            foreignKeyName: "event_village_maps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_village_tent_rules: {
        Row: {
          created_at: string
          event_id: string
          id: string
          pattern: string
          updated_at: string
          zone_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          pattern: string
          updated_at?: string
          zone_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          pattern?: string
          updated_at?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_village_tent_rules_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_village_tents: {
        Row: {
          capacity: number | null
          created_at: string
          event_id: string
          id: string
          kind: string
          label: string
          lat: number
          lng: number
          notes: string | null
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          event_id: string
          id?: string
          kind?: string
          label: string
          lat: number
          lng: number
          notes?: string | null
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string
          event_id?: string
          id?: string
          kind?: string
          label?: string
          lat?: number
          lng?: number
          notes?: string | null
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_village_tents_event_id_fkey"
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
          photos_album_url: string | null
          results_published: boolean
          results_rider_url_template: string | null
          results_url: string | null
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
          photos_album_url?: string | null
          results_published?: boolean
          results_rider_url_template?: string | null
          results_url?: string | null
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
          photos_album_url?: string | null
          results_published?: boolean
          results_rider_url_template?: string | null
          results_url?: string | null
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
          source_url: string | null
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
          source_url?: string | null
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
          source_url?: string | null
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
      id_lookup_attempts: {
        Row: {
          created_at: string
          id: string
          id_hash: string | null
          ip_hash: string | null
          outcome: string
        }
        Insert: {
          created_at?: string
          id?: string
          id_hash?: string | null
          ip_hash?: string | null
          outcome: string
        }
        Update: {
          created_at?: string
          id?: string
          id_hash?: string | null
          ip_hash?: string | null
          outcome?: string
        }
        Relationships: []
      }
      notification_deliveries: {
        Row: {
          channel: string
          clicked_at: string | null
          created_at: string
          error: string | null
          id: string
          notification_id: string
          status: string
          subscription_id: string | null
          user_id: string | null
        }
        Insert: {
          channel?: string
          clicked_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          notification_id: string
          status?: string
          subscription_id?: string | null
          user_id?: string | null
        }
        Update: {
          channel?: string
          clicked_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          notification_id?: string
          status?: string
          subscription_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          event_reminders: boolean
          news: boolean
          safety: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          event_reminders?: boolean
          news?: boolean
          safety?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          event_reminders?: boolean
          news?: boolean
          safety?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          audience: string
          batch: string | null
          body: string
          channels: string[]
          clicked_count: number
          created_by: string | null
          dedupe_key: string | null
          delivered_count: number
          event_id: string | null
          failed_count: number
          id: string
          image_url: string | null
          recipients_count: number
          sent_at: string
          source: string
          title: string
          urgent: boolean
          url: string | null
        }
        Insert: {
          audience?: string
          batch?: string | null
          body: string
          channels?: string[]
          clicked_count?: number
          created_by?: string | null
          dedupe_key?: string | null
          delivered_count?: number
          event_id?: string | null
          failed_count?: number
          id?: string
          image_url?: string | null
          recipients_count?: number
          sent_at?: string
          source?: string
          title: string
          urgent?: boolean
          url?: string | null
        }
        Update: {
          audience?: string
          batch?: string | null
          body?: string
          channels?: string[]
          clicked_count?: number
          created_by?: string | null
          dedupe_key?: string | null
          delivered_count?: number
          event_id?: string | null
          failed_count?: number
          id?: string
          image_url?: string | null
          recipients_count?: number
          sent_at?: string
          source?: string
          title?: string
          urgent?: boolean
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          failure_count: number
          id: string
          last_seen_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          failure_count?: number
          id?: string
          last_seen_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          failure_count?: number
          id?: string
          last_seen_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
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
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "rider" | "crew"
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
      app_role: ["admin", "rider", "crew"],
    },
  },
} as const
