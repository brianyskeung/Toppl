export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          avatar_path: string | null;
          bio: string | null;
          created_at: string;
          display_name: string | null;
          grade_system: Database['public']['Enums']['grade_system'];
          id: string;
          onboarded_at: string | null;
          updated_at: string;
          username: string;
        };
        Insert: {
          avatar_path?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string | null;
          grade_system?: Database['public']['Enums']['grade_system'];
          id: string;
          onboarded_at?: string | null;
          updated_at?: string;
          username: string;
        };
        Update: {
          avatar_path?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string | null;
          grade_system?: Database['public']['Enums']['grade_system'];
          id?: string;
          onboarded_at?: string | null;
          updated_at?: string;
          username?: string;
        };
        Relationships: [];
      };
      profile_private: {
        Row: {
          ape_index_cm: number | null;
          height_cm: number | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          ape_index_cm?: number | null;
          height_cm?: number | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          ape_index_cm?: number | null;
          height_cm?: number | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profile_private_id_fkey';
            columns: ['id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      grade_system: 'hueco' | 'font' | 'dankyu';
    };
    CompositeTypes: { [_ in never]: never };
  };
};
