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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ads_campaigns: {
        Row: {
          ad_copy: string | null
          created_at: string
          daily_budget: number
          end_date: string | null
          id: string
          metrics: Json | null
          platform: string
          project_id: string | null
          start_date: string | null
          status: string
          target_audience: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ad_copy?: string | null
          created_at?: string
          daily_budget?: number
          end_date?: string | null
          id?: string
          metrics?: Json | null
          platform: string
          project_id?: string | null
          start_date?: string | null
          status?: string
          target_audience?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ad_copy?: string | null
          created_at?: string
          daily_budget?: number
          end_date?: string | null
          id?: string
          metrics?: Json | null
          platform?: string
          project_id?: string | null
          start_date?: string | null
          status?: string
          target_audience?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_campaigns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_pages: {
        Row: {
          content: string | null
          created_at: string
          custom_fields: Json | null
          id: string
          page_type: string
          project_id: string | null
          status: string
          updated_at: string
          user_id: string
          validated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          custom_fields?: Json | null
          id?: string
          page_type: string
          project_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
          validated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          custom_fields?: Json | null
          id?: string
          page_type?: string
          project_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_pages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      concierge_conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversation_messages: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          message_text: string
          sender_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          message_text: string
          sender_type: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          message_text?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      cookie_consent_settings: {
        Row: {
          accept_button_text: string | null
          background_color: string | null
          banner_text: string | null
          button_color: string | null
          created_at: string
          enabled: boolean
          id: string
          position: string | null
          project_id: string | null
          reject_button_text: string | null
          settings_button_text: string | null
          text_color: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accept_button_text?: string | null
          background_color?: string | null
          banner_text?: string | null
          button_color?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          position?: string | null
          project_id?: string | null
          reject_button_text?: string | null
          settings_button_text?: string | null
          text_color?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accept_button_text?: string | null
          background_color?: string | null
          banner_text?: string | null
          button_color?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          position?: string | null
          project_id?: string | null
          reject_button_text?: string | null
          settings_button_text?: string | null
          text_color?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cookie_consent_settings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ai_classification: string | null
          company: string | null
          created_at: string
          custom_fields: Json | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          priority: string | null
          reminder_date: string | null
          source: string | null
          status: string
          tags: string[] | null
          updated_at: string
          user_id: string
          value: number | null
          whatsapp_message: string | null
        }
        Insert: {
          ai_classification?: string | null
          company?: string | null
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          priority?: string | null
          reminder_date?: string | null
          source?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
          value?: number | null
          whatsapp_message?: string | null
        }
        Update: {
          ai_classification?: string | null
          company?: string | null
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          priority?: string | null
          reminder_date?: string | null
          source?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
          value?: number | null
          whatsapp_message?: string | null
        }
        Relationships: []
      }
      notes_reminders: {
        Row: {
          content: string
          created_at: string
          due_date: string | null
          id: string
          is_completed: boolean
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          due_date?: string | null
          id?: string
          is_completed?: boolean
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          due_date?: string | null
          id?: string
          is_completed?: boolean
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ai_custom_instructions: string | null
          avatar_url: string | null
          business_sector: string | null
          company_name: string | null
          contact_email: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
          whatsapp_usage_count: number
        }
        Insert: {
          ai_custom_instructions?: string | null
          avatar_url?: string | null
          business_sector?: string | null
          company_name?: string | null
          contact_email?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
          whatsapp_usage_count?: number
        }
        Update: {
          ai_custom_instructions?: string | null
          avatar_url?: string | null
          business_sector?: string | null
          company_name?: string | null
          contact_email?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          whatsapp_usage_count?: number
        }
        Relationships: []
      }
      projects: {
        Row: {
          content: Json
          created_at: string
          domain: string | null
          id: string
          meta_access_token: string | null
          meta_ads_account_id: string | null
          name: string
          project_type: string
          selected_plan: string | null
          trial_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          domain?: string | null
          id?: string
          meta_access_token?: string | null
          meta_ads_account_id?: string | null
          name: string
          project_type?: string
          selected_plan?: string | null
          trial_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          domain?: string | null
          id?: string
          meta_access_token?: string | null
          meta_ads_account_id?: string | null
          name?: string
          project_type?: string
          selected_plan?: string | null
          trial_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      social_posts: {
        Row: {
          caption: string
          created_at: string
          error_log: string | null
          hashtags: string[] | null
          id: string
          image_url: string | null
          platform: string
          published_at: string | null
          scheduled_at: string | null
          status: string
          updated_at: string
          user_id: string
          webhook_response: Json | null
          webhook_url: string | null
        }
        Insert: {
          caption: string
          created_at?: string
          error_log?: string | null
          hashtags?: string[] | null
          id?: string
          image_url?: string | null
          platform: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
          webhook_response?: Json | null
          webhook_url?: string | null
        }
        Update: {
          caption?: string
          created_at?: string
          error_log?: string | null
          hashtags?: string[] | null
          id?: string
          image_url?: string | null
          platform?: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          webhook_response?: Json | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      user_templates: {
        Row: {
          briefing: string
          category: string
          created_at: string
          description: string | null
          id: string
          name: string
          project_type: string
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          briefing: string
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          project_type?: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          briefing?: string
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          project_type?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_accounts: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          twilio_phone_number: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          twilio_phone_number: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          twilio_phone_number?: string
          updated_at?: string | null
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
