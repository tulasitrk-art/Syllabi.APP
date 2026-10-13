-- ==============================================================================
-- SYLLABI DATABASE SCHEMA — LEAD ARCHITECT INITIALIZATION
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. STUDY ROOMS
CREATE TABLE IF NOT EXISTS study_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    join_code VARCHAR(8) UNIQUE NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for fast join code lookups
CREATE INDEX IF NOT EXISTS idx_study_rooms_join_code ON study_rooms(join_code);

-- 2. ROOM MEMBERS
CREATE TABLE IF NOT EXISTS room_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_room_members_room ON room_members(room_id);

-- 3. DOCUMENTS (Categorized by Subject, Unit, Syllabus Topic)
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL,
    title TEXT NOT NULL,
    subject TEXT NOT NULL CHECK (subject IN ('DEVC', 'ADS', 'AI', 'UHV', 'JAVA')),
    unit INTEGER NOT NULL CHECK (unit BETWEEN 1 AND 10),
    syllabus_topic TEXT,
    file_url TEXT NOT NULL,
    total_pages INTEGER NOT NULL DEFAULT 1 CHECK (total_pages >= 1),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_room ON documents(room_id);
CREATE INDEX IF NOT EXISTS idx_documents_subject_unit ON documents(subject, unit);

-- 4. ANNOTATIONS (Non-destructive vector / highlight layer)
-- Geometry is strictly normalized [0.0 - 1.0] coordinates relative to page bounds
CREATE TABLE IF NOT EXISTS annotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    page_number INTEGER NOT NULL CHECK (page_number >= 1),
    is_shared BOOLEAN NOT NULL DEFAULT true,
    geometry JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_annotations_doc_page ON annotations(document_id, page_number);
CREATE INDEX IF NOT EXISTS idx_annotations_user ON annotations(user_id);

-- 5. USER DOCUMENT PROGRESS & BOOKMARKS (Per-student independent tracking)
CREATE TABLE IF NOT EXISTS user_document_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'UNREAD' CHECK (status IN ('UNREAD', 'IN_PROGRESS', 'READ', 'NEEDS_REVISION')),
    bookmarks JSONB DEFAULT '[]'::jsonb NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(document_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_doc_progress ON user_document_progress(document_id, user_id);

-- REALTIME REPLICATION CONFIGURATION
-- Enable replication for live synchronization across active room members
ALTER PUBLICATION supabase_realtime ADD TABLE study_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE room_members;
ALTER PUBLICATION supabase_realtime ADD TABLE documents;
ALTER PUBLICATION supabase_realtime ADD TABLE annotations;
ALTER PUBLICATION supabase_realtime ADD TABLE user_document_progress;

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE study_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_document_progress ENABLE ROW LEVEL SECURITY;

-- Study rooms: Members and visitors can view and create rooms
CREATE POLICY "Users can view rooms"
    ON study_rooms FOR SELECT
    USING (true);

CREATE POLICY "Users can create rooms"
    ON study_rooms FOR INSERT
    WITH CHECK (true);

-- Room members policies
CREATE POLICY "Members can view membership"
    ON room_members FOR SELECT
    USING (true);

CREATE POLICY "Users can join rooms"
    ON room_members FOR INSERT
    WITH CHECK (true);

-- Documents policies: Collaborative access for all study room peers
CREATE POLICY "Public view documents"
    ON documents FOR SELECT
    USING (true);

CREATE POLICY "Public insert documents"
    ON documents FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Public update documents"
    ON documents FOR UPDATE
    USING (true);

CREATE POLICY "Public delete documents"
    ON documents FOR DELETE
    USING (true);

-- Annotations policies: Shared annotations visible to room members
CREATE POLICY "Public view annotations"
    ON annotations FOR SELECT
    USING (true);

CREATE POLICY "Public insert annotations"
    ON annotations FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Public update own annotations"
    ON annotations FOR UPDATE
    USING (true);

CREATE POLICY "Public delete own annotations"
    ON annotations FOR DELETE
    USING (true);

-- User document progress policies
CREATE POLICY "Manage document progress"
    ON user_document_progress FOR ALL
    USING (true)
    WITH CHECK (true);
