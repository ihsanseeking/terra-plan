// TerraPlan — Automated test suite
// Usage: node test.js
// Tests: Supabase connection, CRUD admins/projects/layers/features, auth hash

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

const SUPABASE_URL = 'https://mntdjssqtyquiwemqhhf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1udGRqc3NxdHlxdWl3ZW1xaGhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxODg0MTIsImV4cCI6MjA5OTc2NDQxMn0.xEUU0th_cBZZM4qPskR5X4990u4330WsNO6i6suD_I0';

const HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

let passed = 0, failed = 0;
const errors = [];

// ── Helpers ───────────────────────────────────────────────
function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

async function q(method, table, body, params = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${params}`;
  const res = await fetch(url, { method, headers: HEADERS, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗  ${name}`);
    console.error(`     → ${e.message}`);
    failed++;
    errors.push({ name, error: e.message });
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

// ── Test data ─────────────────────────────────────────────
const TEST_SLUG     = `test-${Date.now()}`;
const TEST_USERNAME = `testuser_${Date.now()}`;
const TEST_PASSWORD = 'testpass123';
let   testAdminId, testProjectId, testLayerId, testFeatureId;

// ── Run tests ─────────────────────────────────────────────
async function main() {
  console.log('\n🧪  TerraPlan — Test Suite\n');

  // 1. Connection
  console.log('── 1. Koneksi Supabase');
  await test('GET /projects (connection check)', async () => {
    const r = await q('GET', 'projects', null, '?limit=1');
    assert(r.ok, `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    assert(Array.isArray(r.data), 'Response bukan array');
  });

  // 2. Admins table
  console.log('\n── 2. Tabel admins');
  await test('CREATE admin baru', async () => {
    const r = await q('POST', 'admins', {
      username: TEST_USERNAME, slug: TEST_SLUG,
      password_hash: sha256(TEST_PASSWORD), display_name: 'Test User',
    });
    assert(r.ok, `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    assert(r.data[0]?.id, 'id tidak ada di response');
    testAdminId = r.data[0].id;
  });

  await test('GET admin by slug', async () => {
    const r = await q('GET', 'admins', null, `?slug=eq.${TEST_SLUG}&limit=1`);
    assert(r.ok, `HTTP ${r.status}`);
    assert(r.data[0]?.id === testAdminId, 'Admin tidak ditemukan');
  });

  await test('Verifikasi password hash', async () => {
    const r = await q('GET', 'admins', null, `?slug=eq.${TEST_SLUG}&limit=1`);
    const admin = r.data[0];
    assert(admin.password_hash === sha256(TEST_PASSWORD), 'Hash tidak cocok');
  });

  await test('GET admin by username', async () => {
    const r = await q('GET', 'admins', null, `?username=eq.${TEST_USERNAME}&limit=1`);
    assert(r.ok && r.data[0]?.slug === TEST_SLUG, 'Username lookup gagal');
  });

  // 3. Projects
  console.log('\n── 3. Tabel projects');
  await test('CREATE project dengan admin_id', async () => {
    const r = await q('POST', 'projects', {
      name: 'Test Project', status: 'draft',
      center_lat: -6.2, center_lng: 106.8, zoom_level: 15,
      admin_id: testAdminId,
    });
    assert(r.ok, `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    testProjectId = r.data[0].id;
  });

  await test('GET projects by admin_id', async () => {
    const r = await q('GET', 'projects', null, `?admin_id=eq.${testAdminId}`);
    assert(r.ok && r.data.length > 0, 'Tidak ada project ditemukan');
    assert(r.data[0].admin_id === testAdminId, 'admin_id tidak cocok');
  });

  await test('GET public projects (status=aktif)', async () => {
    // Update to aktif first
    await q('PATCH', `projects?id=eq.${testProjectId}`, { status: 'aktif' });
    const r = await q('GET', 'projects', null, `?admin_id=eq.${testAdminId}&status=eq.aktif`);
    assert(r.ok && r.data.length > 0, 'Tidak ada aktif project');
  });

  await test('UPDATE project', async () => {
    const r = await q('PATCH', `projects?id=eq.${testProjectId}`, { name: 'Updated Project' });
    assert(r.ok, `HTTP ${r.status}`);
  });

  // 4. Layers
  console.log('\n── 4. Tabel layers');
  await test('CREATE layer', async () => {
    const r = await q('POST', 'layers', {
      project_id: testProjectId, name: 'Zona Test',
      color: '#e74c3c', fill_color: '#e74c3c', sort_order: 0,
    });
    assert(r.ok, `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    testLayerId = r.data[0].id;
  });

  await test('GET layers by project', async () => {
    const r = await q('GET', 'layers', null, `?project_id=eq.${testProjectId}`);
    assert(r.ok && r.data.length > 0, 'Tidak ada layer');
  });

  await test('UPDATE layer visibility', async () => {
    const r = await q('PATCH', `layers?id=eq.${testLayerId}`, { visible: false });
    assert(r.ok, `HTTP ${r.status}`);
  });

  // 5. Features
  console.log('\n── 5. Tabel features');
  const testGeoJSON = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[[106.8, -6.2], [106.81, -6.2], [106.81, -6.21], [106.8, -6.21], [106.8, -6.2]]],
    },
    properties: {},
  };

  await test('CREATE polygon feature', async () => {
    const r = await q('POST', 'features', {
      project_id: testProjectId, layer_id: testLayerId,
      name: 'Test Polygon', type: 'polygon',
      geojson: testGeoJSON, area_m2: 1500.5,
      category: 'Perumahan', color: '#e74c3c', fill_color: '#e74c3c', opacity: 0.5,
    });
    assert(r.ok, `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    testFeatureId = r.data[0].id;
  });

  await test('CREATE polyline feature', async () => {
    const geo = { type: 'Feature', geometry: { type: 'LineString', coordinates: [[106.8, -6.2], [106.81, -6.21]] }, properties: {} };
    const r = await q('POST', 'features', {
      project_id: testProjectId, type: 'polyline',
      geojson: geo, length_m: 250.3, name: 'Test Jalan',
      category: 'Jalan/Akses', color: '#7f8c8d', opacity: 0.9,
    });
    assert(r.ok, `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
  });

  await test('CREATE marker feature', async () => {
    const geo = { type: 'Feature', geometry: { type: 'Point', coordinates: [106.8, -6.2] }, properties: {} };
    const r = await q('POST', 'features', {
      project_id: testProjectId, type: 'marker',
      geojson: geo, name: 'Test Marker', category: 'Default', color: '#3388ff',
    });
    assert(r.ok, `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
  });

  await test('GET features by project', async () => {
    const r = await q('GET', 'features', null, `?project_id=eq.${testProjectId}`);
    assert(r.ok && r.data.length === 3, `Harusnya 3 fitur, dapat ${r.data?.length}`);
  });

  await test('UPDATE feature name & label', async () => {
    const r = await q('PATCH', `features?id=eq.${testFeatureId}`, {
      name: 'Kavling A1', label: 'A1',
    });
    assert(r.ok, `HTTP ${r.status}`);
  });

  // 6. Drone overlays
  console.log('\n── 6. Tabel drone_overlays');
  await test('CREATE drone overlay', async () => {
    const r = await q('POST', 'drone_overlays', {
      project_id: testProjectId, name: 'Foto Drone Test',
      image_url: 'https://example.com/drone.jpg',
      bounds: [[-6.21, 106.79], [-6.19, 106.81]],
      opacity: 0.8,
    });
    assert(r.ok, `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
  });

  await test('GET drone overlays by project', async () => {
    const r = await q('GET', 'drone_overlays', null, `?project_id=eq.${testProjectId}`);
    assert(r.ok && r.data.length > 0, 'Tidak ada overlay');
  });

  // 7. Cascade delete
  console.log('\n── 7. Cascade delete');
  await test('DELETE project (cascade ke layers, features, overlays)', async () => {
    const r = await q('DELETE', `projects?id=eq.${testProjectId}`, null);
    assert(r.ok, `HTTP ${r.status}`);
    // Verify cascade
    const fl = await q('GET', 'layers',   null, `?project_id=eq.${testProjectId}`);
    const ff = await q('GET', 'features', null, `?project_id=eq.${testProjectId}`);
    assert(fl.data.length === 0, 'Layer tidak ter-cascade delete');
    assert(ff.data.length === 0, 'Feature tidak ter-cascade delete');
  });

  await test('DELETE admin test', async () => {
    const r = await q('DELETE', `admins?id=eq.${testAdminId}`, null);
    assert(r.ok, `HTTP ${r.status}`);
  });

  // ── Summary ───────────────────────────────────────────────
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`✅  Passed: ${passed}`);
  if (failed > 0) {
    console.log(`❌  Failed: ${failed}`);
    errors.forEach(e => console.log(`   • ${e.name}: ${e.error}`));
    process.exit(1);
  } else {
    console.log(`\n🎉  Semua test berhasil! TerraPlan siap digunakan.\n`);
  }
}

main().catch(err => {
  console.error('\n❌  Test runner error:', err.message);
  process.exit(1);
});
