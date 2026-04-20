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
          is_signatory: boolean
          person_id: string
          role: string
          signature_reference: string | null
          signed_at: string | null
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          is_signatory?: boolean
          person_id: string
          role: string
          signature_reference?: string | null
          signed_at?: string | null
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          is_signatory?: boolean
          person_id?: string
          role?: string
          signature_reference?: string | null
          signed_at?: string | null
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
          entity_id: string
          entity_type: string
          id: string
          role: string | null
        }
        Insert: {
          contract_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          role?: string | null
        }
        Update: {
          contract_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          role?: string | null
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
          auto_renew: boolean
          contract_number: string
          contract_type: string
          created_at: string
          created_by: string | null
          currency: string
          end_date: string | null
          external_reference: string | null
          id: string
          notes: string | null
          parent_contract_id: string | null
          start_date: string | null
          status: string
          terminated_at: string | null
          terminated_reason: string | null
          title: string
          total_value: number | null
          updated_at: string
        }
        Insert: {
          auto_renew?: boolean
          contract_number: string
          contract_type: string
          created_at?: string
          created_by?: string | null
          currency?: string
          end_date?: string | null
          external_reference?: string | null
          id?: string
          notes?: string | null
          parent_contract_id?: string | null
          start_date?: string | null
          status?: string
          terminated_at?: string | null
          terminated_reason?: string | null
          title: string
          total_value?: number | null
          updated_at?: string
        }
        Update: {
          auto_renew?: boolean
          contract_number?: string
          contract_type?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          end_date?: string | null
          external_reference?: string | null
          id?: string
          notes?: string | null
          parent_contract_id?: string | null
          start_date?: string | null
          status?: string
          terminated_at?: string | null
          terminated_reason?: string | null
          title?: string
          total_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_parent_contract_id_fkey"
            columns: ["parent_contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
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
      lease_cheques: {
        Row: {
          amount: number
          bank_name: string | null
          bounce_reason: string | null
          bounced_on: string | null
          cheque_number: string | null
          cleared_on: string | null
          created_at: string
          deposited_on: string | null
          due_date: string
          id: string
          lease_id: string
          notes: string | null
          replacement_cheque_id: string | null
          sequence_number: number
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          bank_name?: string | null
          bounce_reason?: string | null
          bounced_on?: string | null
          cheque_number?: string | null
          cleared_on?: string | null
          created_at?: string
          deposited_on?: string | null
          due_date: string
          id?: string
          lease_id: string
          notes?: string | null
          replacement_cheque_id?: string | null
          sequence_number: number
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_name?: string | null
          bounce_reason?: string | null
          bounced_on?: string | null
          cheque_number?: string | null
          cleared_on?: string | null
          created_at?: string
          deposited_on?: string | null
          due_date?: string
          id?: string
          lease_id?: string
          notes?: string | null
          replacement_cheque_id?: string | null
          sequence_number?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lease_cheques_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_cheques_replacement_cheque_id_fkey"
            columns: ["replacement_cheque_id"]
            isOneToOne: false
            referencedRelation: "lease_cheques"
            referencedColumns: ["id"]
          },
        ]
      }
      leases: {
        Row: {
          annual_rent: number
          commission_amount: number | null
          commission_payer: string | null
          commission_status: string | null
          contract_id: string
          created_at: string
          ejari_number: string | null
          first_cheque_date: string | null
          id: string
          payment_frequency: string
          security_deposit_amount: number | null
          security_deposit_notes: string | null
          security_deposit_status: string | null
          updated_at: string
        }
        Insert: {
          annual_rent: number
          commission_amount?: number | null
          commission_payer?: string | null
          commission_status?: string | null
          contract_id: string
          created_at?: string
          ejari_number?: string | null
          first_cheque_date?: string | null
          id?: string
          payment_frequency: string
          security_deposit_amount?: number | null
          security_deposit_notes?: string | null
          security_deposit_status?: string | null
          updated_at?: string
        }
        Update: {
          annual_rent?: number
          commission_amount?: number | null
          commission_payer?: string | null
          commission_status?: string | null
          contract_id?: string
          created_at?: string
          ejari_number?: string | null
          first_cheque_date?: string | null
          id?: string
          payment_frequency?: string
          security_deposit_amount?: number | null
          security_deposit_notes?: string | null
          security_deposit_status?: string | null
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
        ]
      }
      management_agreements: {
        Row: {
          contract_id: string
          created_at: string
          fee_applies_to: string | null
          fee_model: string
          fee_value: number
          hybrid_base_flat: number | null
          hybrid_overage_percentage: number | null
          hybrid_threshold: number | null
          id: string
          lease_up_fee_model: string | null
          lease_up_fee_value: number | null
          repair_approval_threshold: number | null
          scope_of_services: Json
          scope_of_services_other: string | null
          termination_notice_days: number | null
          updated_at: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          fee_applies_to?: string | null
          fee_model: string
          fee_value: number
          hybrid_base_flat?: number | null
          hybrid_overage_percentage?: number | null
          hybrid_threshold?: number | null
          id?: string
          lease_up_fee_model?: string | null
          lease_up_fee_value?: number | null
          repair_approval_threshold?: number | null
          scope_of_services?: Json
          scope_of_services_other?: string | null
          termination_notice_days?: number | null
          updated_at?: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          fee_applies_to?: string | null
          fee_model?: string
          fee_value?: number
          hybrid_base_flat?: number | null
          hybrid_overage_percentage?: number | null
          hybrid_threshold?: number | null
          id?: string
          lease_up_fee_model?: string | null
          lease_up_fee_value?: number | null
          repair_approval_threshold?: number | null
          scope_of_services?: Json
          scope_of_services_other?: string | null
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
      service_agreements: {
        Row: {
          call_out_fee: number | null
          contract_id: string
          created_at: string
          fee_model: string
          fee_value: number | null
          hourly_rate: number | null
          hybrid_base_monthly: number | null
          hybrid_mode: string | null
          hybrid_per_call_or_unit: number | null
          id: string
          materials_included: boolean
          materials_markup_percent: number | null
          materials_notes: string | null
          response_time_standard_hours: number | null
          response_time_urgent_hours: number | null
          scope_of_services: Json
          scope_of_services_other: string | null
          service_frequency: string
          sla_notes: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          call_out_fee?: number | null
          contract_id: string
          created_at?: string
          fee_model: string
          fee_value?: number | null
          hourly_rate?: number | null
          hybrid_base_monthly?: number | null
          hybrid_mode?: string | null
          hybrid_per_call_or_unit?: number | null
          id?: string
          materials_included?: boolean
          materials_markup_percent?: number | null
          materials_notes?: string | null
          response_time_standard_hours?: number | null
          response_time_urgent_hours?: number | null
          scope_of_services?: Json
          scope_of_services_other?: string | null
          service_frequency?: string
          sla_notes?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          call_out_fee?: number | null
          contract_id?: string
          created_at?: string
          fee_model?: string
          fee_value?: number | null
          hourly_rate?: number | null
          hybrid_base_monthly?: number | null
          hybrid_mode?: string | null
          hybrid_per_call_or_unit?: number | null
          id?: string
          materials_included?: boolean
          materials_markup_percent?: number | null
          materials_notes?: string | null
          response_time_standard_hours?: number | null
          response_time_urgent_hours?: number | null
          scope_of_services?: Json
          scope_of_services_other?: string | null
          service_frequency?: string
          sla_notes?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_agreements_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: true
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_agreements_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      service_schedule_events: {
        Row: {
          actor_id: string | null
          created_at: string
          description: string | null
          event_type: string
          from_value: string | null
          id: string
          schedule_id: string
          to_value: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          description?: string | null
          event_type: string
          from_value?: string | null
          id?: string
          schedule_id: string
          to_value?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          description?: string | null
          event_type?: string
          from_value?: string | null
          id?: string
          schedule_id?: string
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_schedule_events_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "service_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      service_schedules: {
        Row: {
          auto_assign_vendor: boolean
          auto_init_workflow: boolean
          created_at: string
          created_by: string | null
          default_priority: string
          default_ticket_type: string
          description: string | null
          end_date: string | null
          ended_at: string | null
          frequency: string
          id: string
          last_triggered_at: string | null
          last_triggered_ticket_id: string | null
          lead_time_days: number
          name: string
          next_due_date: string
          notes: string | null
          paused_at: string | null
          paused_reason: string | null
          service_agreement_id: string | null
          start_date: string
          status: string
          target_entity_id: string
          target_entity_type: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          auto_assign_vendor?: boolean
          auto_init_workflow?: boolean
          created_at?: string
          created_by?: string | null
          default_priority?: string
          default_ticket_type: string
          description?: string | null
          end_date?: string | null
          ended_at?: string | null
          frequency: string
          id?: string
          last_triggered_at?: string | null
          last_triggered_ticket_id?: string | null
          lead_time_days?: number
          name: string
          next_due_date: string
          notes?: string | null
          paused_at?: string | null
          paused_reason?: string | null
          service_agreement_id?: string | null
          start_date: string
          status?: string
          target_entity_id: string
          target_entity_type: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          auto_assign_vendor?: boolean
          auto_init_workflow?: boolean
          created_at?: string
          created_by?: string | null
          default_priority?: string
          default_ticket_type?: string
          description?: string | null
          end_date?: string | null
          ended_at?: string | null
          frequency?: string
          id?: string
          last_triggered_at?: string | null
          last_triggered_ticket_id?: string | null
          lead_time_days?: number
          name?: string
          next_due_date?: string
          notes?: string | null
          paused_at?: string | null
          paused_reason?: string | null
          service_agreement_id?: string | null
          start_date?: string
          status?: string
          target_entity_id?: string
          target_entity_type?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_schedules_service_agreement_id_fkey"
            columns: ["service_agreement_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_schedules_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_events: {
        Row: {
          actor_id: string | null
          created_at: string
          description: string | null
          event_type: string
          from_value: string | null
          id: string
          ticket_id: string
          to_value: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          description?: string | null
          event_type: string
          from_value?: string | null
          id?: string
          ticket_id: string
          to_value?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          description?: string | null
          event_type?: string
          from_value?: string | null
          id?: string
          ticket_id?: string
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_workflow_stages: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          order_index: number
          skipped_reason: string | null
          stage_key: string
          stage_label: string
          started_at: string | null
          status: string
          ticket_id: string
          updated_at: string
          workflow_key: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          order_index: number
          skipped_reason?: string | null
          stage_key: string
          stage_label: string
          started_at?: string | null
          status?: string
          ticket_id: string
          updated_at?: string
          workflow_key: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          order_index?: number
          skipped_reason?: string | null
          stage_key?: string
          stage_label?: string
          started_at?: string | null
          status?: string
          ticket_id?: string
          updated_at?: string
          workflow_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_workflow_stages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_workflow_steps: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          is_required: boolean
          note: string | null
          order_index: number
          stage_key: string
          status: string
          step_description: string | null
          step_key: string
          step_label: string
          ticket_id: string
          updated_at: string
          workflow_key: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          is_required?: boolean
          note?: string | null
          order_index: number
          stage_key: string
          status?: string
          step_description?: string | null
          step_key: string
          step_label: string
          ticket_id: string
          updated_at?: string
          workflow_key: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          is_required?: boolean
          note?: string | null
          order_index?: number
          stage_key?: string
          status?: string
          step_description?: string | null
          step_key?: string
          step_label?: string
          ticket_id?: string
          updated_at?: string
          workflow_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_workflow_steps_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          actual_cost: number | null
          assignee_id: string | null
          cancelled_at: string | null
          cancelled_reason: string | null
          closed_at: string | null
          cost_approval_notes: string | null
          cost_approval_status: string | null
          cost_approved_at: string | null
          cost_approved_by_person_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          current_stage_key: string | null
          description: string | null
          due_date: string | null
          estimated_cost: number | null
          generated_by_schedule_id: string | null
          id: string
          is_system_generated: boolean
          parent_ticket_id: string | null
          priority: string
          reporter_id: string | null
          resolved_at: string | null
          status: string
          subject: string
          system_dedup_key: string | null
          target_entity_id: string
          target_entity_type: string
          ticket_number: string
          ticket_type: string
          updated_at: string
          vendor_id: string | null
          waiting_on: string | null
          workflow_key: string | null
        }
        Insert: {
          actual_cost?: number | null
          assignee_id?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          closed_at?: string | null
          cost_approval_notes?: string | null
          cost_approval_status?: string | null
          cost_approved_at?: string | null
          cost_approved_by_person_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          current_stage_key?: string | null
          description?: string | null
          due_date?: string | null
          estimated_cost?: number | null
          generated_by_schedule_id?: string | null
          id?: string
          is_system_generated?: boolean
          parent_ticket_id?: string | null
          priority?: string
          reporter_id?: string | null
          resolved_at?: string | null
          status?: string
          subject: string
          system_dedup_key?: string | null
          target_entity_id: string
          target_entity_type: string
          ticket_number: string
          ticket_type: string
          updated_at?: string
          vendor_id?: string | null
          waiting_on?: string | null
          workflow_key?: string | null
        }
        Update: {
          actual_cost?: number | null
          assignee_id?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          closed_at?: string | null
          cost_approval_notes?: string | null
          cost_approval_status?: string | null
          cost_approved_at?: string | null
          cost_approved_by_person_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          current_stage_key?: string | null
          description?: string | null
          due_date?: string | null
          estimated_cost?: number | null
          generated_by_schedule_id?: string | null
          id?: string
          is_system_generated?: boolean
          parent_ticket_id?: string | null
          priority?: string
          reporter_id?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string
          system_dedup_key?: string | null
          target_entity_id?: string
          target_entity_type?: string
          ticket_number?: string
          ticket_type?: string
          updated_at?: string
          vendor_id?: string | null
          waiting_on?: string | null
          workflow_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_cost_approved_by_person_id_fkey"
            columns: ["cost_approved_by_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_generated_by_schedule_id_fkey"
            columns: ["generated_by_schedule_id"]
            isOneToOne: false
            referencedRelation: "service_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_parent_ticket_id_fkey"
            columns: ["parent_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
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
          bathrooms: number | null
          bedrooms: number | null
          building_id: string
          created_at: string
          created_by: string | null
          description: string | null
          floor: number | null
          id: string
          notes: string | null
          ref_code: string
          size_sqm: number | null
          size_unit_preference: string | null
          status: Database["public"]["Enums"]["property_status"]
          status_locked_by_lease_id: string | null
          unit_number: string
          unit_type: Database["public"]["Enums"]["unit_type"]
          updated_at: string
        }
        Insert: {
          bathrooms?: number | null
          bedrooms?: number | null
          building_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          floor?: number | null
          id?: string
          notes?: string | null
          ref_code: string
          size_sqm?: number | null
          size_unit_preference?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          status_locked_by_lease_id?: string | null
          unit_number: string
          unit_type?: Database["public"]["Enums"]["unit_type"]
          updated_at?: string
        }
        Update: {
          bathrooms?: number | null
          bedrooms?: number | null
          building_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          floor?: number | null
          id?: string
          notes?: string | null
          ref_code?: string
          size_sqm?: number | null
          size_unit_preference?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          status_locked_by_lease_id?: string | null
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
          bathrooms: number | null
          bedrooms: number | null
          building_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          floor: number | null
          id: string | null
          notes: string | null
          ref_code: string | null
          size_sqm: number | null
          size_unit_preference: string | null
          status: Database["public"]["Enums"]["property_status"] | null
          status_locked_by_lease_id: string | null
          unit_number: string | null
          unit_type: Database["public"]["Enums"]["unit_type"] | null
          updated_at: string | null
        }
        Insert: {
          bathrooms?: number | null
          bedrooms?: number | null
          building_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          floor?: number | null
          id?: string | null
          notes?: string | null
          ref_code?: string | null
          size_sqm?: number | null
          size_unit_preference?: string | null
          status?: Database["public"]["Enums"]["property_status"] | null
          status_locked_by_lease_id?: string | null
          unit_number?: string | null
          unit_type?: Database["public"]["Enums"]["unit_type"] | null
          updated_at?: string | null
        }
        Update: {
          bathrooms?: number | null
          bedrooms?: number | null
          building_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          floor?: number | null
          id?: string | null
          notes?: string | null
          ref_code?: string | null
          size_sqm?: number | null
          size_unit_preference?: string | null
          status?: Database["public"]["Enums"]["property_status"] | null
          status_locked_by_lease_id?: string | null
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
          bathrooms: number | null
          bedrooms: number | null
          building_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          floor: number | null
          id: string | null
          notes: string | null
          ref_code: string | null
          size_sqm: number | null
          size_unit_preference: string | null
          status: Database["public"]["Enums"]["property_status"] | null
          status_locked_by_lease_id: string | null
          unit_number: string | null
          unit_type: Database["public"]["Enums"]["unit_type"] | null
          updated_at: string | null
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
      get_applicable_repair_threshold: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: number
      }
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
      next_number: {
        Args: { p_prefix: string; p_year: number }
        Returns: string
      }
      process_contract_lifecycle: { Args: never; Returns: Json }
      remove_ticket_workflow: {
        Args: { p_ticket_id: string }
        Returns: undefined
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
      person_role: "tenant" | "owner" | "prospect" | "staff" | "vendor"
      property_status:
        | "vacant"
        | "occupied"
        | "maintenance"
        | "off_market"
        | "under_maintenance"
        | "reserved"
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
      person_role: ["tenant", "owner", "prospect", "staff", "vendor"],
      property_status: [
        "vacant",
        "occupied",
        "maintenance",
        "off_market",
        "under_maintenance",
        "reserved",
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
    },
  },
} as const
