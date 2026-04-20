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
      people: {
        Row: {
          address: string | null
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
          last_name: string
          notes: string | null
          phone: string | null
          ref_code: string
          roles: Database["public"]["Enums"]["person_role"][]
          updated_at: string
        }
        Insert: {
          address?: string | null
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
          last_name: string
          notes?: string | null
          phone?: string | null
          ref_code: string
          roles?: Database["public"]["Enums"]["person_role"][]
          updated_at?: string
        }
        Update: {
          address?: string | null
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
          last_name?: string
          notes?: string | null
          phone?: string | null
          ref_code?: string
          roles?: Database["public"]["Enums"]["person_role"][]
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
      people_property_links: {
        Row: {
          building_id: string | null
          created_at: string
          end_date: string | null
          id: string
          is_primary: boolean
          notes: string | null
          person_id: string
          relationship: string
          start_date: string | null
          unit_id: string | null
        }
        Insert: {
          building_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          is_primary?: boolean
          notes?: string | null
          person_id: string
          relationship: string
          start_date?: string | null
          unit_id?: string | null
        }
        Update: {
          building_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          is_primary?: boolean
          notes?: string | null
          person_id?: string
          relationship?: string
          start_date?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_property_links_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_property_links_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_property_links_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_property_links_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_with_data_gaps"
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
    }
    Functions: {
      has_any_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
