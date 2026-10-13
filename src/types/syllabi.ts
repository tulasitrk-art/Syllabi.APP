import { DocumentStatus, SubjectCode, RoomRole } from './database';

export interface NormalizedPoint {
  x: number; // 0.0 to 1.0 (relative to page width)
  y: number; // 0.0 to 1.0 (relative to page height)
}

export type AnnotationTool = 'select' | 'pen' | 'highlighter' | 'eraser' | 'note' | 'bookmark';

export interface StrokePath {
  id: string;
  type: 'stroke';
  tool: 'pen' | 'highlighter';
  points: NormalizedPoint[];
  color: string;
  width: number; // Normalized to page width, e.g. 0.003
  opacity: number;
}

export interface RectHighlight {
  id: string;
  type: 'highlight';
  x: number; // 0.0 to 1.0
  y: number; // 0.0 to 1.0
  width: number;
  height: number;
  color: string;
  opacity: number;
}

export interface TextNote {
  id: string;
  type: 'note';
  x: number; // 0.0 to 1.0
  y: number; // 0.0 to 1.0
  text: string;
  color: string;
  authorName?: string;
  createdAt: string;
}

export type AnnotationItem = StrokePath | RectHighlight | TextNote;

export interface PageAnnotationGeometry {
  items: AnnotationItem[];
  version: 1;
}

export interface Bookmark {
  id: string;
  pageNumber: number;
  title: string;
  createdAt: string;
}

export interface DocumentWithProgress {
  id: string;
  roomId: string;
  uploadedBy: string;
  title: string;
  subject: SubjectCode;
  unit: number;
  syllabusTopic: string | null;
  fileUrl: string;
  totalPages: number;
  createdAt: string;
  userProgress?: {
    status: DocumentStatus;
    bookmarks: Bookmark[];
  };
  annotationCount?: number;
}

export interface StudyRoomSummary {
  id: string;
  name: string;
  joinCode: string;
  createdBy: string;
  createdAt: string;
  memberCount: number;
  documentCount: number;
  userRole?: RoomRole;
}

export interface UserPresence {
  userId: string;
  userName: string;
  activeDocId?: string;
  activePage?: number;
  lastSeen: string;
}
