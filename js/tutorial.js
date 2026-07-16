// TerraPlan — Context-aware guided tour
// Detects current panel/state and shows relevant steps only.
const Tutorial = {
  _step: 0,
  _steps: [],
  _overlay: null,
  _demoLayers: [],
  _currentContext: null,

  // ── Context detection ─────────────────────────────────────
  _detectContext() {
    const activePanel = document.querySelector('.panel.active')?.id;
    const mode       = App?.state?.mode;
    const hasProject = !!App?.state?.currentProject;

    if (activePanel === 'panel-landing')     return 'landing';
    if (activePanel === 'panel-admin-login') return 'admin-login';
    if (mode === 'public'  && !hasProject)   return 'public-projects';
    if (mode === 'public'  &&  hasProject)   return 'public-map';
    if (mode === 'admin'   && !hasProject)   return 'admin-projects';
    if (mode === 'admin'   &&  hasProject)   return 'admin-map';
    return 'landing';
  },

  // ── Step definitions per context ──────────────────────────
  CONTEXTS: {

    // ── 1. Landing page ──────────────────────────────────────
    landing: [
      {
        title: '👋 Selamat datang di TerraPlan!',
        text: 'Platform pemetaan lahan digital untuk mengelola & mempresentasikan proyek ke investor.<br><br>Ikuti panduan singkat ini untuk mulai.',
        target: null, position: 'center',
      },
      {
        title: '👁 Lihat Peta Publik',
        text: 'Masukkan <b>kode workspace</b> milik admin lahan, lalu klik <b>→</b><br><br>Kamu akan melihat semua proyek aktif milik admin tersebut dalam mode view-only.',
        target: '.landing-card:first-child', position: 'right',
      },
      {
        title: '🔑 Login Admin',
        text: 'Punya akun admin? Klik <b>Login</b> untuk masuk ke workspace-mu dan mengelola proyek lahan.',
        target: '#btn-goto-login', position: 'right',
      },
      {
        title: '🆕 Buat Akun Admin',
        text: 'Belum punya akun? Klik <b>Daftar</b> dan isi form pendaftaran.<br><br>Kamu butuh <b>Platform Key</b> dari pengelola platform untuk mendaftar.',
        target: '#btn-goto-register', position: 'right',
      },
      {
        title: '🔑 Platform Key',
        text: 'Platform Key adalah kode khusus yang membatasi siapa saja yang bisa jadi admin.<br><br>Hubungi pengelola platform untuk mendapatkan kode ini sebelum mendaftar.',
        target: '.landing-card:last-child', position: 'right',
      },
    ],

    // ── 2. Admin login panel ──────────────────────────────────
    'admin-login': [
      {
        title: '🔑 Login Admin',
        text: 'Masukkan <b>username</b> dan <b>password</b> akun admin kamu, lalu klik <b>Masuk</b>.',
        target: '#panel-admin-login', position: 'right',
      },
      {
        title: '💡 Belum punya akun?',
        text: 'Klik <b>"Daftar di sini"</b> di bawah tombol login untuk membuat akun admin baru.<br><br>Siapkan Platform Key dari pengelola platform.',
        target: '#btn-login-register', position: 'right',
      },
      {
        title: '← Kembali ke Landing',
        text: 'Klik <b>← Kembali</b> untuk ke halaman utama jika ingin melihat peta publik workspace lain.',
        target: '#btn-login-back', position: 'right',
      },
    ],

    // ── 3. Public — daftar proyek ─────────────────────────────
    'public-projects': [
      {
        title: '🗺 Workspace Publik',
        text: 'Kamu sedang melihat proyek lahan milik <b id="tut-admin-name">admin ini</b>.<br><br>Mode ini <b>view-only</b> — kamu bisa lihat semua proyek aktif tapi tidak bisa mengedit.',
        target: '#project-list', position: 'right',
        onEnter: 'fillAdminName',
      },
      {
        title: '📋 Kartu Proyek',
        text: 'Setiap kartu menampilkan nama, lokasi, dan deskripsi proyek.<br><br>Klik kartu untuk membuka peta lengkap proyek tersebut.',
        target: '#project-list', position: 'right',
      },
      {
        title: '🗺 Basemap',
        text: 'Gunakan tombol di header untuk mengganti tampilan peta:<br>• <b>Peta</b> — OpenStreetMap<br>• <b>Satelit</b> — foto udara<br>• <b>Hybrid</b> — satelit + label',
        target: '.basemap-group', position: 'bottom',
      },
    ],

    // ── 4. Public — peta proyek ───────────────────────────────
    'public-map': [
      {
        title: '🗺 Peta Proyek',
        text: 'Ini peta lahan yang sudah dipetakan oleh admin.<br><br>Berikut simulasi fitur-fitur yang biasanya ada di peta lahan.',
        target: '#map', position: 'center',
        onEnter: 'showDemoFeatures',
      },
      {
        title: '⬡ Area & Kavling',
        text: 'Polygon berwarna menunjukkan area/kavling.<br><br><b>Klik polygon</b> untuk melihat:<br>• Nama area<br>• Kategori zona<br>• Luas dalam m² dan hektar',
        target: '#map', position: 'right',
      },
      {
        title: '〰 Jalur & Jalan',
        text: 'Garis menunjukkan jalur jalan, akses, atau batas area.<br><br>Klik garis untuk lihat <b>panjang jalur</b> dalam meter.',
        target: '#map', position: 'right',
      },
      {
        title: '📍 Titik Penting',
        text: 'Marker menandai titik penting seperti gerbang, pos keamanan, atau fasilitas.<br><br>Klik marker untuk lihat informasi lengkapnya.',
        target: '#map', position: 'right',
      },
      {
        title: '🗂 Layer',
        text: 'Klik 👁 di samping nama layer untuk <b>sembunyikan atau tampilkan</b> kelompok area tertentu.',
        target: '#tab-layers', position: 'right',
      },
      {
        title: '🛰 Ganti Basemap',
        text: 'Gunakan tombol ini untuk mengganti tampilan peta dasar.<br><br>Mode <b>Satelit</b> sangat berguna untuk melihat kondisi lahan nyata.',
        target: '.basemap-group', position: 'bottom',
        onLeave: 'clearDemoFeatures',
      },
    ],

    // ── 5. Admin — daftar proyek ──────────────────────────────
    'admin-projects': [
      {
        title: '🏠 Workspace Admin Kamu',
        text: 'Ini halaman utama workspace-mu sebagai admin.<br><br>Dari sini kamu bisa membuat, mengelola, dan membagikan proyek pemetaan lahan.',
        target: '#project-list', position: 'right',
      },
      {
        title: '📋 Status Proyek',
        text: 'Setiap proyek punya status:<br><br>• <span style="color:#2ecc71">■</span> <b>Aktif</b> — terlihat oleh publik<br>• <span style="color:#f39c12">■</span> <b>Draft</b> — hanya kamu yang bisa lihat<br>• <span style="color:#aaa">■</span> <b>Arsip</b> — proyek tidak aktif',
        target: '#project-list', position: 'right',
      },
      {
        title: '➕ Buat Proyek Baru',
        text: 'Klik <b>+ Proyek</b> untuk membuat proyek lahan baru.<br><br>Isi nama, lokasi, deskripsi, status, dan atur posisi awal peta.',
        target: '#btn-new-project', position: 'bottom',
      },
      {
        title: '🔗 Bagikan ke Investor',
        text: 'Klik <b>🔗 Share</b> untuk menyalin link publik workspace-mu.<br><br>Link ini bisa langsung dibagikan ke investor — mereka hanya bisa melihat, tidak bisa mengedit.',
        target: '#btn-share', position: 'bottom',
      },
      {
        title: '🗺 Buka Proyek',
        text: 'Klik salah satu kartu proyek untuk membuka petanya dan mulai memetakan lahan.',
        target: '#project-list', position: 'right',
      },
    ],

    // ── 6. Admin — peta proyek ────────────────────────────────
    'admin-map': [
      {
        title: '🗺 Peta Proyek (Mode Admin)',
        text: 'Kamu sekarang dalam mode admin untuk proyek ini.<br><br>Kamu bisa menggambar, mengedit, dan mengelola semua data peta.',
        target: '#map', position: 'center',
        onEnter: 'showDemoFeatures',
      },
      {
        title: '⬡ Gambar Polygon',
        text: 'Klik <b>⬡ Polygon</b> di toolbar bawah, lalu klik titik-titik di peta untuk membuat area/kavling.<br><br><b>Double-klik</b> untuk selesai.<br>Luas dihitung otomatis dalam m² dan hektar.',
        target: '#drawing-toolbar', position: 'top',
      },
      {
        title: '〰 Gambar Jalur',
        text: 'Klik <b>〰 Jalur</b>, lalu klik titik-titik membentuk jalur/jalan.<br><br><b>Double-klik</b> untuk selesai.<br>Panjang jalur dihitung otomatis dalam meter.',
        target: '#drawing-toolbar', position: 'top',
      },
      {
        title: '📍 Pasang Marker',
        text: 'Klik <b>📍 Titik</b>, lalu klik satu titik di peta untuk memasang marker.<br><br>Berguna untuk menandai gerbang, pos keamanan, akses masuk, dll.',
        target: '#drawing-toolbar', position: 'top',
      },
      {
        title: '✏️ Edit Properti Fitur',
        text: 'Klik area/jalur/marker di peta atau di daftar ini untuk membuka panel edit.<br><br>Kamu bisa ubah <b>nama, label, zona, warna,</b> dan <b>layer</b>-nya.',
        target: '#tab-features', position: 'right',
      },
      {
        title: '✏️ Edit Bentuk Fitur',
        text: 'Di panel edit fitur, klik <b>"✏️ Edit Bentuk"</b> untuk mengubah bentuk secara langsung di peta.<br><br>• Polygon/Jalur → drag titik sudut<br>• Marker → geser ke posisi baru<br><br>Luas/panjang dihitung ulang otomatis setelah disimpan.',
        target: '#tab-features', position: 'right',
      },
      {
        title: '🗂 Manajemen Layer',
        text: 'Layer mengelompokkan fitur berdasarkan kategori.<br><br>• Klik <b>+ Layer</b> untuk tambah layer baru<br>• Klik <b>👁</b> untuk tampilkan/sembunyikan<br>• Klik <b>✏️</b> untuk set layer aktif — fitur baru masuk ke sini',
        target: '#tab-layers', position: 'right',
      },
      {
        title: '🛸 Overlay Foto Drone',
        text: 'Klik <b>🛸 Drone</b> di header untuk menempel foto udara tepat di atas peta.<br><br>Masukkan URL gambar dan koordinat batasnya — foto muncul persis di lokasi yang sesuai.',
        target: '#btn-add-drone', position: 'bottom',
      },
      {
        title: '🔗 Share ke Investor',
        text: 'Proyek sudah siap? Set status ke <b>Aktif</b> lalu klik <b>🔗 Share</b> untuk menyalin link publik.<br><br>Investor hanya bisa melihat, tidak bisa mengedit.',
        target: '#btn-share', position: 'bottom',
        onLeave: 'clearDemoFeatures',
      },
    ],
  },

  // ── Demo data (Jakarta Selatan) ───────────────────────────
  DEMO_GEO: {
    kavlingA: { type:'Feature', geometry:{ type:'Polygon', coordinates:[[[106.7998,-6.2891],[106.8018,-6.2891],[106.8018,-6.2907],[106.7998,-6.2907],[106.7998,-6.2891]]] }, properties:{ name:'Kavling A1', area:'1.847 m² (0,1847 ha)', cat:'Perumahan', color:'#e74c3c' } },
    kavlingB: { type:'Feature', geometry:{ type:'Polygon', coordinates:[[[106.8020,-6.2891],[106.8038,-6.2891],[106.8038,-6.2905],[106.8020,-6.2905],[106.8020,-6.2891]]] }, properties:{ name:'Kavling B1', area:'1.440 m² (0,1440 ha)', cat:'Perumahan', color:'#e67e22' } },
    fasum:    { type:'Feature', geometry:{ type:'Polygon', coordinates:[[[106.7998,-6.2910],[106.8038,-6.2910],[106.8038,-6.2922],[106.7998,-6.2922],[106.7998,-6.2910]]] }, properties:{ name:'Area Fasilitas Umum', area:'3.200 m² (0,32 ha)', cat:'Fasilitas Umum', color:'#27ae60' } },
    jalan:    { type:'Feature', geometry:{ type:'LineString', coordinates:[[106.7993,-6.2899],[106.8042,-6.2899]] }, properties:{ name:'Jalan Akses Utama', length:'327 m', cat:'Jalan/Akses', color:'#7f8c8d' } },
    jalanSub: { type:'Feature', geometry:{ type:'LineString', coordinates:[[106.8008,-6.2891],[106.8008,-6.2924]] }, properties:{ name:'Jalan Sub-blok', length:'183 m', cat:'Jalan/Akses', color:'#95a5a6' } },
    gerbang:  { coords:[-6.2899, 106.7993], name:'Gerbang Utama', color:'#3498db' },
    pos:      { coords:[-6.2916, 106.8018], name:'Pos Keamanan',  color:'#9b59b6' },
  },

  // ── Public API ────────────────────────────────────────────
  start() {
    this._currentContext = this._detectContext();
    this._steps = this.CONTEXTS[this._currentContext] || [];
    if (!this._steps.length) return;
    this._step = 0;
    this._buildDOM();
    this._show();
  },

  autoStart() {
    if (!localStorage.getItem('tp_tut_seen')) {
      localStorage.setItem('tp_tut_seen', '1');
      setTimeout(() => this.start(), 800);
    }
  },

  // Reset so tutorial auto-shows again on next visit
  resetSeen() { localStorage.removeItem('tp_tut_seen'); },

  // ── Step callbacks ────────────────────────────────────────
  fillAdminName() {
    const admin = App?.state?.viewAdmin;
    const el = document.getElementById('tut-admin-name');
    if (el && admin) el.textContent = admin.display_name || admin.username;
  },

  showDemoFeatures() {
    if (!MapManager.map || this._demoLayers.length) return;
    MapManager.map.setView([-6.2907, 106.8018], 16);

    const add = (fn, delay) => setTimeout(() => {
      if (!this._overlay) return;
      const l = fn(); if (l) this._demoLayers.push(l);
    }, delay);

    const geo = this.DEMO_GEO;

    // Polygons
    [
      [geo.kavlingA, 300], [geo.kavlingB, 700], [geo.fasum, 1100],
    ].forEach(([d, delay]) => {
      add(() => L.geoJSON(d, {
        style: { color: d.properties.color, fillColor: d.properties.color, weight:2, fillOpacity:0.4 },
      }).bindPopup(`<div class="popup-content"><strong>${d.properties.name}</strong><br><span class="popup-cat">${d.properties.cat}</span><br>Luas: <b>${d.properties.area}</b></div>`).addTo(MapManager.map), delay);
    });

    // Polylines
    [
      [geo.jalan, 1500], [geo.jalanSub, 1800],
    ].forEach(([d, delay]) => {
      add(() => L.geoJSON(d, {
        style: { color: d.properties.color, weight:4, opacity:0.9 },
      }).bindPopup(`<div class="popup-content"><strong>${d.properties.name}</strong><br><span class="popup-cat">${d.properties.cat}</span><br>Panjang: <b>${d.properties.length}</b></div>`).addTo(MapManager.map), delay);
    });

    // Markers
    [
      [geo.gerbang, 2100], [geo.pos, 2400],
    ].forEach(([d, delay]) => {
      add(() => {
        const icon = L.divIcon({ className:'', html:`<div style="background:${d.color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`, iconSize:[14,14], iconAnchor:[7,7] });
        return L.marker(d.coords, { icon }).bindPopup(`<div class="popup-content"><strong>${d.name}</strong><br><span class="popup-cat">📍 Marker</span></div>`).addTo(MapManager.map);
      }, delay);
    });

    // Open popup of first polygon after all loaded
    add(() => { this._demoLayers[0]?.openPopup(); return null; }, 3000);
  },

  clearDemoFeatures() {
    this._demoLayers.forEach(l => { try { MapManager.map?.removeLayer(l); } catch {} });
    this._demoLayers = [];
  },

  // ── DOM ───────────────────────────────────────────────────
  _buildDOM() {
    document.getElementById('tutorial-overlay')?.remove();
    const el = document.createElement('div');
    el.id = 'tutorial-overlay';
    el.innerHTML = `
      <div id="tut-spotlight"></div>
      <div id="tut-box">
        <div id="tut-header">
          <div id="tut-context-badge"></div>
          <div id="tut-progress"></div>
        </div>
        <div id="tut-title"></div>
        <div id="tut-text"></div>
        <div id="tut-footer">
          <button id="tut-skip">Lewati</button>
          <div id="tut-nav">
            <button id="tut-prev">← Sebelumnya</button>
            <button id="tut-next">Berikutnya →</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(el);
    this._overlay = el;

    el.querySelector('#tut-next').addEventListener('click', () => this._next());
    el.querySelector('#tut-prev').addEventListener('click', () => this._prev());
    el.querySelector('#tut-skip').addEventListener('click', () => this.stop());
  },

  _contextLabel: {
    'landing':          '🏠 Halaman Utama',
    'admin-login':      '🔑 Login Admin',
    'public-projects':  '👁 Peta Publik',
    'public-map':       '🗺 Lihat Peta',
    'admin-projects':   '⚙️ Dashboard Admin',
    'admin-map':        '✏️ Edit Peta',
  },

  _show() {
    const step  = this._steps[this._step];
    const total = this._steps.length;

    // Context badge
    this._overlay.querySelector('#tut-context-badge').textContent =
      this._contextLabel[this._currentContext] || '';

    // Progress dots
    this._overlay.querySelector('#tut-progress').innerHTML =
      this._steps.map((_, i) =>
        `<span class="tut-dot ${i === this._step ? 'active' : i < this._step ? 'done' : ''}"></span>`
      ).join('');

    this._overlay.querySelector('#tut-title').textContent = step.title;
    this._overlay.querySelector('#tut-text').innerHTML    = step.text;

    const prev = this._overlay.querySelector('#tut-prev');
    const next = this._overlay.querySelector('#tut-next');
    prev.style.visibility = this._step === 0 ? 'hidden' : '';
    next.textContent      = this._step === total - 1 ? '✓ Selesai' : 'Berikutnya →';
    this._overlay.querySelector('#tut-skip').textContent =
      this._step === total - 1 ? '' : 'Lewati';

    this._positionBox(step);
    this._overlay.style.display = 'block';

    if (step.onEnter) this[step.onEnter]?.();
  },

  _next() {
    const cur = this._steps[this._step];
    if (cur?.onLeave) this[cur.onLeave]?.();
    if (this._step >= this._steps.length - 1) { this.stop(); return; }
    this._step++;
    this._show();
  },

  _prev() {
    if (this._step <= 0) return;
    this._step--;
    this._show();
  },

  stop() {
    this.clearDemoFeatures();
    this._overlay?.remove();
    this._overlay = null;
  },

  // ── Positioning ───────────────────────────────────────────
  _positionBox(step) {
    const spotlight = this._overlay.querySelector('#tut-spotlight');
    const box       = this._overlay.querySelector('#tut-box');

    if (!step.target) {
      spotlight.style.display = 'none';
      box.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);max-width:400px';
      return;
    }

    const el = document.querySelector(step.target);
    if (!el || !el.getBoundingClientRect || el.getBoundingClientRect().width === 0) {
      spotlight.style.display = 'none';
      box.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);max-width:400px';
      return;
    }

    const rect = el.getBoundingClientRect();
    const pad  = 8;
    spotlight.style.cssText =
      `display:block;top:${rect.top-pad}px;left:${rect.left-pad}px;` +
      `width:${rect.width+pad*2}px;height:${rect.height+pad*2}px`;

    const vw = window.innerWidth, vh = window.innerHeight;
    const bw = 340, bh = 300, mg = 14;
    let t, l;

    switch (step.position) {
      case 'right':
        l = Math.min(rect.right + mg, vw - bw - mg);
        t = Math.max(mg, Math.min(rect.top, vh - bh - mg));
        break;
      case 'bottom':
        t = Math.min(rect.bottom + mg, vh - bh - mg);
        l = Math.max(mg, Math.min(rect.left, vw - bw - mg));
        break;
      case 'top':
        t = Math.max(mg, rect.top - bh - mg);
        l = Math.max(mg, Math.min(rect.left, vw - bw - mg));
        break;
      default:
        box.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);max-width:400px';
        return;
    }

    box.style.cssText = `position:fixed;top:${t}px;left:${l}px;max-width:${bw}px;transform:none`;
    el.scrollIntoView({ block:'nearest', behavior:'smooth' });
  },
};
