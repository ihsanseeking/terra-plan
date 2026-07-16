-- TerraPlan Database Schema
-- Run this in Supabase SQL Editor

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'draft'
              CHECK (status IN ('aktif', 'draft', 'arsip')),
  pin         TEXT NOT NULL DEFAULT '1234',
  location    TEXT,
  center_lat  DOUBLE PRECISION DEFAULT -6.2,
  center_lng  DOUBLE PRECISION DEFAULT 106.816667,
  zoom_level  INTEGER DEFAULT 15,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LAYERS
-- ============================================================
CREATE TABLE IF NOT EXISTS layers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT DEFAULT '#3388ff',
  fill_color  TEXT DEFAULT '#3388ff',
  opacity     DOUBLE PRECISION DEFAULT 0.5,
  visible     BOOLEAN DEFAULT TRUE,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FEATURES (polygon, polyline, marker)
-- ============================================================
CREATE TABLE IF NOT EXISTS features (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  layer_id    UUID REFERENCES layers(id) ON DELETE SET NULL,
  name        TEXT,
  type        TEXT NOT NULL CHECK (type IN ('polygon', 'polyline', 'marker')),
  geojson     JSONB NOT NULL,
  area_m2     DOUBLE PRECISION,
  length_m    DOUBLE PRECISION,
  category    TEXT DEFAULT 'Default',
  color       TEXT,
  fill_color  TEXT,
  opacity     DOUBLE PRECISION DEFAULT 0.5,
  label       TEXT,
  properties  JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DRONE OVERLAYS
-- ============================================================
CREATE TABLE IF NOT EXISTS drone_overlays (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  layer_id    UUID REFERENCES layers(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  image_url   TEXT NOT NULL,
  bounds      JSONB NOT NULL,  -- [[south, west], [north, east]]
  opacity     DOUBLE PRECISION DEFAULT 0.8,
  visible     BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS POLICIES (disable strict RLS, allow anon full access)
-- PIN enforcement is handled at application level
-- ============================================================
ALTER TABLE projects      ENABLE ROW LEVEL SECURITY;
ALTER TABLE layers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE features      ENABLE ROW LEVEL SECURITY;
ALTER TABLE drone_overlays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_all_projects"       ON projects       FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_layers"         ON layers         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_features"       ON features       FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_drone_overlays" ON drone_overlays FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- AUTO-UPDATE updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_features_updated_at
  BEFORE UPDATE ON features
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED: sample project
-- ============================================================
INSERT INTO projects (name, description, status, pin, location, center_lat, center_lng, zoom_level)
VALUES (
  'Proyek Percontohan',
  'Proyek demo TerraPlan untuk demonstrasi fitur pemetaan lahan.',
  'aktif',
  '1234',
  'Jakarta Selatan',
  -6.2615,
  106.8106,
  15
);
