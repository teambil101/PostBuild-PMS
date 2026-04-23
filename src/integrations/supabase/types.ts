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
      app_settings: {
        Row: {
          contract_number_prefix: string
          created_at: string
          default_currency: string
          fiscal_year_start_month: number
          id: string
          self_person_id: string | null
          updated_at: string
        }
        Insert: {
          contract_number_prefix?: string
          created_at?: string
          default_currency?: string
          fiscal_year_start_month?: number
          id?: string
          self_person_id?: string | null
          updated_at?: string
        }
        Update: {
          contract_number_prefix?: string
          created_at?: string
          default_currency?: string
          fiscal_year_start_month?: number
          id?: string
          self_person_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_self_person_id_fkey"
            columns: ["self_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      buildings: {
        Row: {
          building_type: string
          city: string
          community: string | null
          country: string
          created_at: string
          created_by: string | null
          id: string
          location_url: string | null
          name: string
          ref_code: string
          updated_at: string
        }
        Insert: {
          building_type?: string
          city: string
          community?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          id?: string
          location_url?: string | null
          name: string
          ref_code: string
          updated_at?: string
        }
        Update: {
          building_type?: string
          city?: string
          community?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          id?: string
          location_url?: string | null
          name?: string
          ref_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      contract_events: {
        Row: {
          actor_id: string | null
          contract_id: string
          created_at: string
          description: string | null
          event_type: string
          from_value: string | null
          id: string
          to_value: string | null
        }
        Insert: {
          actor_id?: string | null
          contract_id: string
          created_at?: string
          description?: string | null
          event_type: string
          from_value?: string | null
          id?: string
          to_value?: string | null
        }
        Update: {
          actor_id?: string | null
          contract_id?: string
          created_at?: string
          description?: string | null
          event_type?: string
          from_value?: string | null
          id?: string
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_parties: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          is_primary: boolean
          notes: string | null
          person_id: string
          role: Database["public"]["Enums"]["contract_party_role"]
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          person_id: string
          role: Database["public"]["Enums"]["contract_party_role"]
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          person_id?: string
          role?: Database["public"]["Enums"]["contract_party_role"]
        }
        Relationships: [
          {
            foreignKeyName: "contract_parties_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_parties_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_subjects: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          notes: string | null
          subject_id: string
          subject_type: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          notes?: string | null
          subject_id: string
          subject_type: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          subject_id?: string
          subject_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_subjects_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          contract_number: string
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at: string
          created_by: string | null
          currency: string
          end_date: string | null
          id: string
          notes: string | null
          signed_date: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["contract_status"]
          title: string | null
          updated_at: string
        }
        Insert: {
          contract_number: string
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          created_by?: string | null
          currency?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          signed_date?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          contract_number?: string
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          created_by?: string | null
          currency?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          signed_date?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          doc_type: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size_bytes: number
          id: string
          mime_type: string
          notes: string | null
          storage_path: string
          title: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          doc_type?: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size_bytes: number
          id?: string
          mime_type: string
          notes?: string | null
          storage_path: string
          title?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_size_bytes?: number
          id?: string
          mime_type?: string
          notes?: string | null
          storage_path?: string
          title?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      lead_events: {
        Row: {
          actor_id: string | null
          created_at: string
          description: string | null
          event_type: string
          from_value: string | null
          id: string
          lead_id: string
          to_value: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          description?: string | null
          event_type: string
          from_value?: string | null
          id?: string
          lead_id: string
          to_value?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          description?: string | null
          event_type?: string
          from_value?: string | null
          id?: string
          lead_id?: string
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assignee_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          estimated_annual_fee: number | null
          hold_reason: string | null
          hold_since: string | null
          id: string
          lead_number: string
          lost_at: string | null
          lost_reason: string | null
          lost_reason_notes: string | null
          notes: string | null
          portfolio_description: string | null
          pre_hold_status: string | null
          primary_contact_id: string
          probability_percent: number | null
          property_count_estimated: number | null
          proposed_duration_months: number | null
          proposed_fee_applies_to: string | null
          proposed_fee_model: string | null
          proposed_fee_value: number | null
          proposed_scope_of_services: Json
          proposed_terms_notes: string | null
          source: string
          source_details: string | null
          stage_entered_at: string
          status: string
          target_close_date: string | null
          updated_at: string
          won_at: string | null
        }
        Insert: {
          assignee_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          estimated_annual_fee?: number | null
          hold_reason?: string | null
          hold_since?: string | null
          id?: string
          lead_number: string
          lost_at?: string | null
          lost_reason?: string | null
          lost_reason_notes?: string | null
          notes?: string | null
          portfolio_description?: string | null
          pre_hold_status?: string | null
          primary_contact_id: string
          probability_percent?: number | null
          property_count_estimated?: number | null
          proposed_duration_months?: number | null
          proposed_fee_applies_to?: string | null
          proposed_fee_model?: string | null
          proposed_fee_value?: number | null
          proposed_scope_of_services?: Json
          proposed_terms_notes?: string | null
          source?: string
          source_details?: string | null
          stage_entered_at?: string
          status?: string
          target_close_date?: string | null
          updated_at?: string
          won_at?: string | null
        }
        Update: {
          assignee_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          estimated_annual_fee?: number | null
          hold_reason?: string | null
          hold_since?: string | null
          id?: string
          lead_number?: string
          lost_at?: string | null
          lost_reason?: string | null
          lost_reason_notes?: string | null
          notes?: string | null
          portfolio_description?: string | null
          pre_hold_status?: string | null
          primary_contact_id?: string
          probability_percent?: number | null
          property_count_estimated?: number | null
          proposed_duration_months?: number | null
          proposed_fee_applies_to?: string | null
          proposed_fee_model?: string | null
          proposed_fee_value?: number | null
          proposed_scope_of_services?: Json
          proposed_terms_notes?: string | null
          source?: string
          source_details?: string | null
          stage_entered_at?: string
          status?: string
          target_close_date?: string | null
          updated_at?: string
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      leases: {
        Row: {
          auto_renew: boolean
          commission_amount: number | null
          commission_paid_by: string | null
          contract_id: string
          created_at: string
          early_termination_penalty: string | null
          ejari_number: string | null
          ejari_registered_date: string | null
          grace_period_days: number | null
          number_of_cheques: number | null
          payment_method: string | null
          payment_notes: string | null
          renewal_notice_days: number | null
          rent_amount: number
          rent_free_days: number | null
          rent_frequency: string
          scope_notes: string | null
          security_deposit: number | null
          security_deposit_held_by: string | null
          termination_notice_days: number | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          auto_renew?: boolean
          commission_amount?: number | null
          commission_paid_by?: string | null
          contract_id: string
          created_at?: string
          early_termination_penalty?: string | null
          ejari_number?: string | null
          ejari_registered_date?: string | null
          grace_period_days?: number | null
          number_of_cheques?: number | null
          payment_method?: string | null
          payment_notes?: string | null
          renewal_notice_days?: number | null
          rent_amount: number
          rent_free_days?: number | null
          rent_frequency?: string
          scope_notes?: string | null
          security_deposit?: number | null
          security_deposit_held_by?: string | null
          termination_notice_days?: number | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          auto_renew?: boolean
          commission_amount?: number | null
          commission_paid_by?: string | null
          contract_id?: string
          created_at?: string
          early_termination_penalty?: string | null
          ejari_number?: string | null
          ejari_registered_date?: string | null
          grace_period_days?: number | null
          number_of_cheques?: number | null
          payment_method?: string | null
          payment_notes?: string | null
          renewal_notice_days?: number | null
          rent_amount?: number
          rent_free_days?: number | null
          rent_frequency?: string
          scope_notes?: string | null
          security_deposit?: number | null
          security_deposit_held_by?: string | null
          termination_notice_days?: number | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leases_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: true
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_with_data_gaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_without_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      management_agreements: {
        Row: {
          approval_rule: Database["public"]["Enums"]["ma_approval_rule"]
          approval_threshold_amount: number | null
          approval_threshold_currency: string | null
          auto_renew: boolean
          contract_id: string
          created_at: string
          fee_flat_annual: number | null
          fee_flat_per_unit: number | null
          fee_model: Database["public"]["Enums"]["ma_fee_model"]
          fee_notes: string | null
          fee_percent: number | null
          included_services: Json
          lease_up_fee_model: string | null
          lease_up_fee_value: number | null
          renewal_notice_days: number | null
          repair_authorization_terms: string | null
          scope_notes: string | null
          termination_notice_days: number | null
          updated_at: string
        }
        Insert: {
          approval_rule?: Database["public"]["Enums"]["ma_approval_rule"]
          approval_threshold_amount?: number | null
          approval_threshold_currency?: string | null
          auto_renew?: boolean
          contract_id: string
          created_at?: string
          fee_flat_annual?: number | null
          fee_flat_per_unit?: number | null
          fee_model?: Database["public"]["Enums"]["ma_fee_model"]
          fee_notes?: string | null
          fee_percent?: number | null
          included_services?: Json
          lease_up_fee_model?: string | null
          lease_up_fee_value?: number | null
          renewal_notice_days?: number | null
          repair_authorization_terms?: string | null
          scope_notes?: string | null
          termination_notice_days?: number | null
          updated_at?: string
        }
        Update: {
          approval_rule?: Database["public"]["Enums"]["ma_approval_rule"]
          approval_threshold_amount?: number | null
          approval_threshold_currency?: string | null
          auto_renew?: boolean
          contract_id?: string
          created_at?: string
          fee_flat_annual?: number | null
          fee_flat_per_unit?: number | null
          fee_model?: Database["public"]["Enums"]["ma_fee_model"]
          fee_notes?: string | null
          fee_percent?: number | null
          included_services?: Json
          lease_up_fee_model?: string | null
          lease_up_fee_value?: number | null
          renewal_notice_days?: number | null
          repair_authorization_terms?: string | null
          scope_notes?: string | null
          termination_notice_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "management_agreements_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: true
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      number_sequences: {
        Row: {
          last_seq: number
          prefix: string
          updated_at: string
          year: number
        }
        Insert: {
          last_seq?: number
          prefix: string
          updated_at?: string
          year: number
        }
        Update: {
          last_seq?: number
          prefix?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      people: {
        Row: {
          address: string | null
          auth_user_id: string | null
          authorized_signatory_name: string | null
          authorized_signatory_title: string | null
          avatar_url: string | null
          city: string | null
          company: string | null
          country: string | null
          created_at: string
          created_by: string | null
          email: string | null
          first_name: string
          id: string
          is_active: boolean
          is_self: boolean
          last_name: string
          notes: string | null
          person_type: string
          phone: string | null
          primary_email: string | null
          ref_code: string
          registered_address: string | null
          roles: Database["public"]["Enums"]["person_role"][]
          trade_license_authority: string | null
          trade_license_number: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          auth_user_id?: string | null
          authorized_signatory_name?: string | null
          authorized_signatory_title?: string | null
          avatar_url?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name: string
          id?: string
          is_active?: boolean
          is_self?: boolean
          last_name: string
          notes?: string | null
          person_type?: string
          phone?: string | null
          primary_email?: string | null
          ref_code: string
          registered_address?: string | null
          roles?: Database["public"]["Enums"]["person_role"][]
          trade_license_authority?: string | null
          trade_license_number?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          auth_user_id?: string | null
          authorized_signatory_name?: string | null
          authorized_signatory_title?: string | null
          avatar_url?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string
          id?: string
          is_active?: boolean
          is_self?: boolean
          last_name?: string
          notes?: string | null
          person_type?: string
          phone?: string | null
          primary_email?: string | null
          ref_code?: string
          registered_address?: string | null
          roles?: Database["public"]["Enums"]["person_role"][]
          trade_license_authority?: string | null
          trade_license_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      people_documents: {
        Row: {
          category: string | null
          created_at: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          name: string
          person_id: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          name: string
          person_id: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          name?: string
          person_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_documents_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          caption: string | null
          created_at: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size_bytes: number
          id: string
          is_cover: boolean
          mime_type: string
          sort_order: number
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size_bytes: number
          id?: string
          is_cover?: boolean
          mime_type: string
          sort_order?: number
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_size_bytes?: number
          id?: string
          is_cover?: boolean
          mime_type?: string
          sort_order?: number
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      property_documents: {
        Row: {
          building_id: string | null
          category: string | null
          created_at: string
          file_path: string
          file_size: number | null
          id: string
          is_image: boolean
          mime_type: string | null
          name: string
          unit_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          building_id?: string | null
          category?: string | null
          created_at?: string
          file_path: string
          file_size?: number | null
          id?: string
          is_image?: boolean
          mime_type?: string | null
          name: string
          unit_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          building_id?: string | null
          category?: string | null
          created_at?: string
          file_path?: string
          file_size?: number | null
          id?: string
          is_image?: boolean
          mime_type?: string | null
          name?: string
          unit_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_documents_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_documents_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_documents_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_with_data_gaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_documents_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_without_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      property_owners: {
        Row: {
          acquired_on: string | null
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
          is_primary: boolean
          notes: string | null
          ownership_percentage: number
          person_id: string
          updated_at: string
        }
        Insert: {
          acquired_on?: string | null
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          ownership_percentage?: number
          person_id: string
          updated_at?: string
        }
        Update: {
          acquired_on?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          ownership_percentage?: number
          person_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_owners_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      property_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_status: Database["public"]["Enums"]["property_status"]
          note: string | null
          old_status: Database["public"]["Enums"]["property_status"] | null
          unit_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status: Database["public"]["Enums"]["property_status"]
          note?: string | null
          old_status?: Database["public"]["Enums"]["property_status"] | null
          unit_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["property_status"]
          note?: string | null
          old_status?: Database["public"]["Enums"]["property_status"] | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_status_history_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_status_history_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_with_data_gaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_status_history_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_without_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      service_catalog: {
        Row: {
          cadence: Database["public"]["Enums"]["service_cadence"]
          category: Database["public"]["Enums"]["service_category"]
          code: string
          created_at: string
          created_by: string | null
          default_billing: Database["public"]["Enums"]["service_billing"]
          default_delivery: Database["public"]["Enums"]["service_delivery"]
          description: string | null
          id: string
          is_active: boolean
          is_workflow: boolean
          name: string
          recurrence_interval_days: number | null
          typical_duration_days: number | null
          updated_at: string
          workflow_steps: Json
        }
        Insert: {
          cadence?: Database["public"]["Enums"]["service_cadence"]
          category?: Database["public"]["Enums"]["service_category"]
          code: string
          created_at?: string
          created_by?: string | null
          default_billing?: Database["public"]["Enums"]["service_billing"]
          default_delivery?: Database["public"]["Enums"]["service_delivery"]
          description?: string | null
          id?: string
          is_active?: boolean
          is_workflow?: boolean
          name: string
          recurrence_interval_days?: number | null
          typical_duration_days?: number | null
          updated_at?: string
          workflow_steps?: Json
        }
        Update: {
          cadence?: Database["public"]["Enums"]["service_cadence"]
          category?: Database["public"]["Enums"]["service_category"]
          code?: string
          created_at?: string
          created_by?: string | null
          default_billing?: Database["public"]["Enums"]["service_billing"]
          default_delivery?: Database["public"]["Enums"]["service_delivery"]
          description?: string | null
          id?: string
          is_active?: boolean
          is_workflow?: boolean
          name?: string
          recurrence_interval_days?: number | null
          typical_duration_days?: number | null
          updated_at?: string
          workflow_steps?: Json
        }
        Relationships: []
      }
      service_request_events: {
        Row: {
          actor_id: string | null
          created_at: string
          description: string | null
          event_type: string
          from_value: string | null
          id: string
          request_id: string
          step_id: string | null
          to_value: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          description?: string | null
          event_type: string
          from_value?: string | null
          id?: string
          request_id: string
          step_id?: string | null
          to_value?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          description?: string | null
          event_type?: string
          from_value?: string | null
          id?: string
          request_id?: string
          step_id?: string | null
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_events_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "service_request_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      service_request_steps: {
        Row: {
          approval_decided_at: string | null
          approval_decided_by: string | null
          approval_decision_notes: string | null
          approval_management_agreement_id: string | null
          approval_requested_at: string | null
          approval_required_reason: string | null
          approval_rule_snapshot: string | null
          approval_status: Database["public"]["Enums"]["service_request_approval_status"]
          approval_threshold_amount: number | null
          approval_threshold_currency: string | null
          assigned_person_id: string | null
          assigned_vendor_id: string | null
          billing: Database["public"]["Enums"]["service_billing"]
          blocks_next: boolean
          category: Database["public"]["Enums"]["service_category"]
          completed_at: string | null
          cost_estimate: number | null
          cost_final: number | null
          created_at: string
          delivery: Database["public"]["Enums"]["service_delivery"]
          id: string
          notes: string | null
          request_id: string
          scheduled_date: string | null
          sort_order: number
          status: Database["public"]["Enums"]["service_request_step_status"]
          step_key: string
          title: string
          typical_duration_days: number | null
          updated_at: string
        }
        Insert: {
          approval_decided_at?: string | null
          approval_decided_by?: string | null
          approval_decision_notes?: string | null
          approval_management_agreement_id?: string | null
          approval_requested_at?: string | null
          approval_required_reason?: string | null
          approval_rule_snapshot?: string | null
          approval_status?: Database["public"]["Enums"]["service_request_approval_status"]
          approval_threshold_amount?: number | null
          approval_threshold_currency?: string | null
          assigned_person_id?: string | null
          assigned_vendor_id?: string | null
          billing?: Database["public"]["Enums"]["service_billing"]
          blocks_next?: boolean
          category: Database["public"]["Enums"]["service_category"]
          completed_at?: string | null
          cost_estimate?: number | null
          cost_final?: number | null
          created_at?: string
          delivery?: Database["public"]["Enums"]["service_delivery"]
          id?: string
          notes?: string | null
          request_id: string
          scheduled_date?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["service_request_step_status"]
          step_key: string
          title: string
          typical_duration_days?: number | null
          updated_at?: string
        }
        Update: {
          approval_decided_at?: string | null
          approval_decided_by?: string | null
          approval_decision_notes?: string | null
          approval_management_agreement_id?: string | null
          approval_requested_at?: string | null
          approval_required_reason?: string | null
          approval_rule_snapshot?: string | null
          approval_status?: Database["public"]["Enums"]["service_request_approval_status"]
          approval_threshold_amount?: number | null
          approval_threshold_currency?: string | null
          assigned_person_id?: string | null
          assigned_vendor_id?: string | null
          billing?: Database["public"]["Enums"]["service_billing"]
          blocks_next?: boolean
          category?: Database["public"]["Enums"]["service_category"]
          completed_at?: string | null
          cost_estimate?: number | null
          cost_final?: number | null
          created_at?: string
          delivery?: Database["public"]["Enums"]["service_delivery"]
          id?: string
          notes?: string | null
          request_id?: string
          scheduled_date?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["service_request_step_status"]
          step_key?: string
          title?: string
          typical_duration_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_request_steps_approval_management_agreement_id_fkey"
            columns: ["approval_management_agreement_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_steps_assigned_person_id_fkey"
            columns: ["assigned_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_steps_assigned_vendor_id_fkey"
            columns: ["assigned_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_steps_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          approval_decided_at: string | null
          approval_decided_by: string | null
          approval_decision_notes: string | null
          approval_management_agreement_id: string | null
          approval_requested_at: string | null
          approval_required_reason: string | null
          approval_rule_snapshot: string | null
          approval_status: Database["public"]["Enums"]["service_request_approval_status"]
          approval_threshold_amount: number | null
          approval_threshold_currency: string | null
          assigned_person_id: string | null
          assigned_vendor_id: string | null
          billing: Database["public"]["Enums"]["service_billing"]
          catalog_id: string | null
          category: Database["public"]["Enums"]["service_category"]
          completed_at: string | null
          cost_estimate: number | null
          cost_final: number | null
          created_at: string
          created_by: string | null
          currency: string
          delivery: Database["public"]["Enums"]["service_delivery"]
          description: string | null
          id: string
          internal_notes: string | null
          is_workflow: boolean
          priority: Database["public"]["Enums"]["service_request_priority"]
          request_number: string
          requested_by_person_id: string | null
          scheduled_date: string | null
          source: string
          started_at: string | null
          status: Database["public"]["Enums"]["service_request_status"]
          target_id: string | null
          target_type: string
          title: string
          updated_at: string
        }
        Insert: {
          approval_decided_at?: string | null
          approval_decided_by?: string | null
          approval_decision_notes?: string | null
          approval_management_agreement_id?: string | null
          approval_requested_at?: string | null
          approval_required_reason?: string | null
          approval_rule_snapshot?: string | null
          approval_status?: Database["public"]["Enums"]["service_request_approval_status"]
          approval_threshold_amount?: number | null
          approval_threshold_currency?: string | null
          assigned_person_id?: string | null
          assigned_vendor_id?: string | null
          billing?: Database["public"]["Enums"]["service_billing"]
          catalog_id?: string | null
          category: Database["public"]["Enums"]["service_category"]
          completed_at?: string | null
          cost_estimate?: number | null
          cost_final?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          delivery?: Database["public"]["Enums"]["service_delivery"]
          description?: string | null
          id?: string
          internal_notes?: string | null
          is_workflow?: boolean
          priority?: Database["public"]["Enums"]["service_request_priority"]
          request_number: string
          requested_by_person_id?: string | null
          scheduled_date?: string | null
          source?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["service_request_status"]
          target_id?: string | null
          target_type: string
          title: string
          updated_at?: string
        }
        Update: {
          approval_decided_at?: string | null
          approval_decided_by?: string | null
          approval_decision_notes?: string | null
          approval_management_agreement_id?: string | null
          approval_requested_at?: string | null
          approval_required_reason?: string | null
          approval_rule_snapshot?: string | null
          approval_status?: Database["public"]["Enums"]["service_request_approval_status"]
          approval_threshold_amount?: number | null
          approval_threshold_currency?: string | null
          assigned_person_id?: string | null
          assigned_vendor_id?: string | null
          billing?: Database["public"]["Enums"]["service_billing"]
          catalog_id?: string | null
          category?: Database["public"]["Enums"]["service_category"]
          completed_at?: string | null
          cost_estimate?: number | null
          cost_final?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          delivery?: Database["public"]["Enums"]["service_delivery"]
          description?: string | null
          id?: string
          internal_notes?: string | null
          is_workflow?: boolean
          priority?: Database["public"]["Enums"]["service_request_priority"]
          request_number?: string
          requested_by_person_id?: string | null
          scheduled_date?: string | null
          source?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["service_request_status"]
          target_id?: string | null
          target_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_approval_management_agreement_id_fkey"
            columns: ["approval_management_agreement_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_assigned_person_id_fkey"
            columns: ["assigned_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_assigned_vendor_id_fkey"
            columns: ["assigned_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_requested_by_person_id_fkey"
            columns: ["requested_by_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_status: Database["public"]["Enums"]["property_status"]
          old_status: Database["public"]["Enums"]["property_status"] | null
          reason: string | null
          unit_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status: Database["public"]["Enums"]["property_status"]
          old_status?: Database["public"]["Enums"]["property_status"] | null
          reason?: string | null
          unit_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["property_status"]
          old_status?: Database["public"]["Enums"]["property_status"] | null
          reason?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_status_history_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_status_history_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_with_data_gaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_status_history_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_without_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          asking_rent: number | null
          asking_rent_currency: string | null
          bathrooms: number | null
          bedrooms: number | null
          building_id: string
          created_at: string
          created_by: string | null
          description: string | null
          floor: number | null
          id: string
          listed_at: string | null
          listing_notes: string | null
          notes: string | null
          ref_code: string
          size_sqm: number | null
          size_unit_preference: string | null
          status: Database["public"]["Enums"]["property_status"]
          unit_number: string
          unit_type: Database["public"]["Enums"]["unit_type"]
          updated_at: string
        }
        Insert: {
          asking_rent?: number | null
          asking_rent_currency?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          building_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          floor?: number | null
          id?: string
          listed_at?: string | null
          listing_notes?: string | null
          notes?: string | null
          ref_code: string
          size_sqm?: number | null
          size_unit_preference?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          unit_number: string
          unit_type?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Update: {
          asking_rent?: number | null
          asking_rent_currency?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          building_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          floor?: number | null
          id?: string
          listed_at?: string | null
          listing_notes?: string | null
          notes?: string | null
          ref_code?: string
          size_sqm?: number | null
          size_unit_preference?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          unit_number?: string
          unit_type?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
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
      vendor_contacts: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          notes: string | null
          person_id: string
          role: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          person_id: string
          role?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          person_id?: string
          role?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_contacts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_contacts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_events: {
        Row: {
          actor_id: string | null
          created_at: string
          description: string | null
          event_type: string
          from_value: string | null
          id: string
          to_value: string | null
          vendor_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          description?: string | null
          event_type: string
          from_value?: string | null
          id?: string
          to_value?: string | null
          vendor_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          description?: string | null
          event_type?: string
          from_value?: string | null
          id?: string
          to_value?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_events_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_service_agreements: {
        Row: {
          auto_renew: boolean
          contract_id: string
          covered_services: Json
          created_at: string
          default_call_out_fee: number | null
          default_hourly_rate: number | null
          emergency_response_time_hours: number | null
          fixed_visit_fee: number | null
          is_exclusive: boolean
          materials_markup_percent: number | null
          payment_terms: Database["public"]["Enums"]["vsa_payment_terms"]
          payment_terms_custom: string | null
          rate_model: Database["public"]["Enums"]["vsa_rate_model"]
          rate_notes: string | null
          renewal_notice_days: number | null
          repair_authorization_currency: string | null
          repair_authorization_terms: string | null
          repair_authorization_threshold: number | null
          resolution_time_hours: number | null
          response_time_hours: number | null
          scope_notes: string | null
          service_area_notes: string | null
          sla_notes: string | null
          termination_notice_days: number | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          auto_renew?: boolean
          contract_id: string
          covered_services?: Json
          created_at?: string
          default_call_out_fee?: number | null
          default_hourly_rate?: number | null
          emergency_response_time_hours?: number | null
          fixed_visit_fee?: number | null
          is_exclusive?: boolean
          materials_markup_percent?: number | null
          payment_terms?: Database["public"]["Enums"]["vsa_payment_terms"]
          payment_terms_custom?: string | null
          rate_model?: Database["public"]["Enums"]["vsa_rate_model"]
          rate_notes?: string | null
          renewal_notice_days?: number | null
          repair_authorization_currency?: string | null
          repair_authorization_terms?: string | null
          repair_authorization_threshold?: number | null
          resolution_time_hours?: number | null
          response_time_hours?: number | null
          scope_notes?: string | null
          service_area_notes?: string | null
          sla_notes?: string | null
          termination_notice_days?: number | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          auto_renew?: boolean
          contract_id?: string
          covered_services?: Json
          created_at?: string
          default_call_out_fee?: number | null
          default_hourly_rate?: number | null
          emergency_response_time_hours?: number | null
          fixed_visit_fee?: number | null
          is_exclusive?: boolean
          materials_markup_percent?: number | null
          payment_terms?: Database["public"]["Enums"]["vsa_payment_terms"]
          payment_terms_custom?: string | null
          rate_model?: Database["public"]["Enums"]["vsa_rate_model"]
          rate_notes?: string | null
          renewal_notice_days?: number | null
          repair_authorization_currency?: string | null
          repair_authorization_terms?: string | null
          repair_authorization_threshold?: number | null
          resolution_time_hours?: number | null
          response_time_hours?: number | null
          scope_notes?: string | null
          service_area_notes?: string | null
          sla_notes?: string | null
          termination_notice_days?: number | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_service_agreements_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: true
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_service_agreements_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          blacklist_reason: string | null
          created_at: string
          created_by: string | null
          currency: string
          default_call_out_fee: number | null
          default_hourly_rate: number | null
          display_name: string | null
          id: string
          insurance_coverage_notes: string | null
          insurance_expiry_date: string | null
          insurance_policy_number: string | null
          insurance_provider: string | null
          is_preferred: boolean
          legal_name: string
          notes: string | null
          onboarded_at: string | null
          onboarded_by: string | null
          primary_email: string | null
          primary_phone: string | null
          rate_notes: string | null
          service_area_notes: string | null
          specialties: Json
          specialties_other: string | null
          status: string
          trade_license_authority: string | null
          trade_license_expiry_date: string | null
          trade_license_number: string | null
          trn: string | null
          updated_at: string
          vendor_number: string
          vendor_type: string
          website: string | null
        }
        Insert: {
          address?: string | null
          blacklist_reason?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          default_call_out_fee?: number | null
          default_hourly_rate?: number | null
          display_name?: string | null
          id?: string
          insurance_coverage_notes?: string | null
          insurance_expiry_date?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          is_preferred?: boolean
          legal_name: string
          notes?: string | null
          onboarded_at?: string | null
          onboarded_by?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          rate_notes?: string | null
          service_area_notes?: string | null
          specialties?: Json
          specialties_other?: string | null
          status?: string
          trade_license_authority?: string | null
          trade_license_expiry_date?: string | null
          trade_license_number?: string | null
          trn?: string | null
          updated_at?: string
          vendor_number: string
          vendor_type: string
          website?: string | null
        }
        Update: {
          address?: string | null
          blacklist_reason?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          default_call_out_fee?: number | null
          default_hourly_rate?: number | null
          display_name?: string | null
          id?: string
          insurance_coverage_notes?: string | null
          insurance_expiry_date?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          is_preferred?: boolean
          legal_name?: string
          notes?: string | null
          onboarded_at?: string | null
          onboarded_by?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          rate_notes?: string | null
          service_area_notes?: string | null
          specialties?: Json
          specialties_other?: string | null
          status?: string
          trade_license_authority?: string | null
          trade_license_expiry_date?: string | null
          trade_license_number?: string | null
          trn?: string | null
          updated_at?: string
          vendor_number?: string
          vendor_type?: string
          website?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      units_with_data_gaps: {
        Row: {
          asking_rent: number | null
          asking_rent_currency: string | null
          bathrooms: number | null
          bedrooms: number | null
          building_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          floor: number | null
          id: string | null
          listed_at: string | null
          listing_notes: string | null
          notes: string | null
          ref_code: string | null
          size_sqm: number | null
          size_unit_preference: string | null
          status: Database["public"]["Enums"]["property_status"] | null
          unit_number: string | null
          unit_type: Database["public"]["Enums"]["unit_type"] | null
          updated_at: string | null
        }
        Insert: {
          asking_rent?: number | null
          asking_rent_currency?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          building_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          floor?: number | null
          id?: string | null
          listed_at?: string | null
          listing_notes?: string | null
          notes?: string | null
          ref_code?: string | null
          size_sqm?: number | null
          size_unit_preference?: string | null
          status?: Database["public"]["Enums"]["property_status"] | null
          unit_number?: string | null
          unit_type?: Database["public"]["Enums"]["unit_type"] | null
          updated_at?: string | null
        }
        Update: {
          asking_rent?: number | null
          asking_rent_currency?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          building_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          floor?: number | null
          id?: string | null
          listed_at?: string | null
          listing_notes?: string | null
          notes?: string | null
          ref_code?: string | null
          size_sqm?: number | null
          size_unit_preference?: string | null
          status?: Database["public"]["Enums"]["property_status"] | null
          unit_number?: string | null
          unit_type?: Database["public"]["Enums"]["unit_type"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      units_without_owners: {
        Row: {
          asking_rent: number | null
          asking_rent_currency: string | null
          bathrooms: number | null
          bedrooms: number | null
          building_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          floor: number | null
          id: string | null
          listed_at: string | null
          listing_notes: string | null
          notes: string | null
          ref_code: string | null
          size_sqm: number | null
          size_unit_preference: string | null
          status: Database["public"]["Enums"]["property_status"] | null
          unit_number: string | null
          unit_type: Database["public"]["Enums"]["unit_type"] | null
          updated_at: string | null
        }
        Insert: {
          asking_rent?: number | null
          asking_rent_currency?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          building_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          floor?: number | null
          id?: string | null
          listed_at?: string | null
          listing_notes?: string | null
          notes?: string | null
          ref_code?: string | null
          size_sqm?: number | null
          size_unit_preference?: string | null
          status?: Database["public"]["Enums"]["property_status"] | null
          unit_number?: string | null
          unit_type?: Database["public"]["Enums"]["unit_type"] | null
          updated_at?: string | null
        }
        Update: {
          asking_rent?: number | null
          asking_rent_currency?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          building_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          floor?: number | null
          id?: string | null
          listed_at?: string | null
          listing_notes?: string | null
          notes?: string | null
          ref_code?: string | null
          size_sqm?: number | null
          size_unit_preference?: string | null
          status?: Database["public"]["Enums"]["property_status"] | null
          unit_number?: string | null
          unit_type?: Database["public"]["Enums"]["unit_type"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_service_request_step: {
        Args: {
          p_billing?: Database["public"]["Enums"]["service_billing"]
          p_blocks_next?: boolean
          p_category: Database["public"]["Enums"]["service_category"]
          p_cost_estimate?: number
          p_delivery?: Database["public"]["Enums"]["service_delivery"]
          p_request_id: string
          p_title: string
          p_typical_duration_days?: number
        }
        Returns: string
      }
      advance_ticket_stage: {
        Args: { p_ticket_id: string }
        Returns: undefined
      }
      change_ticket_workflow: {
        Args: {
          p_new_stages: Json
          p_new_workflow_key: string
          p_preserved_step_keys?: string[]
          p_ticket_id: string
        }
        Returns: undefined
      }
      complete_ticket_step: {
        Args: {
          p_note?: string
          p_stage_key: string
          p_step_key: string
          p_ticket_id: string
        }
        Returns: undefined
      }
      create_service_request_from_catalog: {
        Args: {
          p_assigned_person_id?: string
          p_assigned_vendor_id?: string
          p_catalog_id: string
          p_cost_estimate?: number
          p_description?: string
          p_internal_notes?: string
          p_override_title?: string
          p_priority?: Database["public"]["Enums"]["service_request_priority"]
          p_requested_by_person_id?: string
          p_scheduled_date?: string
          p_source?: string
          p_target_id: string
          p_target_type: string
        }
        Returns: string
      }
      current_user_person_id: { Args: never; Returns: string }
      decide_service_request_approval: {
        Args: { p_decision: string; p_notes?: string; p_request_id: string }
        Returns: Database["public"]["Enums"]["service_request_approval_status"]
      }
      decide_service_request_step_approval: {
        Args: { p_decision: string; p_notes?: string; p_step_id: string }
        Returns: Database["public"]["Enums"]["service_request_approval_status"]
      }
      evaluate_service_request_approval: {
        Args: { p_request_id: string }
        Returns: Database["public"]["Enums"]["service_request_approval_status"]
      }
      evaluate_service_request_step_approval: {
        Args: { p_step_id: string }
        Returns: Database["public"]["Enums"]["service_request_approval_status"]
      }
      find_applicable_management_agreement: {
        Args: { p_target_id: string; p_target_type: string }
        Returns: string
      }
      get_applicable_repair_threshold: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: number
      }
      get_management_dashboard: { Args: never; Returns: Json }
      get_operations_dashboard: { Args: never; Returns: Json }
      get_request_rollup: { Args: { p_request_id: string }; Returns: Json }
      get_ticket_workflow_summary: {
        Args: { p_ticket_id: string }
        Returns: Json
      }
      has_active_mgmt_agreement_for_unit: {
        Args: { p_unit_id: string }
        Returns: boolean
      }
      has_active_service_agreement_for_vendor_and_unit: {
        Args: { p_unit_id: string; p_vendor_id: string }
        Returns: boolean
      }
      has_active_vsa_for_vendor_and_service: {
        Args: { p_catalog_code: string; p_vendor_id: string }
        Returns: boolean
      }
      has_any_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      initialize_ticket_workflow: {
        Args: { p_stages: Json; p_ticket_id: string; p_workflow_key: string }
        Returns: undefined
      }
      list_auth_users_with_person: {
        Args: never
        Returns: {
          auth_user_id: string
          created_at: string
          email: string
          person_first_name: string
          person_id: string
          person_last_name: string
          person_ref_code: string
          person_roles: Database["public"]["Enums"]["person_role"][]
        }[]
      }
      next_number: {
        Args: { p_prefix: string; p_year: number }
        Returns: string
      }
      process_contract_lifecycle: { Args: never; Returns: Json }
      remove_ticket_workflow: {
        Args: { p_ticket_id: string }
        Returns: undefined
      }
      reorder_service_request_steps: {
        Args: { p_request_id: string; p_step_ids: string[] }
        Returns: undefined
      }
      reset_service_request_approval: {
        Args: { p_request_id: string }
        Returns: Database["public"]["Enums"]["service_request_approval_status"]
      }
      reset_service_request_step_approval: {
        Args: { p_step_id: string }
        Returns: Database["public"]["Enums"]["service_request_approval_status"]
      }
      resolve_ticket_target_label: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: string
      }
      resolve_unit_owners: {
        Args: { _unit_id: string }
        Returns: {
          is_primary: boolean
          ownership_percentage: number
          person_id: string
          source: string
        }[]
      }
      skip_ticket_stage: {
        Args: { p_reason: string; p_stage_key: string; p_ticket_id: string }
        Returns: undefined
      }
      skip_ticket_step: {
        Args: {
          p_reason: string
          p_stage_key: string
          p_step_key: string
          p_ticket_id: string
        }
        Returns: undefined
      }
      uncomplete_ticket_step: {
        Args: { p_stage_key: string; p_step_key: string; p_ticket_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "viewer"
      contract_party_role:
        | "pm_company"
        | "landlord"
        | "tenant"
        | "broker"
        | "guarantor"
        | "vendor"
      contract_status:
        | "draft"
        | "pending_signature"
        | "active"
        | "expired"
        | "terminated"
        | "cancelled"
      contract_type:
        | "management_agreement"
        | "lease"
        | "vendor_service_agreement"
      ma_approval_rule: "auto_threshold" | "always_required" | "auto_all"
      ma_fee_model:
        | "percent_of_rent"
        | "flat_annual"
        | "flat_per_unit"
        | "hybrid"
      person_role: "tenant" | "owner" | "prospect" | "staff" | "vendor"
      property_status:
        | "vacant"
        | "occupied"
        | "maintenance"
        | "off_market"
        | "under_maintenance"
        | "reserved"
      service_billing: "free" | "paid" | "pass_through"
      service_cadence:
        | "one_off"
        | "weekly"
        | "monthly"
        | "quarterly"
        | "biannual"
        | "annual"
        | "custom"
      service_category:
        | "maintenance"
        | "inspection"
        | "tenant_lifecycle"
        | "leasing"
        | "compliance"
        | "cleaning"
        | "utilities"
        | "administrative"
        | "other"
      service_delivery: "vendor" | "staff" | "either"
      service_request_approval_status:
        | "not_required"
        | "pending"
        | "approved"
        | "rejected"
      service_request_priority: "low" | "normal" | "high" | "urgent"
      service_request_status:
        | "open"
        | "scheduled"
        | "in_progress"
        | "blocked"
        | "completed"
        | "cancelled"
      service_request_step_status:
        | "pending"
        | "in_progress"
        | "blocked"
        | "completed"
        | "skipped"
      unit_type:
        | "studio"
        | "apartment"
        | "house"
        | "office"
        | "retail"
        | "storage"
        | "other"
        | "penthouse"
        | "duplex"
        | "villa"
        | "townhouse"
        | "warehouse"
        | "showroom"
      vsa_payment_terms:
        | "on_completion"
        | "net_7"
        | "net_15"
        | "net_30"
        | "net_60"
        | "monthly_invoice"
        | "custom"
      vsa_rate_model:
        | "per_call_out"
        | "per_hour"
        | "fixed_per_visit"
        | "quote_required"
        | "hybrid"
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
      app_role: ["admin", "staff", "viewer"],
      contract_party_role: [
        "pm_company",
        "landlord",
        "tenant",
        "broker",
        "guarantor",
        "vendor",
      ],
      contract_status: [
        "draft",
        "pending_signature",
        "active",
        "expired",
        "terminated",
        "cancelled",
      ],
      contract_type: [
        "management_agreement",
        "lease",
        "vendor_service_agreement",
      ],
      ma_approval_rule: ["auto_threshold", "always_required", "auto_all"],
      ma_fee_model: [
        "percent_of_rent",
        "flat_annual",
        "flat_per_unit",
        "hybrid",
      ],
      person_role: ["tenant", "owner", "prospect", "staff", "vendor"],
      property_status: [
        "vacant",
        "occupied",
        "maintenance",
        "off_market",
        "under_maintenance",
        "reserved",
      ],
      service_billing: ["free", "paid", "pass_through"],
      service_cadence: [
        "one_off",
        "weekly",
        "monthly",
        "quarterly",
        "biannual",
        "annual",
        "custom",
      ],
      service_category: [
        "maintenance",
        "inspection",
        "tenant_lifecycle",
        "leasing",
        "compliance",
        "cleaning",
        "utilities",
        "administrative",
        "other",
      ],
      service_delivery: ["vendor", "staff", "either"],
      service_request_approval_status: [
        "not_required",
        "pending",
        "approved",
        "rejected",
      ],
      service_request_priority: ["low", "normal", "high", "urgent"],
      service_request_status: [
        "open",
        "scheduled",
        "in_progress",
        "blocked",
        "completed",
        "cancelled",
      ],
      service_request_step_status: [
        "pending",
        "in_progress",
        "blocked",
        "completed",
        "skipped",
      ],
      unit_type: [
        "studio",
        "apartment",
        "house",
        "office",
        "retail",
        "storage",
        "other",
        "penthouse",
        "duplex",
        "villa",
        "townhouse",
        "warehouse",
        "showroom",
      ],
      vsa_payment_terms: [
        "on_completion",
        "net_7",
        "net_15",
        "net_30",
        "net_60",
        "monthly_invoice",
        "custom",
      ],
      vsa_rate_model: [
        "per_call_out",
        "per_hour",
        "fixed_per_visit",
        "quote_required",
        "hybrid",
      ],
    },
  },
} as const
