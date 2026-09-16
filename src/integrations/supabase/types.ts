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
      economic_indicators: {
        Row: {
          description: string | null
          key: string
          label: string
          source: string | null
          unit: string
          updated_at: string
          value: number
        }
        Insert: {
          description?: string | null
          key: string
          label: string
          source?: string | null
          unit?: string
          updated_at?: string
          value: number
        }
        Update: {
          description?: string | null
          key?: string
          label?: string
          source?: string | null
          unit?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      financial_records: {
        Row: {
          amount: number
          category: string
          created_at: string
          id: string
          kind: string
          note: string | null
          recorded_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          recorded_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          recorded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          data: Json | null
          id: string
          kind: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json | null
          id?: string
          kind?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json | null
          id?: string
          kind?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      ocr_documents: {
        Row: {
          created_at: string
          doc_type: string
          file_name: string | null
          id: string
          parsed_data: Json | null
          raw_text: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          doc_type: string
          file_name?: string | null
          id?: string
          parsed_data?: Json | null
          raw_text?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_name?: string | null
          id?: string
          parsed_data?: Json | null
          raw_text?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          entity_type: string | null
          id: string
          nit: string | null
          nit_last_digit: number | null
          onboarded: boolean
          sector: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          entity_type?: string | null
          id: string
          nit?: string | null
          nit_last_digit?: number | null
          onboarded?: boolean
          sector?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          entity_type?: string | null
          id?: string
          nit?: string | null
          nit_last_digit?: number | null
          onboarded?: boolean
          sector?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tax_deadlines: {
        Row: {
          created_at: string
          description: string | null
          due_date: string
          entity_type: string
          estatuto_article: string | null
          id: string
          nit_last_digit: number | null
          obligation: string
          period: string
          sector: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date: string
          entity_type?: string
          estatuto_article?: string | null
          id?: string
          nit_last_digit?: number | null
          obligation: string
          period: string
          sector?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string
          entity_type?: string
          estatuto_article?: string | null
          id?: string
          nit_last_digit?: number | null
          obligation?: string
          period?: string
          sector?: string
        }
        Relationships: []
      }
      tax_dictionary: {
        Row: {
          created_at: string
          definition: string
          entity_types: string[]
          estatuto_article: string | null
          id: string
          sectors: string[]
          term: string
        }
        Insert: {
          created_at?: string
          definition: string
          entity_types?: string[]
          estatuto_article?: string | null
          id?: string
          sectors?: string[]
          term: string
        }
        Update: {
          created_at?: string
          definition?: string
          entity_types?: string[]
          estatuto_article?: string | null
          id?: string
          sectors?: string[]
          term?: string
        }
        Relationships: []
      }
      user_reminders: {
        Row: {
          deadline_id: string
          id: string
          marked_at: string
          status: string
          user_id: string
        }
        Insert: {
          deadline_id: string
          id?: string
          marked_at?: string
          status?: string
          user_id: string
        }
        Update: {
          deadline_id?: string
          id?: string
          marked_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_reminders_deadline_id_fkey"
            columns: ["deadline_id"]
            isOneToOne: false
            referencedRelation: "tax_deadlines"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
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
      app_role: "super_admin" | "admin" | "user"
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
      app_role: ["super_admin", "admin", "user"],
    },
  },
} as const
