// TerraPlan — Auto database setup
// Usage: node setup-db.js
// Requires: Node 18+ (built-in fetch)

const fs = require('fs');
const path = require('path');

// Load .env manually (no dotenv dependency needed)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach(line => {
      const [key, ...rest] = line.split('=');
      if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
    });
}

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF   = process.env.SUPABASE_PROJECT_REF;

if (!TOKEN || !REF) {
  console.error('❌  .env tidak ditemukan atau tidak lengkap.');
  process.exit(1);
}

const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function runQuery(sql, label) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { error: text }; }

  if (!res.ok) {
    // Ignore "already exists" errors (idempotent re-run)
    const msg = (json.message || json.error || '').toLowerCase();
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      console.log(`  ⚠  ${label} — sudah ada, dilewati`);
      return;
    }
    throw new Error(`${label}: ${json.message || json.error || res.status}`);
  }
  console.log(`  ✓  ${label}`);
}

// Split schema into logical blocks by their comment headers
function parseBlocks(sql) {
  // Split on lines that start with "-- ===..."
  const raw = sql.split(/^-- ={10,}/m);
  const blocks = [];

  for (const chunk of raw) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    // Extract title from first comment line
    const titleMatch = trimmed.match(/^--\s+(.+)/);
    const title = titleMatch ? titleMatch[1].replace(/^-+\s*/, '').trim() : 'SQL block';

    // Remove comment lines to get pure SQL
    const stmts = trimmed
      .split('\n')
      .filter(l => !l.trim().startsWith('--'))
      .join('\n')
      .trim();

    if (stmts) blocks.push({ title, sql: stmts });
  }
  return blocks;
}

async function main() {
  console.log('\n🗺  TerraPlan — Setup Database\n');

  const schemaPath = path.join(__dirname, 'sql', 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error('❌  sql/schema.sql tidak ditemukan');
    process.exit(1);
  }

  const schema = fs.readFileSync(schemaPath, 'utf8');
  const blocks = parseBlocks(schema);

  console.log(`📋  Menjalankan ${blocks.length} blok SQL...\n`);

  for (const block of blocks) {
    try {
      await runQuery(block.sql, block.title);
    } catch (err) {
      console.error(`  ✗  ${err.message}`);
      // Don't abort — try remaining blocks
    }
  }

  console.log('\n✅  Setup selesai! Buka index.html untuk mulai menggunakan TerraPlan.\n');
}

main().catch(err => {
  console.error('\n❌  Error:', err.message);
  process.exit(1);
});
