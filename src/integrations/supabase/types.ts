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
      appointments: {
        Row: {
          benefit_id: string | null
          charged_amount: number | null
          client_id: string | null
          client_lastname: string
          client_name: string
          client_phone: string
          code: string
          created_at: string
          date: string
          end_time: string
          id: string
          needs_approval: boolean
          notes: string | null
          price_at_booking: number | null
          professional_id: string
          service_id: string
          start_time: string
          status: Database["public"]["Enums"]["appointment_status"]
          token: string
          updated_at: string
        }
        Insert: {
          benefit_id?: string | null
          charged_amount?: number | null
          client_id?: string | null
          client_lastname: string
          client_name: string
          client_phone: string
          code?: string
          created_at?: string
          date: string
          end_time: string
          id?: string
          needs_approval?: boolean
          notes?: string | null
          price_at_booking?: number | null
          professional_id: string
          service_id: string
          start_time: string
          status?: Database["public"]["Enums"]["appointment_status"]
          token?: string
          updated_at?: string
        }
        Update: {
          benefit_id?: string | null
          charged_amount?: number | null
          client_id?: string | null
          client_lastname?: string
          client_name?: string
          client_phone?: string
          code?: string
          created_at?: string
          date?: string
          end_time?: string
          id?: string
          needs_approval?: boolean
          notes?: string | null
          price_at_booking?: number | null
          professional_id?: string
          service_id?: string
          start_time?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: true
            referencedRelation: "benefits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_exceptions: {
        Row: {
          created_at: string
          date: string
          end_time: string | null
          id: string
          is_available: boolean
          professional_id: string
          reason: string | null
          start_time: string | null
        }
        Insert: {
          created_at?: string
          date: string
          end_time?: string | null
          id?: string
          is_available?: boolean
          professional_id: string
          reason?: string | null
          start_time?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string | null
          id?: string
          is_available?: boolean
          professional_id?: string
          reason?: string | null
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "availability_exceptions_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      benefits: {
        Row: {
          client_id: string
          created_at: string
          id: string
          kind: string
          sent_at: string | null
          status: string
          token: string
          used_at: string | null
          valid_until: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          kind: string
          sent_at?: string | null
          status?: string
          token?: string
          used_at?: string | null
          valid_until: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          kind?: string
          sent_at?: string | null
          status?: string
          token?: string
          used_at?: string | null
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "benefits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          break_end: string | null
          break_start: string | null
          enabled: boolean
          end_time: string
          id: string
          professional_id: string
          slot_interval_min: number
          start_time: string
          weekday: number
        }
        Insert: {
          break_end?: string | null
          break_start?: string | null
          enabled?: boolean
          end_time?: string
          id?: string
          professional_id: string
          slot_interval_min?: number
          start_time?: string
          weekday: number
        }
        Update: {
          break_end?: string | null
          break_start?: string | null
          enabled?: boolean
          end_time?: string
          id?: string
          professional_id?: string
          slot_interval_min?: number
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      business_settings: {
        Row: {
          address: string
          business_name: string
          cancel_hours_limit: number
          id: number
          instagram_url: string | null
          max_days_ahead: number
          min_advance_hours: number
          payment_alias: string | null
          share_text: string
          welcome_text: string
          whatsapp: string
        }
        Insert: {
          address?: string
          business_name?: string
          cancel_hours_limit?: number
          id?: number
          instagram_url?: string | null
          max_days_ahead?: number
          min_advance_hours?: number
          payment_alias?: string | null
          share_text?: string
          welcome_text?: string
          whatsapp?: string
        }
        Update: {
          address?: string
          business_name?: string
          cancel_hours_limit?: number
          id?: number
          instagram_url?: string | null
          max_days_ahead?: number
          min_advance_hours?: number
          payment_alias?: string | null
          share_text?: string
          welcome_text?: string
          whatsapp?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string
          id: string
          lastname: string | null
          name: string
          phone_e164: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lastname?: string | null
          name: string
          phone_e164: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lastname?: string | null
          name?: string
          phone_e164?: string
          updated_at?: string
        }
        Relationships: []
      }
      professionals: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          buffer_min: number
          created_at: string
          description: string | null
          duration_min: number
          id: string
          name: string
          price: number | null
          show_price: boolean
          sort_order: number
        }
        Insert: {
          active?: boolean
          buffer_min?: number
          created_at?: string
          description?: string | null
          duration_min: number
          id?: string
          name: string
          price?: number | null
          show_price?: boolean
          sort_order?: number
        }
        Update: {
          active?: boolean
          buffer_min?: number
          created_at?: string
          description?: string | null
          duration_min?: number
          id?: string
          name?: string
          price?: number | null
          show_price?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      time_blocks: {
        Row: {
          created_at: string
          date: string
          end_time: string
          id: string
          professional_id: string
          reason: string | null
          start_time: string
        }
        Insert: {
          created_at?: string
          date: string
          end_time: string
          id?: string
          professional_id: string
          reason?: string | null
          start_time: string
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string
          id?: string
          professional_id?: string
          reason?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_blocks_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      claim_admin: { Args: never; Returns: boolean }
      create_appointment: {
        Args: {
          p_admin_created?: boolean
          p_client_lastname: string
          p_client_name: string
          p_client_phone: string
          p_date: string
          p_end_time: string
          p_notes: string
          p_phone_e164?: string | null
          p_professional_id: string
          p_service_id: string
          p_start_time: string
        }
        Returns: {
          client_id: string | null
          client_lastname: string
          client_name: string
          client_phone: string
          code: string
          created_at: string
          date: string
          end_time: string
          id: string
          needs_approval: boolean
          notes: string | null
          professional_id: string
          service_id: string
          start_time: string
          status: Database["public"]["Enums"]["appointment_status"]
          token: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "superadmin"
      appointment_status:
        | "pendiente"
        | "confirmado"
        | "atendido"
        | "cancelado"
        | "no_asistio"
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
  public: {
    Enums: {
      app_role: ["admin", "superadmin"],
      appointment_status: [
        "pendiente",
        "confirmado",
        "atendido",
        "cancelado",
        "no_asistio",
      ],
    },
  },
} as const
