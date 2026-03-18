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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      admin_audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      campaign_groups: {
        Row: {
          campaign_id: string
          created_at: string
          group_id: string
          id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          group_id: string
          id?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_groups_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_instances: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          instance_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          instance_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          instance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_instances_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_instances_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_instances_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_items: {
        Row: {
          campaign_id: string
          created_at: string
          delay_after: number | null
          id: string
          item_type: Database["public"]["Enums"]["campaign_item_type"]
          media_caption: string | null
          media_filename: string | null
          media_type: Database["public"]["Enums"]["media_type"] | null
          media_url: string | null
          order_index: number
          poll_allow_multiple: boolean | null
          poll_options: Json | null
          poll_question: string | null
          text_content: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          delay_after?: number | null
          id?: string
          item_type?: Database["public"]["Enums"]["campaign_item_type"]
          media_caption?: string | null
          media_filename?: string | null
          media_type?: Database["public"]["Enums"]["media_type"] | null
          media_url?: string | null
          order_index?: number
          poll_allow_multiple?: boolean | null
          poll_options?: Json | null
          poll_question?: string | null
          text_content?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          delay_after?: number | null
          id?: string
          item_type?: Database["public"]["Enums"]["campaign_item_type"]
          media_caption?: string | null
          media_filename?: string | null
          media_type?: Database["public"]["Enums"]["media_type"] | null
          media_url?: string | null
          order_index?: number
          poll_allow_multiple?: boolean | null
          poll_options?: Json | null
          poll_question?: string | null
          text_content?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_items_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          completed_at: string | null
          created_at: string
          delay_between_groups: number | null
          delay_between_items: number | null
          deleted_at: string | null
          description: string | null
          failed_count: number
          id: string
          media_url: string | null
          message_content: string
          name: string
          scheduled_at: string | null
          sent_count: number
          started_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          total_recipients: number
          updated_at: string
          user_id: string
          whatsapp_instance_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          delay_between_groups?: number | null
          delay_between_items?: number | null
          deleted_at?: string | null
          description?: string | null
          failed_count?: number
          id?: string
          media_url?: string | null
          message_content: string
          name: string
          scheduled_at?: string | null
          sent_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          total_recipients?: number
          updated_at?: string
          user_id: string
          whatsapp_instance_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          delay_between_groups?: number | null
          delay_between_items?: number | null
          deleted_at?: string | null
          description?: string | null
          failed_count?: number
          id?: string
          media_url?: string | null
          message_content?: string
          name?: string
          scheduled_at?: string | null
          sent_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          total_recipients?: number
          updated_at?: string
          user_id?: string
          whatsapp_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_whatsapp_instance_id_fkey"
            columns: ["whatsapp_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_whatsapp_instance_id_fkey"
            columns: ["whatsapp_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      group_action_targets: {
        Row: {
          action_id: string
          created_at: string
          error_message: string | null
          executed_at: string | null
          group_id: string
          id: string
          status: Database["public"]["Enums"]["action_status"]
        }
        Insert: {
          action_id: string
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          group_id: string
          id?: string
          status?: Database["public"]["Enums"]["action_status"]
        }
        Update: {
          action_id?: string
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          group_id?: string
          id?: string
          status?: Database["public"]["Enums"]["action_status"]
        }
        Relationships: [
          {
            foreignKeyName: "group_action_targets_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "group_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_action_targets_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["group_action_type"]
          created_at: string
          error_message: string | null
          executed_at: string | null
          id: string
          new_value_file_url: string | null
          new_value_text: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["action_status"]
          updated_at: string
          user_id: string
          whatsapp_instance_id: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["group_action_type"]
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          new_value_file_url?: string | null
          new_value_text?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["action_status"]
          updated_at?: string
          user_id: string
          whatsapp_instance_id: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["group_action_type"]
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          new_value_file_url?: string | null
          new_value_text?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["action_status"]
          updated_at?: string
          user_id?: string
          whatsapp_instance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_actions_whatsapp_instance_id_fkey"
            columns: ["whatsapp_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_actions_whatsapp_instance_id_fkey"
            columns: ["whatsapp_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      group_instances: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          instance_id: string
          is_admin: boolean | null
          synced_at: string | null
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          instance_id: string
          is_admin?: boolean | null
          synced_at?: string | null
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          instance_id?: string
          is_admin?: boolean | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_instances_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_instances_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_instances_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      group_member_snapshots: {
        Row: {
          created_at: string
          group_id: string
          id: string
          member_count: number
          recorded_at: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          member_count?: number
          recorded_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          member_count?: number
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_member_snapshots_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          is_admin: boolean
          joined_at: string
          left_at: string | null
          name: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          is_admin?: boolean
          joined_at?: string
          left_at?: string | null
          name?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          is_admin?: boolean
          joined_at?: string
          left_at?: string | null
          name?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_snapshots: {
        Row: {
          action_id: string | null
          created_at: string
          description_before: string | null
          group_id: string
          id: string
          name_before: string | null
          photo_url_before: string | null
        }
        Insert: {
          action_id?: string | null
          created_at?: string
          description_before?: string | null
          group_id: string
          id?: string
          name_before?: string | null
          photo_url_before?: string | null
        }
        Update: {
          action_id?: string | null
          created_at?: string
          description_before?: string | null
          group_id?: string
          id?: string
          name_before?: string | null
          photo_url_before?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_snapshots_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "group_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_snapshots_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          instance_id: string
          invite_link: string | null
          is_active: boolean
          is_user_admin: boolean | null
          max_members: number
          member_count: number
          name: string
          participants_count: number | null
          photo_url: string | null
          synced_at: string | null
          updated_at: string
          user_id: string
          whatsapp_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          instance_id: string
          invite_link?: string | null
          is_active?: boolean
          is_user_admin?: boolean | null
          max_members?: number
          member_count?: number
          name: string
          participants_count?: number | null
          photo_url?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id: string
          whatsapp_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          instance_id?: string
          invite_link?: string | null
          is_active?: boolean
          is_user_admin?: boolean | null
          max_members?: number
          member_count?: number
          name?: string
          participants_count?: number | null
          photo_url?: string | null
          synced_at?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      instance_send_lock: {
        Row: {
          created_at: string
          instance_id: string
          locked_by: string
          locked_until: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          instance_id: string
          locked_by: string
          locked_until: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          instance_id?: string
          locked_by?: string
          locked_until?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instance_send_lock_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instance_send_lock_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_instances_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      intelligent_links: {
        Row: {
          anti_abuse_cooldown: number | null
          capacity_limit: number | null
          click_count: number
          created_at: string
          default_message: string | null
          description: string | null
          expires_at: string | null
          facebook_pixel_event: string | null
          facebook_pixel_id: string | null
          id: string
          landing_description: string | null
          logo_url: string | null
          mode: Database["public"]["Enums"]["link_mode"]
          name: string
          no_vacancy_message: string | null
          pixel_id: string | null
          redirect_url: string | null
          reserve_group_id: string | null
          settings: Json | null
          show_landing_page: boolean
          slug: string
          status: Database["public"]["Enums"]["link_status"]
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          anti_abuse_cooldown?: number | null
          capacity_limit?: number | null
          click_count?: number
          created_at?: string
          default_message?: string | null
          description?: string | null
          expires_at?: string | null
          facebook_pixel_event?: string | null
          facebook_pixel_id?: string | null
          id?: string
          landing_description?: string | null
          logo_url?: string | null
          mode?: Database["public"]["Enums"]["link_mode"]
          name: string
          no_vacancy_message?: string | null
          pixel_id?: string | null
          redirect_url?: string | null
          reserve_group_id?: string | null
          settings?: Json | null
          show_landing_page?: boolean
          slug: string
          status?: Database["public"]["Enums"]["link_status"]
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          anti_abuse_cooldown?: number | null
          capacity_limit?: number | null
          click_count?: number
          created_at?: string
          default_message?: string | null
          description?: string | null
          expires_at?: string | null
          facebook_pixel_event?: string | null
          facebook_pixel_id?: string | null
          id?: string
          landing_description?: string | null
          logo_url?: string | null
          mode?: Database["public"]["Enums"]["link_mode"]
          name?: string
          no_vacancy_message?: string | null
          pixel_id?: string | null
          redirect_url?: string | null
          reserve_group_id?: string | null
          settings?: Json | null
          show_landing_page?: boolean
          slug?: string
          status?: Database["public"]["Enums"]["link_status"]
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intelligent_links_pixel_id_fkey"
            columns: ["pixel_id"]
            isOneToOne: false
            referencedRelation: "user_pixels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intelligent_links_reserve_group_id_fkey"
            columns: ["reserve_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      link_clicks: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          group_id: string | null
          id: string
          ip_address: string | null
          is_bot: boolean | null
          link_id: string
          manual_group_id: string | null
          phone_number_id: string | null
          referer: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          ip_address?: string | null
          is_bot?: boolean | null
          link_id: string
          manual_group_id?: string | null
          phone_number_id?: string | null
          referer?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          ip_address?: string | null
          is_bot?: boolean | null
          link_id?: string
          manual_group_id?: string | null
          phone_number_id?: string | null
          referer?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "link_clicks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_clicks_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "intelligent_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_clicks_manual_group_id_fkey"
            columns: ["manual_group_id"]
            isOneToOne: false
            referencedRelation: "link_manual_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_clicks_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "link_phone_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      link_group_history: {
        Row: {
          added_at: string | null
          group_name: string | null
          id: string
          link_id: string
          removed_at: string | null
          whatsapp_id: string
        }
        Insert: {
          added_at?: string | null
          group_name?: string | null
          id?: string
          link_id: string
          removed_at?: string | null
          whatsapp_id: string
        }
        Update: {
          added_at?: string | null
          group_name?: string | null
          id?: string
          link_id?: string
          removed_at?: string | null
          whatsapp_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "link_group_history_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "intelligent_links"
            referencedColumns: ["id"]
          },
        ]
      }
      link_groups: {
        Row: {
          created_at: string
          group_id: string
          id: string
          is_active: boolean
          link_id: string
          priority: number
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          is_active?: boolean
          link_id: string
          priority?: number
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          is_active?: boolean
          link_id?: string
          priority?: number
        }
        Relationships: [
          {
            foreignKeyName: "link_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "link_groups_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "intelligent_links"
            referencedColumns: ["id"]
          },
        ]
      }
      link_manual_groups: {
        Row: {
          click_limit: number
          created_at: string
          current_clicks: number
          id: string
          internal_name: string
          invite_url: string
          is_active: boolean
          link_id: string
          priority: number
          updated_at: string
        }
        Insert: {
          click_limit?: number
          created_at?: string
          current_clicks?: number
          id?: string
          internal_name: string
          invite_url: string
          is_active?: boolean
          link_id: string
          priority?: number
          updated_at?: string
        }
        Update: {
          click_limit?: number
          created_at?: string
          current_clicks?: number
          id?: string
          internal_name?: string
          invite_url?: string
          is_active?: boolean
          link_id?: string
          priority?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "link_manual_groups_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "intelligent_links"
            referencedColumns: ["id"]
          },
        ]
      }
      link_phone_numbers: {
        Row: {
          created_at: string
          current_clicks: number
          display_name: string | null
          id: string
          internal_name: string
          is_active: boolean
          link_id: string
          phone_number: string
          priority: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_clicks?: number
          display_name?: string | null
          id?: string
          internal_name: string
          is_active?: boolean
          link_id: string
          phone_number: string
          priority?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_clicks?: number
          display_name?: string | null
          id?: string
          internal_name?: string
          is_active?: boolean
          link_id?: string
          phone_number?: string
          priority?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "link_phone_numbers_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "intelligent_links"
            referencedColumns: ["id"]
          },
        ]
      }
      message_audit_log: {
        Row: {
          api_endpoint: string | null
          block_reason: string | null
          caller_info: Json | null
          campaign_id: string | null
          created_at: string
          function_name: string | null
          group_id: string | null
          group_whatsapp_id: string | null
          id: string
          instance_id: string | null
          instance_name: string | null
          item_id: string | null
          message_preview: string | null
          message_type: string | null
          request_payload: Json | null
          response_payload: Json | null
          response_status: number | null
          source: string
          user_id: string | null
          was_blocked: boolean | null
        }
        Insert: {
          api_endpoint?: string | null
          block_reason?: string | null
          caller_info?: Json | null
          campaign_id?: string | null
          created_at?: string
          function_name?: string | null
          group_id?: string | null
          group_whatsapp_id?: string | null
          id?: string
          instance_id?: string | null
          instance_name?: string | null
          item_id?: string | null
          message_preview?: string | null
          message_type?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          response_status?: number | null
          source: string
          user_id?: string | null
          was_blocked?: boolean | null
        }
        Update: {
          api_endpoint?: string | null
          block_reason?: string | null
          caller_info?: Json | null
          campaign_id?: string | null
          created_at?: string
          function_name?: string | null
          group_id?: string | null
          group_whatsapp_id?: string | null
          id?: string
          instance_id?: string | null
          instance_name?: string | null
          item_id?: string | null
          message_preview?: string | null
          message_type?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          response_status?: number | null
          source?: string
          user_id?: string | null
          was_blocked?: boolean | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string | null
          external_payment_id: string
          external_subscription_id: string | null
          id: string
          paid_at: string | null
          payer_email: string | null
          payment_method: string | null
          payment_type: string | null
          raw_data: Json | null
          status: string
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string | null
          external_payment_id: string
          external_subscription_id?: string | null
          id?: string
          paid_at?: string | null
          payer_email?: string | null
          payment_method?: string | null
          payment_type?: string | null
          raw_data?: Json | null
          status: string
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string | null
          external_payment_id?: string
          external_subscription_id?: string | null
          id?: string
          paid_at?: string | null
          payer_email?: string | null
          payment_method?: string | null
          payment_type?: string | null
          raw_data?: Json | null
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          description: string | null
          features: Json | null
          id: string
          is_active: boolean
          max_campaigns_month: number | null
          max_groups: number | null
          max_instances: number | null
          max_links: number | null
          name: string
          periodicity: string
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          max_campaigns_month?: number | null
          max_groups?: number | null
          max_instances?: number | null
          max_links?: number | null
          name: string
          periodicity?: string
          price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          max_campaigns_month?: number | null
          max_groups?: number | null
          max_instances?: number | null
          max_links?: number | null
          name?: string
          periodicity?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string
          facebook_pixel_id: string | null
          facebook_pixel_name: string | null
          full_name: string | null
          id: string
          payment_failed_at: string | null
          phone: string | null
          subscription_expires_at: string | null
          subscription_started_at: string | null
          subscription_status:
            | Database["public"]["Enums"]["subscription_status_full"]
            | null
          suspended_at: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email: string
          facebook_pixel_id?: string | null
          facebook_pixel_name?: string | null
          full_name?: string | null
          id: string
          payment_failed_at?: string | null
          phone?: string | null
          subscription_expires_at?: string | null
          subscription_started_at?: string | null
          subscription_status?:
            | Database["public"]["Enums"]["subscription_status_full"]
            | null
          suspended_at?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string
          facebook_pixel_id?: string | null
          facebook_pixel_name?: string | null
          full_name?: string | null
          id?: string
          payment_failed_at?: string | null
          phone?: string | null
          subscription_expires_at?: string | null
          subscription_started_at?: string | null
          subscription_status?:
            | Database["public"]["Enums"]["subscription_status_full"]
            | null
          suspended_at?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      send_logs: {
        Row: {
          api_call_started_at: string | null
          api_response: Json | null
          campaign_id: string
          campaign_item_id: string | null
          created_at: string
          error_message: string | null
          execution_id: string | null
          group_id: string
          id: string
          retry_count: number | null
          scheduled_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["send_log_status"]
        }
        Insert: {
          api_call_started_at?: string | null
          api_response?: Json | null
          campaign_id: string
          campaign_item_id?: string | null
          created_at?: string
          error_message?: string | null
          execution_id?: string | null
          group_id: string
          id?: string
          retry_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["send_log_status"]
        }
        Update: {
          api_call_started_at?: string | null
          api_response?: Json | null
          campaign_id?: string
          campaign_item_id?: string | null
          created_at?: string
          error_message?: string | null
          execution_id?: string | null
          group_id?: string
          id?: string
          retry_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["send_log_status"]
        }
        Relationships: [
          {
            foreignKeyName: "send_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "send_logs_campaign_item_id_fkey"
            columns: ["campaign_item_id"]
            isOneToOne: false
            referencedRelation: "campaign_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "send_logs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_status: Database["public"]["Enums"]["subscription_status_full"]
          old_status:
            | Database["public"]["Enums"]["subscription_status_full"]
            | null
          reason: string | null
          subscription_id: string
          user_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: Database["public"]["Enums"]["subscription_status_full"]
          old_status?:
            | Database["public"]["Enums"]["subscription_status_full"]
            | null
          reason?: string | null
          subscription_id: string
          user_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["subscription_status_full"]
          old_status?:
            | Database["public"]["Enums"]["subscription_status_full"]
            | null
          reason?: string | null
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_history_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          expires_at: string | null
          external_subscription_id: string | null
          id: string
          payment_failed_at: string | null
          periodicity: string
          plan_id: string
          started_at: string
          status: Database["public"]["Enums"]["subscription_status_full"]
          suspended_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string | null
          external_subscription_id?: string | null
          id?: string
          payment_failed_at?: string | null
          periodicity?: string
          plan_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status_full"]
          suspended_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string | null
          external_subscription_id?: string | null
          id?: string
          payment_failed_at?: string | null
          periodicity?: string
          plan_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status_full"]
          suspended_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_config: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_secret: boolean | null
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_secret?: boolean | null
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_secret?: boolean | null
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      ticket_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_url: string
          id: string
          message_id: string | null
          mime_type: string
          ticket_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_url: string
          id?: string
          message_id?: string | null
          mime_type: string
          ticket_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_url?: string
          id?: string
          message_id?: string | null
          mime_type?: string
          ticket_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ticket_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_notifications_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_pixels: {
        Row: {
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          pixel_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          pixel_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          pixel_id?: string
          updated_at?: string
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
      whatsapp_instances: {
        Row: {
          api_key: string | null
          api_url: string | null
          created_at: string
          evolution_instance_id: string | null
          id: string
          instance_name: string
          instance_token: string | null
          last_connected_at: string | null
          name: string
          nickname: string | null
          phone_masked: string | null
          phone_number: string | null
          qr_code: string | null
          status: Database["public"]["Enums"]["instance_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key?: string | null
          api_url?: string | null
          created_at?: string
          evolution_instance_id?: string | null
          id?: string
          instance_name: string
          instance_token?: string | null
          last_connected_at?: string | null
          name: string
          nickname?: string | null
          phone_masked?: string | null
          phone_number?: string | null
          qr_code?: string | null
          status?: Database["public"]["Enums"]["instance_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string | null
          api_url?: string | null
          created_at?: string
          evolution_instance_id?: string | null
          id?: string
          instance_name?: string
          instance_token?: string | null
          last_connected_at?: string | null
          name?: string
          nickname?: string | null
          phone_masked?: string | null
          phone_number?: string | null
          qr_code?: string | null
          status?: Database["public"]["Enums"]["instance_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      whatsapp_instances_safe: {
        Row: {
          api_key_masked: string | null
          created_at: string | null
          id: string | null
          instance_name: string | null
          instance_token_masked: string | null
          last_connected_at: string | null
          name: string | null
          nickname: string | null
          phone_masked: string | null
          phone_number: string | null
          status: Database["public"]["Enums"]["instance_status"] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          api_key_masked?: never
          created_at?: string | null
          id?: string | null
          instance_name?: string | null
          instance_token_masked?: never
          last_connected_at?: string | null
          name?: string | null
          nickname?: string | null
          phone_masked?: string | null
          phone_number?: string | null
          status?: Database["public"]["Enums"]["instance_status"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          api_key_masked?: never
          created_at?: string | null
          id?: string | null
          instance_name?: string | null
          instance_token_masked?: never
          last_connected_at?: string | null
          name?: string | null
          nickname?: string | null
          phone_masked?: string | null
          phone_number?: string | null
          status?: Database["public"]["Enums"]["instance_status"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_user_execute_actions: { Args: { _user_id: string }; Returns: boolean }
      check_rate_limit: {
        Args: {
          _action_type: string
          _max_requests?: number
          _user_id: string
          _window_minutes?: number
        }
        Returns: boolean
      }
      cleanup_expired_locks: { Args: never; Returns: number }
      get_orphaned_links: {
        Args: { p_user_id: string }
        Returns: {
          link_id: string
          link_name: string
          link_slug: string
          missing_groups: number
          recoverable_groups: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_user_suspended: { Args: { _user_id: string }; Returns: boolean }
      is_valid_url: { Args: { url: string }; Returns: boolean }
      record_daily_group_snapshots: { Args: never; Returns: number }
      recover_link_groups: {
        Args: { p_link_id: string; p_user_id: string }
        Returns: number
      }
      sanitize_text_input: { Args: { input_text: string }; Returns: string }
    }
    Enums: {
      action_status:
        | "pending"
        | "executing"
        | "completed"
        | "failed"
        | "cancelled"
      app_role: "admin" | "user"
      campaign_item_type: "text" | "media" | "poll"
      campaign_status:
        | "draft"
        | "scheduled"
        | "running"
        | "completed"
        | "cancelled"
        | "deleted"
      group_action_type: "name" | "description" | "photo"
      instance_status:
        | "connected"
        | "disconnected"
        | "connecting"
        | "qr_pending"
      link_mode: "connected" | "manual" | "direct_chat"
      link_status: "active" | "inactive" | "expired"
      media_type: "image" | "video" | "document" | "audio"
      send_log_status: "pending" | "sent" | "failed"
      subscription_status: "active" | "inactive" | "cancelled" | "trial"
      subscription_status_full:
        | "trial"
        | "active"
        | "payment_pending"
        | "suspended"
        | "cancelled"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status:
        | "open"
        | "in_progress"
        | "waiting_customer"
        | "waiting_support"
        | "resolved"
        | "closed"
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
      action_status: [
        "pending",
        "executing",
        "completed",
        "failed",
        "cancelled",
      ],
      app_role: ["admin", "user"],
      campaign_item_type: ["text", "media", "poll"],
      campaign_status: [
        "draft",
        "scheduled",
        "running",
        "completed",
        "cancelled",
        "deleted",
      ],
      group_action_type: ["name", "description", "photo"],
      instance_status: [
        "connected",
        "disconnected",
        "connecting",
        "qr_pending",
      ],
      link_mode: ["connected", "manual", "direct_chat"],
      link_status: ["active", "inactive", "expired"],
      media_type: ["image", "video", "document", "audio"],
      send_log_status: ["pending", "sent", "failed"],
      subscription_status: ["active", "inactive", "cancelled", "trial"],
      subscription_status_full: [
        "trial",
        "active",
        "payment_pending",
        "suspended",
        "cancelled",
      ],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: [
        "open",
        "in_progress",
        "waiting_customer",
        "waiting_support",
        "resolved",
        "closed",
      ],
    },
  },
} as const
