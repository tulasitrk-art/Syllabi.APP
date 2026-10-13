# Syllabi — Focused study rooms, zero distraction.

A collaborative, pure monochrome study ecosystem built for students to share, track, and annotate syllabus documents in real time.

---

## 1. Product Essence & Aesthetic
- **Philosophy:** Pure iOS dark-mode aesthetic.
- **Palette:** Strictly high-contrast monochrome:
  - `#000000` pitch black background
  - `#0A0A0A` panel surfaces
  - `#171717` interactive states
  - `#FFFFFF` crisp text and outlines
  - White opacity levels (`bg-white/10`, `border-white/20`) for elevation
  - Frosted glass blur (`backdrop-blur-xl`, `backdrop-blur-2xl`)
  - Squircle geometries (`rounded-2xl`, `rounded-3xl`, `rounded-squircle`)

---

## 2. Architectural Invariants

### I. The Transparent Layer Rule (Non-Destructive Annotation)
- Original uploaded syllabus PDFs remain strictly **immutable** at base depth (`z-0`).
- The Syllabi annotation engine mounts a transparent vector layer at (`z-10`).
- **Normalized Coordinate Math:** All stylus strokes, highlighter paths, and sticky note coordinates are normalized floats:
  $$0.0 \le x, y \le 1.0$$
  relative to bounding page dimensions. This guarantees pixel-perfect fidelity across Retina displays, mobile viewports, responsive window resizing, and zoom levels (50% – 200%).

### II. Syllabus Categorization
Every document belongs to:
- **Subject Code:** `DEVC` | `ADS` | `AI` | `UHV` | `JAVA`
- **Unit Number:** `Unit 1` to `Unit 5` (up to `10`)
- **Syllabus Topic:** Concepts, theorems, and examination targets.

### III. Independent Student Checklists
Per-student status tracking with instant Realtime synchronization:
- `'UNREAD'`
- `'IN_PROGRESS'`
- `'READ'`
- `'NEEDS_REVISION'`

---

## 3. Database Contract (Supabase PostgreSQL)

See [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql) for full migrations with Row-Level Security (RLS) and Realtime Publications:

| Table | Primary Columns | Purpose |
|---|---|---|
| `study_rooms` | `id`, `name`, `join_code`, `created_by`, `created_at` | Study room spaces |
| `room_members` | `id`, `room_id`, `user_id`, `role`, `joined_at` | Cohort membership |
| `documents` | `id`, `room_id`, `uploaded_by`, `title`, `subject`, `unit`, `syllabus_topic`, `file_url`, `total_pages` | Syllabus documents |
| `annotations` | `id`, `document_id`, `user_id`, `page_number`, `is_shared`, `geometry` (JSONB) | Normalized vector overlays |
| `user_document_progress` | `id`, `document_id`, `user_id`, `status`, `bookmarks` (JSONB), `updated_at` | Independent checklists |

---

## 4. Project Structure

```
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql     # Complete schema, RLS, & Realtime config
├── src/
│   ├── app/
│   │   ├── globals.css                # Pure monochrome iOS dark tokens & squircle cards
│   │   ├── layout.tsx                 # Root layout with dark mode metadata
│   │   ├── page.tsx                   # Study room launcher & code joiner
│   │   └── rooms/
│   │       └── [roomId]/
│   │           ├── page.tsx           # Room workspace dashboard
│   │           └── documents/
│   │               └── [docId]/
│   │                   └── page.tsx   # Dual-layer Document Annotation Studio
│   ├── components/
│   │   ├── annotation/
│   │   │   └── AnnotationCanvas.tsx   # Normalized vector overlay & sticky notes
│   │   ├── viewer/
│   │   │   └── DocumentViewer.tsx     # Dual-layer viewer & Apple floating dock
│   │   └── rooms/
│   │       └── RoomDashboard.tsx      # Subject tabs, unit filters, upload modal
│   ├── hooks/
│   │   └── useSupabaseRoom.ts         # Supabase Realtime & offline fallback provider
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts              # SSR Browser client
│   │   │   └── server.ts              # SSR Server client
│   │   └── utils.ts                   # Metadata, subject badges, tailwind merge
│   └── types/
│       ├── database.ts                # Direct Supabase PostgreSQL contracts
│       └── syllabi.ts                 # Domain models, normalized geometry, bookmarks
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 5. Getting Started

### Local Development
```bash
# 1. Install dependencies (already verified)
npm install

# 2. Run the Next.js development server
npm run dev

# 3. Open http://localhost:3000
```
