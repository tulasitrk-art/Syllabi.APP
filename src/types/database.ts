export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SubjectCode = 'DMGT' | 'ADS' | 'AI' | 'UHV' | 'JAVA' | 'SYLLABUS' | 'DEVC';

export type DocumentStatus = 'UNREAD' | 'IN_PROGRESS' | 'READ' | 'NEEDS_REVISION';

export type RoomRole = 'owner' | 'admin' | 'member';

export interface Database {
  public: {
    Tables: {
      study_rooms: {
        Row: {
          id: string;
          name: string;
          join_code: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          join_code: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          join_code?: string;
          created_by?: string;
          created_at?: string;
        };
      };
      room_members: {
        Row: {
          id: string;
          room_id: string;
          user_id: string;
          role: RoomRole;
          joined_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          user_id: string;
          role?: RoomRole;
          joined_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          user_id?: string;
          role?: RoomRole;
          joined_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          room_id: string;
          uploaded_by: string;
          title: string;
          subject: SubjectCode;
          unit: number;
          syllabus_topic: string | null;
          file_url: string;
          total_pages: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          uploaded_by: string;
          title: string;
          subject: SubjectCode;
          unit: number;
          syllabus_topic?: string | null;
          file_url: string;
          total_pages?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          uploaded_by?: string;
          title?: string;
          subject?: SubjectCode;
          unit?: number;
          syllabus_topic?: string | null;
          file_url?: string;
          total_pages?: number;
          created_at?: string;
        };
      };
      annotations: {
        Row: {
          id: string;
          document_id: string;
          user_id: string;
          page_number: number;
          is_shared: boolean;
          geometry: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          user_id: string;
          page_number: number;
          is_shared?: boolean;
          geometry: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          user_id?: string;
          page_number?: number;
          is_shared?: boolean;
          geometry?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_document_progress: {
        Row: {
          id: string;
          document_id: string;
          user_id: string;
          status: DocumentStatus;
          bookmarks: Json;
          updated_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          user_id: string;
          status?: DocumentStatus;
          bookmarks?: Json;
          updated_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          user_id?: string;
          status?: DocumentStatus;
          bookmarks?: Json;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
