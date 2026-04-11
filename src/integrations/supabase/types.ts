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
      assets: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          mime_type: string | null
          public_url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          mime_type?: string | null
          public_url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          mime_type?: string | null
          public_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_id: string
          content: string
          created_at: string
          excerpt: string | null
          id: string
          image_url: string | null
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          slug?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      business_profiles: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          complaints_book_url: string | null
          country: string | null
          created_at: string
          dre_url: string | null
          email: string | null
          facebook_url: string | null
          id: string
          instagram_url: string | null
          legal_name: string | null
          linkedin_url: string | null
          logo_url: string | null
          nif: string | null
          phone: string | null
          postal_code: string | null
          trade_name: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          complaints_book_url?: string | null
          country?: string | null
          created_at?: string
          dre_url?: string | null
          email?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          legal_name?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          nif?: string | null
          phone?: string | null
          postal_code?: string | null
          trade_name?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          complaints_book_url?: string | null
          country?: string | null
          created_at?: string
          dre_url?: string | null
          email?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          legal_name?: string | null
          linkedin_url?: string | null
          logo_url?: string | null
          nif?: string | null
          phone?: string | null
          postal_code?: string | null
          trade_name?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
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
      contact_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          subject?: string | null
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
      domain_registrations: {
        Row: {
          cost_price: number
          created_at: string
          domain_name: string
          expiry_date: string | null
          id: string
          nameservers: string[] | null
          porkbun_id: string | null
          purchase_price: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cost_price: number
          created_at?: string
          domain_name: string
          expiry_date?: string | null
          id?: string
          nameservers?: string[] | null
          porkbun_id?: string | null
          purchase_price: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cost_price?: number
          created_at?: string
          domain_name?: string
          expiry_date?: string | null
          id?: string
          nameservers?: string[] | null
          porkbun_id?: string | null
          purchase_price?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_campaigns: {
        Row: {
          content: string
          created_at: string
          from_email: string | null
          from_name: string | null
          id: string
          scheduled_at: string | null
          sent_at: string | null
          sent_count: number | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          from_email?: string | null
          from_name?: string | null
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          from_email?: string | null
          from_name?: string | null
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_ads_accounts: {
        Row: {
          created_at: string
          google_ads_customer_id: string | null
          google_email: string | null
          google_refresh_token: string
          id: string
          is_active: boolean
          mcc_customer_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          google_ads_customer_id?: string | null
          google_email?: string | null
          google_refresh_token: string
          id?: string
          is_active?: boolean
          mcc_customer_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          google_ads_customer_id?: string | null
          google_email?: string | null
          google_refresh_token?: string
          id?: string
          is_active?: boolean
          mcc_customer_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_analytics_connections: {
        Row: {
          created_at: string
          ga4_property_id: string | null
          google_access_token: string | null
          google_email: string | null
          google_refresh_token: string
          id: string
          is_active: boolean
          scopes: string[] | null
          search_console_site_url: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ga4_property_id?: string | null
          google_access_token?: string | null
          google_email?: string | null
          google_refresh_token: string
          id?: string
          is_active?: boolean
          scopes?: string[] | null
          search_console_site_url?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ga4_property_id?: string | null
          google_access_token?: string | null
          google_email?: string | null
          google_refresh_token?: string
          id?: string
          is_active?: boolean
          scopes?: string[] | null
          search_console_site_url?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      landing_pages: {
        Row: {
          created_at: string
          id: string
          is_published: boolean
          name: string
          project_id: string
          slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_published?: boolean
          name?: string
          project_id: string
          slug?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_published?: boolean
          name?: string
          project_id?: string
          slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_pages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
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
      legal_consents: {
        Row: {
          accepted_at: string
          created_at: string
          id: string
          ip_address: string | null
          plan_selected: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          plan_selected?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          plan_selected?: string | null
          user_id?: string
        }
        Relationships: []
      }
      meta_connections: {
        Row: {
          ad_account_id: string | null
          connection_type: string
          created_at: string
          facebook_page_id: string | null
          id: string
          instagram_business_id: string | null
          is_active: boolean
          page_access_token: string | null
          project_id: string
          updated_at: string
          user_id: string
          whatsapp_account_id: string | null
        }
        Insert: {
          ad_account_id?: string | null
          connection_type?: string
          created_at?: string
          facebook_page_id?: string | null
          id?: string
          instagram_business_id?: string | null
          is_active?: boolean
          page_access_token?: string | null
          project_id: string
          updated_at?: string
          user_id: string
          whatsapp_account_id?: string | null
        }
        Update: {
          ad_account_id?: string | null
          connection_type?: string
          created_at?: string
          facebook_page_id?: string | null
          id?: string
          instagram_business_id?: string | null
          is_active?: boolean
          page_access_token?: string | null
          project_id?: string
          updated_at?: string
          user_id?: string
          whatsapp_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_connections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      nx_usage_credits: {
        Row: {
          created_at: string
          id: string
          last_reset: string
          plan_name: string
          total_credits: number
          updated_at: string
          used_credits: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_reset?: string
          plan_name?: string
          total_credits?: number
          updated_at?: string
          used_credits?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_reset?: string
          plan_name?: string
          total_credits?: number
          updated_at?: string
          used_credits?: number
          user_id?: string
        }
        Relationships: []
      }
      page_sections: {
        Row: {
          content: Json
          created_at: string
          id: string
          landing_page_id: string
          page_id: string | null
          sort_order: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          landing_page_id: string
          page_id?: string | null
          sort_order?: number
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          landing_page_id?: string
          page_id?: string | null
          sort_order?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_sections_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "landing_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_sections_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          content: Json
          created_at: string
          id: string
          is_published: boolean
          project_id: string
          slug: string
          sort_order: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          is_published?: boolean
          project_id: string
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          is_published?: boolean
          project_id?: string
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_scans: {
        Row: {
          accessibility_score: number
          best_practices_score: number
          created_at: string
          id: string
          notes: string | null
          performance_score: number
          project_id: string
          scan_type: string
          scanned_by: string
          seo_score: number
        }
        Insert: {
          accessibility_score?: number
          best_practices_score?: number
          created_at?: string
          id?: string
          notes?: string | null
          performance_score?: number
          project_id: string
          scan_type?: string
          scanned_by: string
          seo_score?: number
        }
        Update: {
          accessibility_score?: number
          best_practices_score?: number
          created_at?: string
          id?: string
          notes?: string | null
          performance_score?: number
          project_id?: string
          scan_type?: string
          scanned_by?: string
          seo_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_scans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ai_credits_limit: number
          ai_credits_used: number
          ai_custom_instructions: string | null
          ai_images_limit: number
          ai_images_used: number
          avatar_url: string | null
          business_sector: string | null
          company_name: string | null
          contact_email: string | null
          created_at: string
          email_sends_limit: number
          email_sends_used: number
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
          whatsapp_usage_count: number
        }
        Insert: {
          ai_credits_limit?: number
          ai_credits_used?: number
          ai_custom_instructions?: string | null
          ai_images_limit?: number
          ai_images_used?: number
          avatar_url?: string | null
          business_sector?: string | null
          company_name?: string | null
          contact_email?: string | null
          created_at?: string
          email_sends_limit?: number
          email_sends_used?: number
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
          whatsapp_usage_count?: number
        }
        Update: {
          ai_credits_limit?: number
          ai_credits_used?: number
          ai_custom_instructions?: string | null
          ai_images_limit?: number
          ai_images_used?: number
          avatar_url?: string | null
          business_sector?: string | null
          company_name?: string | null
          contact_email?: string | null
          created_at?: string
          email_sends_limit?: number
          email_sends_used?: number
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          whatsapp_usage_count?: number
        }
        Relationships: []
      }
      project_credentials: {
        Row: {
          created_at: string
          facebook_page_id: string | null
          id: string
          instagram_business_id: string | null
          meta_access_token: string | null
          meta_ads_account_id: string | null
          project_id: string
          updated_at: string
          user_id: string
          whatsapp_business_id: string | null
          whatsapp_phone_number_id: string | null
        }
        Insert: {
          created_at?: string
          facebook_page_id?: string | null
          id?: string
          instagram_business_id?: string | null
          meta_access_token?: string | null
          meta_ads_account_id?: string | null
          project_id: string
          updated_at?: string
          user_id: string
          whatsapp_business_id?: string | null
          whatsapp_phone_number_id?: string | null
        }
        Update: {
          created_at?: string
          facebook_page_id?: string | null
          id?: string
          instagram_business_id?: string | null
          meta_access_token?: string | null
          meta_ads_account_id?: string | null
          project_id?: string
          updated_at?: string
          user_id?: string
          whatsapp_business_id?: string | null
          whatsapp_phone_number_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_credentials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          content: Json
          created_at: string
          domain: string | null
          facebook_page_id: string | null
          freelancer_notes: string | null
          google_analytics_id: string | null
          gtm_container_id: string | null
          id: string
          instagram_business_id: string | null
          measurement_id: string | null
          meta_access_token: string | null
          meta_ads_account_id: string | null
          name: string
          project_type: string
          selected_plan: string | null
          trial_expires_at: string | null
          updated_at: string
          user_id: string
          whatsapp_business_id: string | null
          whatsapp_phone_number_id: string | null
        }
        Insert: {
          content?: Json
          created_at?: string
          domain?: string | null
          facebook_page_id?: string | null
          freelancer_notes?: string | null
          google_analytics_id?: string | null
          gtm_container_id?: string | null
          id?: string
          instagram_business_id?: string | null
          measurement_id?: string | null
          meta_access_token?: string | null
          meta_ads_account_id?: string | null
          name: string
          project_type?: string
          selected_plan?: string | null
          trial_expires_at?: string | null
          updated_at?: string
          user_id: string
          whatsapp_business_id?: string | null
          whatsapp_phone_number_id?: string | null
        }
        Update: {
          content?: Json
          created_at?: string
          domain?: string | null
          facebook_page_id?: string | null
          freelancer_notes?: string | null
          google_analytics_id?: string | null
          gtm_container_id?: string | null
          id?: string
          instagram_business_id?: string | null
          measurement_id?: string | null
          meta_access_token?: string | null
          meta_ads_account_id?: string | null
          name?: string
          project_type?: string
          selected_plan?: string | null
          trial_expires_at?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_business_id?: string | null
          whatsapp_phone_number_id?: string | null
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
      subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          source: string | null
          status: string
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name?: string | null
          source?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          source?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          blog_limit: number
          blog_used: number
          concierge_limit: number
          concierge_used: number
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          perf_scan_limit: number
          perf_scan_used: number
          plan_type: string
          project_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
          usage_reset_at: string
          user_id: string
          whatsapp_ai_limit: number
          whatsapp_ai_used: number
        }
        Insert: {
          blog_limit?: number
          blog_used?: number
          concierge_limit?: number
          concierge_used?: number
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          perf_scan_limit?: number
          perf_scan_used?: number
          plan_type?: string
          project_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          usage_reset_at?: string
          user_id: string
          whatsapp_ai_limit?: number
          whatsapp_ai_used?: number
        }
        Update: {
          blog_limit?: number
          blog_used?: number
          concierge_limit?: number
          concierge_used?: number
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          perf_scan_limit?: number
          perf_scan_used?: number
          plan_type?: string
          project_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          usage_reset_at?: string
          user_id?: string
          whatsapp_ai_limit?: number
          whatsapp_ai_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_by: string | null
          assigned_to: string | null
          created_at: string
          description: string | null
          due_date: string | null
          freelancer_notes: string | null
          id: string
          priority: string
          project_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          freelancer_notes?: string | null
          id?: string
          priority?: string
          project_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          freelancer_notes?: string | null
          id?: string
          priority?: string
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          reference_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          reference_id?: string | null
          type?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      spend_credits: {
        Args: { p_action: string; p_cost: number }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "freelancer" | "customer"
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
      app_role: ["admin", "freelancer", "customer"],
    },
  },
} as const
