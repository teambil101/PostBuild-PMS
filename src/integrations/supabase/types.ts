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
      accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          account_type: Database["public"]["Enums"]["account_type"]
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
          tool_calls: Json | null
          tool_results: Json | null
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          role: string
          session_id: string
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_sessions: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          contract_number_prefix: string
          created_at: string
          default_currency: string
          fiscal_year_start_month: number
          id: string
          self_person_id: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          contract_number_prefix?: string
          created_at?: string
          default_currency?: string
          fiscal_year_start_month?: number
          id?: string
          self_person_id?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          contract_number_prefix?: string
          created_at?: string
          default_currency?: string
          fiscal_year_start_month?: number
          id?: string
          self_person_id?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_self_person_id_fkey"
            columns: ["self_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_number_masked: string | null
          bank_name: string | null
          created_at: string
          currency: string
          gl_account_id: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          opening_balance: number
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          account_number_masked?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string
          gl_account_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          opening_balance?: number
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          account_number_masked?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string
          gl_account_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          opening_balance?: number
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_lines: {
        Row: {
          account_id: string | null
          amount: number
          bill_id: string
          created_at: string
          description: string
          id: string
          quantity: number
          sort_order: number
          unit_price: number
          workspace_id: string | null
        }
        Insert: {
          account_id?: string | null
          amount?: number
          bill_id: string
          created_at?: string
          description: string
          id?: string
          quantity?: number
          sort_order?: number
          unit_price?: number
          workspace_id?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          bill_id?: string
          created_at?: string
          description?: string
          id?: string
          quantity?: number
          sort_order?: number
          unit_price?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_lines_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_lines_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          amount_paid: number
          contract_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          due_date: string
          id: string
          issue_date: string
          notes: string | null
          number: string
          owner_statement_id: string | null
          party_person_id: string | null
          service_request_id: string | null
          status: Database["public"]["Enums"]["bill_status"]
          subtotal: number
          tax: number
          total: number
          updated_at: string
          vendor_id: string | null
          voided_at: string | null
          voided_reason: string | null
          vsa_contract_id: string | null
          workspace_id: string | null
        }
        Insert: {
          amount_paid?: number
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date: string
          id?: string
          issue_date?: string
          notes?: string | null
          number: string
          owner_statement_id?: string | null
          party_person_id?: string | null
          service_request_id?: string | null
          status?: Database["public"]["Enums"]["bill_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
          vendor_id?: string | null
          voided_at?: string | null
          voided_reason?: string | null
          vsa_contract_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          amount_paid?: number
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string
          owner_statement_id?: string | null
          party_person_id?: string | null
          service_request_id?: string | null
          status?: Database["public"]["Enums"]["bill_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
          vendor_id?: string | null
          voided_at?: string | null
          voided_reason?: string | null
          vsa_contract_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bills_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_owner_statement_fk"
            columns: ["owner_statement_id"]
            isOneToOne: false
            referencedRelation: "owner_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_party_person_id_fkey"
            columns: ["party_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_vsa_contract_id_fkey"
            columns: ["vsa_contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      buildings: {
        Row: {
          address: string | null
          building_type: string
          building_type_other: string | null
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
          workspace_id: string | null
        }
        Insert: {
          address?: string | null
          building_type?: string
          building_type_other?: string | null
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
          workspace_id?: string | null
        }
        Update: {
          address?: string | null
          building_type?: string
          building_type_other?: string | null
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
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buildings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string | null
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          person_id: string
          role: Database["public"]["Enums"]["contract_party_role"]
          workspace_id?: string | null
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          person_id?: string
          role?: Database["public"]["Enums"]["contract_party_role"]
          workspace_id?: string | null
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
          {
            foreignKeyName: "contract_parties_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string | null
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          notes?: string | null
          subject_id: string
          subject_type: string
          workspace_id?: string | null
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          subject_id?: string
          subject_type?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_subjects_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_subjects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          sort_order: number
          unit_price: number
          workspace_id: string | null
        }
        Insert: {
          account_id?: string | null
          amount?: number
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          sort_order?: number
          unit_price?: number
          workspace_id?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          sort_order?: number
          unit_price?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          bill_to_role: Database["public"]["Enums"]["bill_to_role"]
          contract_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          due_date: string
          id: string
          issue_date: string
          lease_contract_id: string | null
          notes: string | null
          number: string
          party_person_id: string | null
          service_request_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax: number
          total: number
          updated_at: string
          voided_at: string | null
          voided_reason: string | null
          workspace_id: string | null
        }
        Insert: {
          amount_paid?: number
          bill_to_role?: Database["public"]["Enums"]["bill_to_role"]
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date: string
          id?: string
          issue_date?: string
          lease_contract_id?: string | null
          notes?: string | null
          number: string
          party_person_id?: string | null
          service_request_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
          voided_at?: string | null
          voided_reason?: string | null
          workspace_id?: string | null
        }
        Update: {
          amount_paid?: number
          bill_to_role?: Database["public"]["Enums"]["bill_to_role"]
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string
          id?: string
          issue_date?: string
          lease_contract_id?: string | null
          notes?: string | null
          number?: string
          party_person_id?: string | null
          service_request_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
          voided_at?: string | null
          voided_reason?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_lease_contract_id_fkey"
            columns: ["lease_contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_party_person_id_fkey"
            columns: ["party_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          id: string
          is_reversal: boolean
          memo: string | null
          posted_at: string
          reverses_entry_id: string | null
          source_id: string
          source_type: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_reversal?: boolean
          memo?: string | null
          posted_at?: string
          reverses_entry_id?: string | null
          source_id: string
          source_type: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_reversal?: boolean
          memo?: string | null
          posted_at?: string
          reverses_entry_id?: string | null
          source_id?: string
          source_type?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_reverses_entry_id_fkey"
            columns: ["reverses_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          created_at: string
          credit: number
          debit: number
          entry_id: string
          id: string
          landlord_person_id: string | null
          memo: string | null
          party_person_id: string | null
          party_vendor_id: string | null
          sort_order: number
          workspace_id: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          credit?: number
          debit?: number
          entry_id: string
          id?: string
          landlord_person_id?: string | null
          memo?: string | null
          party_person_id?: string | null
          party_vendor_id?: string | null
          sort_order?: number
          workspace_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          credit?: number
          debit?: number
          entry_id?: string
          id?: string
          landlord_person_id?: string | null
          memo?: string | null
          party_person_id?: string | null
          party_vendor_id?: string | null
          sort_order?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_landlord_person_id_fkey"
            columns: ["landlord_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_party_person_id_fkey"
            columns: ["party_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_party_vendor_id_fkey"
            columns: ["party_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
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
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
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
          {
            foreignKeyName: "leases_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "management_agreements_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: true
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_agreements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string | null
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      owner_statement_lines: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          line_type: string
          sort_order: number
          source_id: string | null
          source_type: string | null
          statement_id: string
          workspace_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          id?: string
          line_type: string
          sort_order?: number
          source_id?: string | null
          source_type?: string | null
          statement_id: string
          workspace_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          line_type?: string
          sort_order?: number
          source_id?: string | null
          source_type?: string | null
          statement_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_statement_lines_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "owner_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_statement_lines_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_statements: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          expenses_total: number
          gross_rent: number
          id: string
          issued_at: string | null
          landlord_person_id: string | null
          ma_contract_id: string
          net_remittance: number
          notes: string | null
          number: string
          other_adjustments: number
          period_end: string
          period_start: string
          pm_fee: number
          remittance_bill_id: string | null
          status: Database["public"]["Enums"]["statement_status"]
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          expenses_total?: number
          gross_rent?: number
          id?: string
          issued_at?: string | null
          landlord_person_id?: string | null
          ma_contract_id: string
          net_remittance?: number
          notes?: string | null
          number: string
          other_adjustments?: number
          period_end: string
          period_start: string
          pm_fee?: number
          remittance_bill_id?: string | null
          status?: Database["public"]["Enums"]["statement_status"]
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          expenses_total?: number
          gross_rent?: number
          id?: string
          issued_at?: string | null
          landlord_person_id?: string | null
          ma_contract_id?: string
          net_remittance?: number
          notes?: string | null
          number?: string
          other_adjustments?: number
          period_end?: string
          period_start?: string
          pm_fee?: number
          remittance_bill_id?: string | null
          status?: Database["public"]["Enums"]["statement_status"]
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_statements_landlord_person_id_fkey"
            columns: ["landlord_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_statements_ma_contract_id_fkey"
            columns: ["ma_contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_statements_remittance_bill_id_fkey"
            columns: ["remittance_bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_statements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount: number
          bill_id: string | null
          created_at: string
          id: string
          invoice_id: string | null
          payment_id: string
          workspace_id: string | null
        }
        Insert: {
          amount: number
          bill_id?: string | null
          created_at?: string
          id?: string
          invoice_id?: string | null
          payment_id: string
          workspace_id?: string | null
        }
        Update: {
          amount?: number
          bill_id?: string | null
          created_at?: string
          id?: string
          invoice_id?: string | null
          payment_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          direction: Database["public"]["Enums"]["payment_direction"]
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          number: string
          paid_on: string
          party_person_id: string | null
          party_vendor_id: string | null
          reference: string | null
          updated_at: string
          voided_at: string | null
          voided_reason: string | null
          workspace_id: string | null
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          direction: Database["public"]["Enums"]["payment_direction"]
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          number: string
          paid_on?: string
          party_person_id?: string | null
          party_vendor_id?: string | null
          reference?: string | null
          updated_at?: string
          voided_at?: string | null
          voided_reason?: string | null
          workspace_id?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          direction?: Database["public"]["Enums"]["payment_direction"]
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          number?: string
          paid_on?: string
          party_person_id?: string | null
          party_vendor_id?: string | null
          reference?: string | null
          updated_at?: string
          voided_at?: string | null
          voided_reason?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_party_person_id_fkey"
            columns: ["party_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_party_vendor_id_fkey"
            columns: ["party_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_documents_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
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
          {
            foreignKeyName: "property_documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_owners_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owners_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status: Database["public"]["Enums"]["property_status"]
          note?: string | null
          old_status?: Database["public"]["Enums"]["property_status"] | null
          unit_id: string
          workspace_id?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["property_status"]
          note?: string | null
          old_status?: Database["public"]["Enums"]["property_status"] | null
          unit_id?: string
          workspace_id?: string | null
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
          {
            foreignKeyName: "property_status_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_lines: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          quantity: number
          quote_id: string
          sort_order: number
          unit_price: number
          workspace_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          id?: string
          quantity?: number
          quote_id: string
          sort_order?: number
          unit_price?: number
          workspace_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          quantity?: number
          quote_id?: string
          sort_order?: number
          unit_price?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_lines_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "vendor_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_invoice_schedules: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          generated_at: string | null
          id: string
          installment_number: number
          invoice_id: string | null
          lease_contract_id: string
          total_installments: number
          workspace_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          generated_at?: string | null
          id?: string
          installment_number: number
          invoice_id?: string | null
          lease_contract_id: string
          total_installments: number
          workspace_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          generated_at?: string | null
          id?: string
          installment_number?: number
          invoice_id?: string | null
          lease_contract_id?: string
          total_installments?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_invoice_schedules_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_invoice_schedules_lease_contract_id_fkey"
            columns: ["lease_contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_invoice_schedules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      service_catalog: {
        Row: {
          cadence: Database["public"]["Enums"]["service_cadence"]
          category: Database["public"]["Enums"]["service_category"]
          category_other: string | null
          code: string
          created_at: string
          created_by: string | null
          default_assignee_person_id: string | null
          default_assignee_vendor_id: string | null
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
          workspace_id: string | null
        }
        Insert: {
          cadence?: Database["public"]["Enums"]["service_cadence"]
          category?: Database["public"]["Enums"]["service_category"]
          category_other?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          default_assignee_person_id?: string | null
          default_assignee_vendor_id?: string | null
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
          workspace_id?: string | null
        }
        Update: {
          cadence?: Database["public"]["Enums"]["service_cadence"]
          category?: Database["public"]["Enums"]["service_category"]
          category_other?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          default_assignee_person_id?: string | null
          default_assignee_vendor_id?: string | null
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
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_catalog_default_assignee_person_id_fkey"
            columns: ["default_assignee_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_catalog_default_assignee_vendor_id_fkey"
            columns: ["default_assignee_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_catalog_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      service_feedback: {
        Row: {
          assigned_person_id: string | null
          assigned_vendor_id: string | null
          comment: string | null
          created_at: string
          id: string
          rating: number
          service_request_id: string
          submitted_at: string
          submitted_by_person_id: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          assigned_person_id?: string | null
          assigned_vendor_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          service_request_id: string
          submitted_at?: string
          submitted_by_person_id?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          assigned_person_id?: string | null
          assigned_vendor_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          service_request_id?: string
          submitted_at?: string
          submitted_by_person_id?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_feedback_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_feedback_submitted_by_person_id_fkey"
            columns: ["submitted_by_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_feedback_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
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
          {
            foreignKeyName: "service_request_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      service_request_quotes: {
        Row: {
          amount: number | null
          created_at: string
          currency: string
          decided_at: string | null
          eta_days: number | null
          expires_at: string
          id: string
          internal_notes: string | null
          invited_at: string
          invited_by: string | null
          request_id: string
          status: Database["public"]["Enums"]["service_quote_status"]
          submission_token: string
          submitted_at: string | null
          updated_at: string
          vendor_id: string
          vendor_notes: string | null
          workspace_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string
          decided_at?: string | null
          eta_days?: number | null
          expires_at?: string
          id?: string
          internal_notes?: string | null
          invited_at?: string
          invited_by?: string | null
          request_id: string
          status?: Database["public"]["Enums"]["service_quote_status"]
          submission_token?: string
          submitted_at?: string | null
          updated_at?: string
          vendor_id: string
          vendor_notes?: string | null
          workspace_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string
          decided_at?: string | null
          eta_days?: number | null
          expires_at?: string
          id?: string
          internal_notes?: string | null
          invited_at?: string
          invited_by?: string | null
          request_id?: string
          status?: Database["public"]["Enums"]["service_quote_status"]
          submission_token?: string
          submitted_at?: string | null
          updated_at?: string
          vendor_id?: string
          vendor_notes?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_request_quotes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_quotes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_quotes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          category_other: string | null
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
          workspace_id: string | null
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
          category_other?: string | null
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
          workspace_id?: string | null
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
          category_other?: string | null
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
          workspace_id?: string | null
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
          {
            foreignKeyName: "service_request_steps_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          bill_to: Database["public"]["Enums"]["bill_to_role"]
          billing: Database["public"]["Enums"]["service_billing"]
          catalog_id: string | null
          category: Database["public"]["Enums"]["service_category"]
          category_other: string | null
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
          proposed_scheduled_date: string | null
          request_number: string
          requested_by_person_id: string | null
          schedule_counter_round: number
          scheduled_date: string | null
          source: string
          started_at: string | null
          status: Database["public"]["Enums"]["service_request_status"]
          target_id: string | null
          target_type: string
          tenant_approval_decided_at: string | null
          tenant_approval_notes: string | null
          tenant_approval_reason: string | null
          tenant_approval_requested_at: string | null
          tenant_approval_required: boolean
          tenant_approval_status: Database["public"]["Enums"]["tenant_approval_status"]
          tenant_proposed_date: string | null
          tenant_schedule_decided_at: string | null
          tenant_schedule_notes: string | null
          tenant_schedule_status: Database["public"]["Enums"]["tenant_schedule_status"]
          tenant_token: string | null
          title: string
          updated_at: string
          workspace_id: string | null
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
          bill_to?: Database["public"]["Enums"]["bill_to_role"]
          billing?: Database["public"]["Enums"]["service_billing"]
          catalog_id?: string | null
          category: Database["public"]["Enums"]["service_category"]
          category_other?: string | null
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
          proposed_scheduled_date?: string | null
          request_number: string
          requested_by_person_id?: string | null
          schedule_counter_round?: number
          scheduled_date?: string | null
          source?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["service_request_status"]
          target_id?: string | null
          target_type: string
          tenant_approval_decided_at?: string | null
          tenant_approval_notes?: string | null
          tenant_approval_reason?: string | null
          tenant_approval_requested_at?: string | null
          tenant_approval_required?: boolean
          tenant_approval_status?: Database["public"]["Enums"]["tenant_approval_status"]
          tenant_proposed_date?: string | null
          tenant_schedule_decided_at?: string | null
          tenant_schedule_notes?: string | null
          tenant_schedule_status?: Database["public"]["Enums"]["tenant_schedule_status"]
          tenant_token?: string | null
          title: string
          updated_at?: string
          workspace_id?: string | null
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
          bill_to?: Database["public"]["Enums"]["bill_to_role"]
          billing?: Database["public"]["Enums"]["service_billing"]
          catalog_id?: string | null
          category?: Database["public"]["Enums"]["service_category"]
          category_other?: string | null
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
          proposed_scheduled_date?: string | null
          request_number?: string
          requested_by_person_id?: string | null
          schedule_counter_round?: number
          scheduled_date?: string | null
          source?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["service_request_status"]
          target_id?: string | null
          target_type?: string
          tenant_approval_decided_at?: string | null
          tenant_approval_notes?: string | null
          tenant_approval_reason?: string | null
          tenant_approval_requested_at?: string | null
          tenant_approval_required?: boolean
          tenant_approval_status?: Database["public"]["Enums"]["tenant_approval_status"]
          tenant_proposed_date?: string | null
          tenant_schedule_decided_at?: string | null
          tenant_schedule_notes?: string | null
          tenant_schedule_status?: Database["public"]["Enums"]["tenant_schedule_status"]
          tenant_token?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string | null
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
          {
            foreignKeyName: "service_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status: Database["public"]["Enums"]["property_status"]
          old_status?: Database["public"]["Enums"]["property_status"] | null
          reason?: string | null
          unit_id: string
          workspace_id?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["property_status"]
          old_status?: Database["public"]["Enums"]["property_status"] | null
          reason?: string | null
          unit_id?: string
          workspace_id?: string | null
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
          {
            foreignKeyName: "unit_status_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          role_other: string | null
          vendor_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          person_id: string
          role?: string
          role_other?: string | null
          vendor_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          person_id?: string
          role?: string
          role_other?: string | null
          vendor_id?: string
          workspace_id?: string | null
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
          {
            foreignKeyName: "vendor_contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_events_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_quotes: {
        Row: {
          accepted_bill_id: string | null
          created_at: string
          currency: string
          decided_at: string | null
          decided_by: string | null
          id: string
          notes: string | null
          number: string
          service_request_id: string | null
          service_request_step_id: string | null
          status: Database["public"]["Enums"]["quote_status"]
          submitted_at: string
          subtotal: number
          tax: number
          total: number
          updated_at: string
          valid_until: string | null
          vendor_id: string
        }
        Insert: {
          accepted_bill_id?: string | null
          created_at?: string
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          notes?: string | null
          number: string
          service_request_id?: string | null
          service_request_step_id?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          submitted_at?: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
          vendor_id: string
        }
        Update: {
          accepted_bill_id?: string | null
          created_at?: string
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          notes?: string | null
          number?: string
          service_request_id?: string | null
          service_request_step_id?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          submitted_at?: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_quotes_accepted_bill_id_fkey"
            columns: ["accepted_bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_quotes_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_quotes_service_request_step_id_fkey"
            columns: ["service_request_step_id"]
            isOneToOne: false
            referencedRelation: "service_request_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_quotes_vendor_id_fkey"
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
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
          {
            foreignKeyName: "vendor_service_agreements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          workspace_id: string | null
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
          workspace_id?: string | null
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
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["workspace_member_role"]
          token: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["workspace_member_role"]
          token?: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["workspace_member_role"]
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          id: string
          invited_by: string | null
          joined_at: string
          last_active_at: string | null
          role: Database["public"]["Enums"]["workspace_member_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          last_active_at?: string | null
          role?: Database["public"]["Enums"]["workspace_member_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          last_active_at?: string | null
          role?: Database["public"]["Enums"]["workspace_member_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          brand_color: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["workspace_kind"]
          logo_url: string | null
          name: string
          plan: Database["public"]["Enums"]["workspace_plan"]
          slug: string
          updated_at: string
        }
        Insert: {
          brand_color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["workspace_kind"]
          logo_url?: string | null
          name: string
          plan?: Database["public"]["Enums"]["workspace_plan"]
          slug: string
          updated_at?: string
        }
        Update: {
          brand_color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["workspace_kind"]
          logo_url?: string | null
          name?: string
          plan?: Database["public"]["Enums"]["workspace_plan"]
          slug?: string
          updated_at?: string
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
      accept_service_request_quote: {
        Args: { p_notes?: string; p_quote_id: string }
        Returns: {
          amount: number | null
          created_at: string
          currency: string
          decided_at: string | null
          eta_days: number | null
          expires_at: string
          id: string
          internal_notes: string | null
          invited_at: string
          invited_by: string | null
          request_id: string
          status: Database["public"]["Enums"]["service_quote_status"]
          submission_token: string
          submitted_at: string | null
          updated_at: string
          vendor_id: string
          vendor_notes: string | null
          workspace_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "service_request_quotes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      accept_workspace_invitation: { Args: { _token: string }; Returns: string }
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
      current_user_workspace_ids: { Args: never; Returns: string[] }
      decide_service_request_approval: {
        Args: { p_decision: string; p_notes?: string; p_request_id: string }
        Returns: Database["public"]["Enums"]["service_request_approval_status"]
      }
      decide_service_request_step_approval: {
        Args: { p_decision: string; p_notes?: string; p_step_id: string }
        Returns: Database["public"]["Enums"]["service_request_approval_status"]
      }
      decide_tenant_approval: {
        Args: { p_decision: string; p_notes?: string; p_token: string }
        Returns: {
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
          bill_to: Database["public"]["Enums"]["bill_to_role"]
          billing: Database["public"]["Enums"]["service_billing"]
          catalog_id: string | null
          category: Database["public"]["Enums"]["service_category"]
          category_other: string | null
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
          proposed_scheduled_date: string | null
          request_number: string
          requested_by_person_id: string | null
          schedule_counter_round: number
          scheduled_date: string | null
          source: string
          started_at: string | null
          status: Database["public"]["Enums"]["service_request_status"]
          target_id: string | null
          target_type: string
          tenant_approval_decided_at: string | null
          tenant_approval_notes: string | null
          tenant_approval_reason: string | null
          tenant_approval_requested_at: string | null
          tenant_approval_required: boolean
          tenant_approval_status: Database["public"]["Enums"]["tenant_approval_status"]
          tenant_proposed_date: string | null
          tenant_schedule_decided_at: string | null
          tenant_schedule_notes: string | null
          tenant_schedule_status: Database["public"]["Enums"]["tenant_schedule_status"]
          tenant_token: string | null
          title: string
          updated_at: string
          workspace_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "service_requests"
          isOneToOne: true
          isSetofReturn: false
        }
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
      has_workspace_role: {
        Args: {
          _roles: Database["public"]["Enums"]["workspace_member_role"][]
          _workspace_id: string
        }
        Returns: boolean
      }
      initialize_ticket_workflow: {
        Args: { p_stages: Json; p_ticket_id: string; p_workflow_key: string }
        Returns: undefined
      }
      is_workspace_member: { Args: { _workspace_id: string }; Returns: boolean }
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
      lookup_invitation: {
        Args: { _token: string }
        Returns: {
          accepted_at: string
          email: string
          expires_at: string
          role: Database["public"]["Enums"]["workspace_member_role"]
          workspace_id: string
          workspace_kind: Database["public"]["Enums"]["workspace_kind"]
          workspace_name: string
        }[]
      }
      next_number: {
        Args: { p_prefix: string; p_year: number }
        Returns: string
      }
      owner_onboard_property: {
        Args: {
          _address_line1: string
          _city: string
          _country?: string
          _name: string
          _workspace_id: string
        }
        Returns: string
      }
      process_contract_lifecycle: { Args: never; Returns: Json }
      propose_tenant_schedule: {
        Args: { p_date: string; p_notes?: string; p_request_id: string }
        Returns: {
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
          bill_to: Database["public"]["Enums"]["bill_to_role"]
          billing: Database["public"]["Enums"]["service_billing"]
          catalog_id: string | null
          category: Database["public"]["Enums"]["service_category"]
          category_other: string | null
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
          proposed_scheduled_date: string | null
          request_number: string
          requested_by_person_id: string | null
          schedule_counter_round: number
          scheduled_date: string | null
          source: string
          started_at: string | null
          status: Database["public"]["Enums"]["service_request_status"]
          target_id: string | null
          target_type: string
          tenant_approval_decided_at: string | null
          tenant_approval_notes: string | null
          tenant_approval_reason: string | null
          tenant_approval_requested_at: string | null
          tenant_approval_required: boolean
          tenant_approval_status: Database["public"]["Enums"]["tenant_approval_status"]
          tenant_proposed_date: string | null
          tenant_schedule_decided_at: string | null
          tenant_schedule_notes: string | null
          tenant_schedule_status: Database["public"]["Enums"]["tenant_schedule_status"]
          tenant_token: string | null
          title: string
          updated_at: string
          workspace_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "service_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_ticket_workflow: {
        Args: { p_ticket_id: string }
        Returns: undefined
      }
      reorder_service_request_steps: {
        Args: { p_request_id: string; p_step_ids: string[] }
        Returns: undefined
      }
      request_tenant_approval: {
        Args: { p_reason?: string; p_request_id: string }
        Returns: {
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
          bill_to: Database["public"]["Enums"]["bill_to_role"]
          billing: Database["public"]["Enums"]["service_billing"]
          catalog_id: string | null
          category: Database["public"]["Enums"]["service_category"]
          category_other: string | null
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
          proposed_scheduled_date: string | null
          request_number: string
          requested_by_person_id: string | null
          schedule_counter_round: number
          scheduled_date: string | null
          source: string
          started_at: string | null
          status: Database["public"]["Enums"]["service_request_status"]
          target_id: string | null
          target_type: string
          tenant_approval_decided_at: string | null
          tenant_approval_notes: string | null
          tenant_approval_reason: string | null
          tenant_approval_requested_at: string | null
          tenant_approval_required: boolean
          tenant_approval_status: Database["public"]["Enums"]["tenant_approval_status"]
          tenant_proposed_date: string | null
          tenant_schedule_decided_at: string | null
          tenant_schedule_notes: string | null
          tenant_schedule_status: Database["public"]["Enums"]["tenant_schedule_status"]
          tenant_token: string | null
          title: string
          updated_at: string
          workspace_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "service_requests"
          isOneToOne: true
          isSetofReturn: false
        }
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
      respond_to_schedule: {
        Args: {
          p_action: string
          p_counter_date?: string
          p_notes?: string
          p_token: string
        }
        Returns: {
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
          bill_to: Database["public"]["Enums"]["bill_to_role"]
          billing: Database["public"]["Enums"]["service_billing"]
          catalog_id: string | null
          category: Database["public"]["Enums"]["service_category"]
          category_other: string | null
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
          proposed_scheduled_date: string | null
          request_number: string
          requested_by_person_id: string | null
          schedule_counter_round: number
          scheduled_date: string | null
          source: string
          started_at: string | null
          status: Database["public"]["Enums"]["service_request_status"]
          target_id: string | null
          target_type: string
          tenant_approval_decided_at: string | null
          tenant_approval_notes: string | null
          tenant_approval_reason: string | null
          tenant_approval_requested_at: string | null
          tenant_approval_required: boolean
          tenant_approval_status: Database["public"]["Enums"]["tenant_approval_status"]
          tenant_proposed_date: string | null
          tenant_schedule_decided_at: string | null
          tenant_schedule_notes: string | null
          tenant_schedule_status: Database["public"]["Enums"]["tenant_schedule_status"]
          tenant_token: string | null
          title: string
          updated_at: string
          workspace_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "service_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      run_readonly_sql: { Args: { query_text: string }; Returns: Json }
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
      account_type: "asset" | "liability" | "equity" | "income" | "expense"
      app_role: "admin" | "staff" | "viewer"
      bill_status: "draft" | "approved" | "partial" | "paid" | "void"
      bill_to_role: "landlord" | "tenant"
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
      invoice_status: "draft" | "issued" | "partial" | "paid" | "void"
      ma_approval_rule: "auto_threshold" | "always_required" | "auto_all"
      ma_fee_model:
        | "percent_of_rent"
        | "flat_annual"
        | "flat_per_unit"
        | "hybrid"
      payment_direction: "in" | "out"
      payment_method:
        | "cash"
        | "cheque"
        | "bank_transfer"
        | "card"
        | "online"
        | "other"
      person_role: "tenant" | "owner" | "prospect" | "staff" | "vendor"
      property_status:
        | "vacant"
        | "occupied"
        | "maintenance"
        | "off_market"
        | "under_maintenance"
        | "reserved"
      quote_status:
        | "submitted"
        | "approved"
        | "rejected"
        | "converted"
        | "expired"
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
      service_quote_status:
        | "invited"
        | "submitted"
        | "accepted"
        | "rejected"
        | "withdrawn"
        | "expired"
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
      statement_status: "draft" | "issued" | "paid"
      tenant_approval_status:
        | "not_required"
        | "pending"
        | "approved"
        | "rejected"
      tenant_schedule_status: "none" | "proposed" | "confirmed" | "rescheduled"
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
      workspace_kind: "internal" | "owner" | "broker"
      workspace_member_role: "owner" | "admin" | "manager" | "agent" | "viewer"
      workspace_plan: "free" | "portfolio" | "broker_pro" | "enterprise"
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
      account_type: ["asset", "liability", "equity", "income", "expense"],
      app_role: ["admin", "staff", "viewer"],
      bill_status: ["draft", "approved", "partial", "paid", "void"],
      bill_to_role: ["landlord", "tenant"],
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
      invoice_status: ["draft", "issued", "partial", "paid", "void"],
      ma_approval_rule: ["auto_threshold", "always_required", "auto_all"],
      ma_fee_model: [
        "percent_of_rent",
        "flat_annual",
        "flat_per_unit",
        "hybrid",
      ],
      payment_direction: ["in", "out"],
      payment_method: [
        "cash",
        "cheque",
        "bank_transfer",
        "card",
        "online",
        "other",
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
      quote_status: [
        "submitted",
        "approved",
        "rejected",
        "converted",
        "expired",
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
      service_quote_status: [
        "invited",
        "submitted",
        "accepted",
        "rejected",
        "withdrawn",
        "expired",
      ],
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
      statement_status: ["draft", "issued", "paid"],
      tenant_approval_status: [
        "not_required",
        "pending",
        "approved",
        "rejected",
      ],
      tenant_schedule_status: ["none", "proposed", "confirmed", "rescheduled"],
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
      workspace_kind: ["internal", "owner", "broker"],
      workspace_member_role: ["owner", "admin", "manager", "agent", "viewer"],
      workspace_plan: ["free", "portfolio", "broker_pro", "enterprise"],
    },
  },
} as const
