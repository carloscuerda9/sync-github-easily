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
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          notes: string | null
          physio_id: string
          player_id: string
          scheduled_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          type: Database["public"]["Enums"]["appointment_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          physio_id: string
          player_id: string
          scheduled_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          type?: Database["public"]["Enums"]["appointment_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          physio_id?: string
          player_id?: string
          scheduled_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          type?: Database["public"]["Enums"]["appointment_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_physio_id_fkey"
            columns: ["physio_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          description: string | null
          file_type: string | null
          file_url: string
          id: string
          recipient_id: string
          title: string
          uploader_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_type?: string | null
          file_url: string
          id?: string
          recipient_id: string
          title: string
          uploader_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_type?: string | null
          file_url?: string
          id?: string
          recipient_id?: string
          title?: string
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form_assignments: {
        Row: {
          assigned_at: string
          completed: boolean
          completed_at: string | null
          form_id: string
          id: string
          player_id: string
        }
        Insert: {
          assigned_at?: string
          completed?: boolean
          completed_at?: string | null
          form_id: string
          id?: string
          player_id: string
        }
        Update: {
          assigned_at?: string
          completed?: boolean
          completed_at?: string | null
          form_id?: string
          id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_assignments_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_assignments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          external_url: string
          id: string
          physio_id: string
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          external_url: string
          id?: string
          physio_id: string
          title: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          external_url?: string
          id?: string
          physio_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_physio_id_fkey"
            columns: ["physio_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      injuries: {
        Row: {
          actual_return_date: string | null
          body_part: string
          club_id: string | null
          created_at: string
          expected_return_date: string | null
          id: string
          injury_date: string
          injury_type: string
          is_recurrence: boolean
          match_id: string | null
          mechanism: string | null
          notes: string | null
          physio_id: string | null
          player_id: string
          recovery_days: number | null
          severity: string | null
          treatment: string | null
        }
        Insert: {
          actual_return_date?: string | null
          body_part: string
          club_id?: string | null
          created_at?: string
          expected_return_date?: string | null
          id?: string
          injury_date: string
          injury_type: string
          is_recurrence?: boolean
          match_id?: string | null
          mechanism?: string | null
          notes?: string | null
          physio_id?: string | null
          player_id: string
          recovery_days?: number | null
          severity?: string | null
          treatment?: string | null
        }
        Update: {
          actual_return_date?: string | null
          body_part?: string
          club_id?: string | null
          created_at?: string
          expected_return_date?: string | null
          id?: string
          injury_date?: string
          injury_type?: string
          is_recurrence?: boolean
          match_id?: string | null
          mechanism?: string | null
          notes?: string | null
          physio_id?: string | null
          player_id?: string
          recovery_days?: number | null
          severity?: string | null
          treatment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "injuries_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "injuries_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "injuries_physio_id_fkey"
            columns: ["physio_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "injuries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      injury_reports: {
        Row: {
          action_type: string
          attended_by: string | null
          body_part: string
          can_continue: boolean
          club_id: string | null
          context: string
          created_at: string
          file_type: string | null
          file_url: string | null
          id: string
          match_location: string | null
          moment: string
          observations: string | null
          player_id: string
          previous_same_injury: boolean
          reviewed: boolean
          updated_at: string
          was_attended: boolean
        }
        Insert: {
          action_type: string
          attended_by?: string | null
          body_part: string
          can_continue?: boolean
          club_id?: string | null
          context: string
          created_at?: string
          file_type?: string | null
          file_url?: string | null
          id?: string
          match_location?: string | null
          moment: string
          observations?: string | null
          player_id: string
          previous_same_injury?: boolean
          reviewed?: boolean
          updated_at?: string
          was_attended?: boolean
        }
        Update: {
          action_type?: string
          attended_by?: string | null
          body_part?: string
          can_continue?: boolean
          club_id?: string | null
          context?: string
          created_at?: string
          file_type?: string | null
          file_url?: string | null
          id?: string
          match_location?: string | null
          moment?: string
          observations?: string | null
          player_id?: string
          previous_same_injury?: boolean
          reviewed?: boolean
          updated_at?: string
          was_attended?: boolean
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          appointment_id: string | null
          concept: string | null
          created_at: string
          currency: string
          id: string
          issued_at: string
          paid_at: string | null
          pdf_url: string | null
          physio_id: string
          player_id: string
          status: Database["public"]["Enums"]["invoice_status"]
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          concept?: string | null
          created_at?: string
          currency?: string
          id?: string
          issued_at?: string
          paid_at?: string | null
          pdf_url?: string | null
          physio_id: string
          player_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          concept?: string | null
          created_at?: string
          currency?: string
          id?: string
          issued_at?: string
          paid_at?: string | null
          pdf_url?: string | null
          physio_id?: string
          player_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
        }
        Relationships: [
          {
            foreignKeyName: "invoices_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_physio_id_fkey"
            columns: ["physio_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_minutes: {
        Row: {
          club_id: string | null
          competition: string | null
          created_at: string
          dorsal: number | null
          entro_min: number | null
          id: string
          match_date: string
          match_id: string | null
          minutes_played: number
          minutos_amarilla: number
          motivo_salida: string | null
          notes: string | null
          opponent: string
          player_id: string
          recorded_by: string | null
          salio_min: number | null
          started: boolean
          tramos: Json | null
          updated_at: string
        }
        Insert: {
          club_id?: string | null
          competition?: string | null
          created_at?: string
          dorsal?: number | null
          entro_min?: number | null
          id?: string
          match_date: string
          match_id?: string | null
          minutes_played?: number
          minutos_amarilla?: number
          motivo_salida?: string | null
          notes?: string | null
          opponent?: string
          player_id: string
          recorded_by?: string | null
          salio_min?: number | null
          started?: boolean
          tramos?: Json | null
          updated_at?: string
        }
        Update: {
          club_id?: string | null
          competition?: string | null
          created_at?: string
          dorsal?: number | null
          entro_min?: number | null
          id?: string
          match_date?: string
          match_id?: string | null
          minutes_played?: number
          minutos_amarilla?: number
          motivo_salida?: string | null
          notes?: string | null
          opponent?: string
          player_id?: string
          recorded_by?: string | null
          salio_min?: number | null
          started?: boolean
          tramos?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_minutes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_minutes_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_minutes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_minutes_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          acta_ref: string | null
          club_id: string
          competicion: string | null
          created_at: string
          created_by: string | null
          duracion_min: number
          fecha: string
          id: string
          jornada: string | null
          local_visitante: string | null
          resultado_contra: number | null
          resultado_favor: number | null
          rival: string
          updated_at: string
        }
        Insert: {
          acta_ref?: string | null
          club_id: string
          competicion?: string | null
          created_at?: string
          created_by?: string | null
          duracion_min?: number
          fecha: string
          id?: string
          jornada?: string | null
          local_visitante?: string | null
          resultado_contra?: number | null
          resultado_favor?: number | null
          rival: string
          updated_at?: string
        }
        Update: {
          acta_ref?: string | null
          club_id?: string
          competicion?: string | null
          created_at?: string
          created_by?: string | null
          duracion_min?: number
          fecha?: string
          id?: string
          jornada?: string | null
          local_visitante?: string | null
          resultado_contra?: number | null
          resultado_favor?: number | null
          rival?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json
          content: string
          created_at: string
          id: string
          read: boolean
          receiver_id: string
          sender_id: string
        }
        Insert: {
          attachments?: Json
          content: string
          created_at?: string
          id?: string
          read?: boolean
          receiver_id: string
          sender_id: string
        }
        Update: {
          attachments?: Json
          content?: string
          created_at?: string
          id?: string
          read?: boolean
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      physio_invoices: {
        Row: {
          admin_id: string
          amount: number
          created_at: string
          description: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          invoice_date: string
          invoice_type: Database["public"]["Enums"]["physio_invoice_type"]
          physio_id: string
          updated_at: string
        }
        Insert: {
          admin_id: string
          amount: number
          created_at?: string
          description: string
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          invoice_date: string
          invoice_type: Database["public"]["Enums"]["physio_invoice_type"]
          physio_id: string
          updated_at?: string
        }
        Update: {
          admin_id?: string
          amount?: number
          created_at?: string
          description?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          invoice_date?: string
          invoice_type?: Database["public"]["Enums"]["physio_invoice_type"]
          physio_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "physio_invoices_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "physio_invoices_physio_id_fkey"
            columns: ["physio_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_aliases: {
        Row: {
          alias_normalized: string | null
          alias_raw: string
          club_id: string
          confidence: number | null
          created_at: string
          created_by: string | null
          id: string
          player_id: string
          source: string
        }
        Insert: {
          alias_normalized?: string | null
          alias_raw: string
          club_id: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          player_id: string
          source?: string
        }
        Update: {
          alias_normalized?: string | null
          alias_raw?: string
          club_id?: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          player_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_aliases_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_aliases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_aliases_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_leaves: {
        Row: {
          active: boolean
          created_at: string
          document_url: string | null
          end_date: string | null
          id: string
          physio_id: string
          player_id: string
          reason: string | null
          start_date: string
          type: Database["public"]["Enums"]["leave_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          document_url?: string | null
          end_date?: string | null
          id?: string
          physio_id: string
          player_id: string
          reason?: string | null
          start_date?: string
          type: Database["public"]["Enums"]["leave_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          document_url?: string | null
          end_date?: string | null
          id?: string
          physio_id?: string
          player_id?: string
          reason?: string | null
          start_date?: string
          type?: Database["public"]["Enums"]["leave_type"]
          updated_at?: string
        }
        Relationships: []
      }
      player_tag_history: {
        Row: {
          club_id: string | null
          color: string
          id: string
          player_id: string
          previous_color: string | null
          reason: string | null
          set_at: string
          set_by: string | null
        }
        Insert: {
          club_id?: string | null
          color: string
          id?: string
          player_id: string
          previous_color?: string | null
          reason?: string | null
          set_at?: string
          set_by?: string | null
        }
        Update: {
          club_id?: string | null
          color?: string
          id?: string
          player_id?: string
          previous_color?: string | null
          reason?: string | null
          set_at?: string
          set_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_tag_history_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_tag_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_tag_history_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          physio_id: string
          player_id: string
          updated_at: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          physio_id: string
          player_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          physio_id?: string
          player_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          club_id: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          profile_data: Json
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          club_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          profile_data?: Json
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          club_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          profile_data?: Json
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      registration_questions: {
        Row: {
          active: boolean
          created_at: string
          display_order: number
          field_key: string
          field_type: string
          id: string
          options: Json | null
          question_text: string
          required: boolean
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_order?: number
          field_key: string
          field_type?: string
          id?: string
          options?: Json | null
          question_text: string
          required?: boolean
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          active?: boolean
          created_at?: string
          display_order?: number
          field_key?: string
          field_type?: string
          id?: string
          options?: Json | null
          question_text?: string
          required?: boolean
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      sessions: {
        Row: {
          appointment_id: string
          created_at: string
          duration_actual: number | null
          id: string
          physio_notes: string | null
          player_feedback: string | null
        }
        Insert: {
          appointment_id: string
          created_at?: string
          duration_actual?: number | null
          id?: string
          physio_notes?: string | null
          player_feedback?: string | null
        }
        Update: {
          appointment_id?: string
          created_at?: string
          duration_actual?: number | null
          id?: string
          physio_notes?: string | null
          player_feedback?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
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
      v_player_tag_periods: {
        Row: {
          club_id: string | null
          color: string | null
          dias_en_color: number | null
          id: string | null
          periodo_abierto: boolean | null
          player_id: string | null
          previous_color: string | null
          reason: string | null
          set_by: string | null
          valid_from: string | null
          valid_to: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_tag_history_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_tag_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_tag_history_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_access_document_path: { Args: { _path: string }; Returns: boolean }
      dispatch_push_notification: {
        Args: {
          _body: string
          _href: string
          _kind: string
          _title: string
          _user_id: string
        }
        Returns: undefined
      }
      find_club_by_code: {
        Args: { _code: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      get_club_code: { Args: { _club_id: string }; Returns: string }
      get_user_club: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      is_owner: { Args: { _user_id: string }; Returns: boolean }
      normalize_name: { Args: { _txt: string }; Returns: string }
      owner_email: { Args: never; Returns: string }
      owner_id: { Args: never; Returns: string }
      physio_treats_player: {
        Args: { _physio_id: string; _player_id: string }
        Returns: boolean
      }
      same_club: {
        Args: { _user_a: string; _user_b: string }
        Returns: boolean
      }
      staff_shares_club_with: {
        Args: { _player_id: string; _staff_id: string }
        Returns: boolean
      }
      user_wants_notification: {
        Args: { _key: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      account_status: "pending" | "approved" | "rejected"
      app_role: "player" | "physio" | "superadmin" | "coach"
      appointment_status:
        | "requested"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "rejected"
      appointment_type: "in_person" | "home_visit" | "sports_event"
      invoice_status: "draft" | "sent" | "paid"
      leave_type: "deportiva" | "medica"
      physio_invoice_type:
        | "material"
        | "sesion_privada_fisio"
        | "sesion_privada_medico"
        | "otro"
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
      account_status: ["pending", "approved", "rejected"],
      app_role: ["player", "physio", "superadmin", "coach"],
      appointment_status: [
        "requested",
        "confirmed",
        "cancelled",
        "completed",
        "rejected",
      ],
      appointment_type: ["in_person", "home_visit", "sports_event"],
      invoice_status: ["draft", "sent", "paid"],
      leave_type: ["deportiva", "medica"],
      physio_invoice_type: [
        "material",
        "sesion_privada_fisio",
        "sesion_privada_medico",
        "otro",
      ],
    },
  },
} as const
