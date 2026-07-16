-- TerraPlan Schema v2 — Multi-tenant admin accounts
-- Run AFTER schema.sql (or run standalone if starting fresh)

-- ============================================================
-- ADMINS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT UNIQUE NOT NULL,
  slug          TEXT UNIQUE NOT NULL,   -- used in URL: ?view=slug
  password_hash TEXT NOT NULL,          -- SHA-256 hex of password
  display_name  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_admins" ON admins FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_admins_slug     ON admins(slug);
CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);

-- ============================================================
-- ADD admin_id TO PROJECTS
-- ============================================================
ALTER TABLE projects ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES admins(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_projects_admin_id ON projects(admin_id);
