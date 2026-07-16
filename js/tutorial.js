// TerraPlan — Interactive guided tour with live demo simulation
const Tutorial = {
  _step: 0,
  _overlay: null,
  _demoLayers: [],   // temp Leaflet layers for simulation
  _simRunning: false,

  // Demo GeoJSON (around Jakarta Selatan - Cilandak area)
  DEMO_DATA: {
    kavlingA: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [106.7998, -6.2891], [106.8018, -6.2891],
          [106.8018, -6.2907], [106.7998, -6.2907],
          [106.7998, -6.2891],
        ]],
      },
      properties: { name: 'Kavling A1', area: '1.847 m² (0,1847 ha)', category: 'Perumahan' },
    },
    kavlingB: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [106.8020, -6.2891], [106.8038, -6.2891],
          [106.8038, -6.2905], [106.8020, -6.2905],
          [106.8020, -6.2891],
        ]],
      },
      properties: { name: 'Kavling B1', area: '1.440 m² (0,1440 ha)', category: 'Perumahan' },
    },
    fasumBlock: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [106.7998, -6.2910], [106.8038, -6.2910],
          [106.8038, -6.2922], [106.7998, -6.2922],
          [106.7998, -6.2910],
        ]],
      },
      properties: { name: 'Area Fasilitas Umum', area: '3.200 m² (0,32 ha)', category: 'Fasilitas Umum' },
    },
    jalanUtama: {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [106.7993, -6.2899], [106.8042, -6.2899],
        ],
      },
      properties: { name: 'Jalan Akses Utama', length: '327 m', category: 'Jalan/Akses' },
    },
    jalanSub: {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [106.8008, -6.2891], [106.8008, -6.2924],
        ],
      },
      properties: { name: 'Jalan Sub-blok', length: '183 m', category: 'Jalan/Akses' },
    },
    gerbang: {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [106.7993, -6.2899] },
      properties: { name: 'Gerbang Utama', category: 'Titik Penting' },
    },
    taman: {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [106.8018, -6.2916] },
      properties: { name: 'Pos Keamanan', category: 'Titik Penting' },
    },
  },

  STEPS: [
    {
      id: 'welcome',
      title: '👋 Selamat datang di TerraPlan!',
      text: 'Platform pemetaan lahan digital untuk mengelola dan mempresentasikan proyek lahan kepada investor.<br><br>Tutorial ini akan memandu kamu dengan <b>simulasi langsung</b> di peta. Klik <b>Berikutnya</b> untuk mulai.',
      target: null, position: 'center',
    },
    {
      id: 'workspace',
      title: '🏠 Sistem Workspace',
      text: 'Setiap admin punya <b>workspace sendiri</b> dengan URL unik.<br><br>Contoh:<br>• Admin: <code>app.com?admin=budi</code><br>• Publik: <code>app.com?view=budi</code><br><br>Data tiap admin <b>terpisah sepenuhnya</b> — tidak bisa diakses admin lain.',
      target: '#panel-landing', position: 'right',
    },
    {
      id: 'landing',
      title: '🚪 Landing Page',
      text: 'Halaman ini tampil ketika URL dibuka tanpa parameter.<br><br>• <b>Lihat Peta Publik</b> → masukkan kode workspace untuk melihat peta investor<br>• <b>Login Admin</b> → kelola proyek dan gambar peta<br>• <b>Buat Akun</b> → daftar sebagai admin baru',
      target: '.landing-cards', position: 'right',
    },
    {
      id: 'share',
      title: '🔗 Bagikan Link Publik',
      text: 'Setelah login admin, klik tombol <b>🔗 Share</b> di header untuk menyalin link publik.<br><br>Link ini bisa dibagikan ke investor atau klien — mereka hanya bisa <b>melihat</b>, tidak bisa mengedit.',
      target: '#btn-share', position: 'bottom',
    },
    {
      id: 'projects',
      title: '📋 Daftar Proyek',
      text: 'Semua proyek lahan ditampilkan di sini.<br><br>• Status <b>Aktif</b> → terlihat oleh publik<br>• Status <b>Draft</b> → hanya terlihat admin<br>• Status <b>Arsip</b> → proyek selesai/tidak aktif<br><br>Klik kartu proyek untuk membuka petanya.',
      target: '#project-list', position: 'right',
    },
    {
      id: 'map-demo',
      title: '🗺 Peta Interaktif + Demo Langsung',
      text: 'Berikut contoh proyek lahan nyata di peta.<br><br>Perhatikan area yang muncul — ini menunjukkan <b>kavling, jalan akses, dan fasilitas umum</b> yang sudah dipetakan.',
      target: '#map', position: 'center',
      onEnter: 'showDemoFeatures',
    },
    {
      id: 'polygon-demo',
      title: '⬡ Polygon — Kavling & Zona',
      text: 'Dua <b>polygon kuning & merah</b> di peta adalah kavling perumahan.<br><br>Klik salah satunya untuk lihat:<br>• Nama area<br>• Kategori zona<br>• <b>Luas otomatis</b> (m² dan hektar)',
      target: '#map', position: 'right',
    },
    {
      id: 'polyline-demo',
      title: '〰 Jalur — Jalan & Akses',
      text: 'Garis <b>abu-abu</b> di peta adalah jalan akses utama dan sub-blok.<br><br>Panjang jalur dihitung otomatis dalam meter.<br><br>Fungsi ini berguna untuk menghitung kebutuhan pengaspalan, saluran drainase, dll.',
      target: '#map', position: 'right',
    },
    {
      id: 'marker-demo',
      title: '📍 Marker — Titik Penting',
      text: 'Titik <b>biru</b> menandai lokasi penting seperti gerbang masuk dan pos keamanan.<br><br>Marker bisa diberi nama, label, dan dikategorikan sesuai kebutuhan.',
      target: '#map', position: 'right',
    },
    {
      id: 'basemap',
      title: '🛰 Ganti Basemap',
      text: 'Pilih tampilan peta dasar sesuai kebutuhan:<br><br>• <b>Peta</b> — OpenStreetMap dengan nama jalan<br>• <b>Satelit</b> — foto udara resolusi tinggi<br>• <b>Hybrid</b> — satelit + label jalan<br><br>Mode satelit sangat berguna untuk melihat kondisi lahan sebenarnya.',
      target: '.basemap-group', position: 'bottom',
    },
    {
      id: 'drawing',
      title: '✏️ Toolbar Gambar (Mode Admin)',
      text: 'Setelah login admin, toolbar ini muncul di bawah peta:<br><br>• <b>⬡ Polygon</b> → klik sudut-sudut area, double-klik selesai<br>• <b>〰 Jalur</b> → klik titik jalur, double-klik selesai<br>• <b>📍 Titik</b> → klik lokasi untuk pasang marker<br><br>Setelah selesai, form edit terbuka otomatis.',
      target: '#drawing-toolbar', position: 'top',
    },
    {
      id: 'layers',
      title: '🗂 Manajemen Layer',
      text: 'Layer mengelompokkan area berdasarkan kategori:<br><br>• Klik <b>👁</b> untuk tampilkan/sembunyikan layer<br>• Klik <b>✏️</b> untuk set layer aktif (gambar baru masuk ke sini)<br>• Setiap layer punya warna sendiri yang diterapkan ke semua fiturnya',
      target: '#tab-layers', position: 'right',
    },
    {
      id: 'feature-edit',
      title: '✏️ Edit Fitur',
      text: 'Klik area/jalur/titik di peta untuk membuka panel edit:<br><br>• <b>Nama</b> — identifikasi area (misal: Kavling A1)<br>• <b>Label</b> — teks yang tampil langsung di peta<br>• <b>Zona</b> — Perumahan, Komersial, RTH, dll.<br>• <b>Warna & opasitas</b> — tampilan visual',
      target: '#feature-list', position: 'right',
    },
    {
      id: 'drone',
      title: '🛸 Overlay Foto Drone',
      text: 'Tempel <b>foto udara/drone</b> tepat di atas peta dengan koordinat yang akurat.<br><br>Sangat berguna untuk:<br>• Menampilkan kondisi lahan terkini ke investor<br>• Membandingkan batas kavling dengan kondisi nyata<br>• Presentasi masterplan visual',
      target: '#btn-add-drone', position: 'bottom',
    },
    {
      id: 'public-mode',
      title: '👁 Mode Publik untuk Investor',
      text: 'Bagikan link <code>?view=workspace</code> ke investor.<br><br>Mereka hanya bisa <b>melihat dan klik fitur</b> untuk lihat detail — tidak ada tombol edit, hapus, atau gambar.<br><br>Tampilan bersih dan profesional untuk presentasi.',
      target: '#mode-badge', position: 'bottom',
    },
    {
      id: 'finish',
      title: '🎉 Siap digunakan!',
      text: 'TerraPlan siap untuk dipresentasikan ke investor.<br><br>📌 <b>Ringkasan alur kerja:</b><br>1. Daftar akun admin<br>2. Buat proyek & layer<br>3. Gambar polygon/jalur/marker<br>4. Bagikan link <code>?view=slug</code> ke investor<br><br>Klik <b>?</b> kapan saja untuk membuka panduan ini.',
      target: null, position: 'center',
      onLeave: 'clearDemoFeatures',
    },
  ],

  // ── Start ─────────────────────────────────────────────────
  start() {
    this._step = 0;
    this._buildDOM();
    this._show();
    localStorage.setItem('tp_tutorial_seen', '1');
  },

  autoStart() {
    if (!localStorage.getItem('tp_tutorial_seen')) {
      setTimeout(() => this.start(), 900);
    }
  },

  // ── DOM ──────────────────────────────────────────────────
  _buildDOM() {
    document.getElementById('tutorial-overlay')?.remove();
    const el = document.createElement('div');
    el.id = 'tutorial-overlay';
    el.innerHTML = `
      <div id="tut-spotlight"></div>
      <div id="tut-box">
        <div id="tut-progress"></div>
        <div id="tut-title"></div>
        <div id="tut-text"></div>
        <div id="tut-footer">
          <button id="tut-skip">Lewati tutorial</button>
          <div id="tut-nav">
            <button id="tut-prev">← Sebelumnya</button>
            <button id="tut-next">Berikutnya →</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(el);

    this._overlay = el;
    el.querySelector('#tut-next').addEventListener('click',  () => this._next());
    el.querySelector('#tut-prev').addEventListener('click',  () => this._prev());
    el.querySelector('#tut-skip').addEventListener('click',  () => this.stop());
  },

  _show() {
    const step  = this.STEPS[this._step];
    const total = this.STEPS.length;

    // Progress dots
    this._overlay.querySelector('#tut-progress').innerHTML =
      this.STEPS.map((_, i) =>
        `<span class="tut-dot ${i === this._step ? 'active' : i < this._step ? 'done' : ''}"></span>`
      ).join('');

    this._overlay.querySelector('#tut-title').textContent   = step.title;
    this._overlay.querySelector('#tut-text').innerHTML      = step.text;

    const next = this._overlay.querySelector('#tut-next');
    const prev = this._overlay.querySelector('#tut-prev');
    prev.style.visibility    = this._step === 0 ? 'hidden' : '';
    next.textContent         = this._step === total - 1 ? '✓ Selesai' : 'Berikutnya →';
    this._overlay.querySelector('#tut-skip').textContent =
      this._step === total - 1 ? '' : 'Lewati tutorial';

    this._positionBox(step);

    // Trigger simulation
    if (step.onEnter) this[step.onEnter]?.();
  },

  _next() {
    // Run onLeave of final step
    if (this._step === this.STEPS.length - 1) { this.stop(); return; }
    const cur = this.STEPS[this._step];
    if (cur.onLeave) this[cur.onLeave]?.();
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
      box.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);max-width:420px';
      return;
    }

    const el = document.querySelector(step.target);
    if (!el || !el.offsetParent) {
      spotlight.style.display = 'none';
      box.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);max-width:420px';
      return;
    }

    const rect = el.getBoundingClientRect();
    const pad  = 8;
    spotlight.style.cssText =
      `display:block;top:${rect.top - pad}px;left:${rect.left - pad}px;` +
      `width:${rect.width + pad * 2}px;height:${rect.height + pad * 2}px`;

    const vw = window.innerWidth, vh = window.innerHeight;
    const bw = 340, bh = 280, mg = 16;
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
        box.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);max-width:420px';
        return;
    }

    box.style.cssText = `position:fixed;top:${t}px;left:${l}px;max-width:${bw}px;transform:none`;
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  },

  // ── Demo simulation ───────────────────────────────────────
  showDemoFeatures() {
    if (!MapManager.map || this._demoLayers.length) return;

    // Move map to demo area
    MapManager.map.setView([-6.2907, 106.8018], 16);

    const addWithDelay = (fn, delay) => setTimeout(() => {
      if (!this._overlay) return; // tutorial was closed
      const layer = fn();
      if (layer) this._demoLayers.push(layer);
    }, delay);

    // Kavling A — perumahan merah
    addWithDelay(() => {
      const d = this.DEMO_DATA.kavlingA;
      const l = L.geoJSON(d, {
        style: { color: '#e74c3c', fillColor: '#e74c3c', weight: 2, fillOpacity: 0.45 },
      }).bindPopup(`
        <div class="popup-content">
          <strong>${d.properties.name}</strong>
          <br><span class="popup-cat">${d.properties.category}</span>
          <br>Luas: <b>${d.properties.area}</b>
        </div>`).addTo(MapManager.map);
      return l;
    }, 300);

    // Kavling B — perumahan oranye
    addWithDelay(() => {
      const d = this.DEMO_DATA.kavlingB;
      const l = L.geoJSON(d, {
        style: { color: '#e67e22', fillColor: '#e67e22', weight: 2, fillOpacity: 0.45 },
      }).bindPopup(`
        <div class="popup-content">
          <strong>${d.properties.name}</strong>
          <br><span class="popup-cat">${d.properties.category}</span>
          <br>Luas: <b>${d.properties.area}</b>
        </div>`).addTo(MapManager.map);
      return l;
    }, 700);

    // Fasum — hijau
    addWithDelay(() => {
      const d = this.DEMO_DATA.fasumBlock;
      const l = L.geoJSON(d, {
        style: { color: '#27ae60', fillColor: '#27ae60', weight: 2, fillOpacity: 0.4 },
      }).bindPopup(`
        <div class="popup-content">
          <strong>${d.properties.name}</strong>
          <br><span class="popup-cat">${d.properties.category}</span>
          <br>Luas: <b>${d.properties.area}</b>
        </div>`).addTo(MapManager.map);
      return l;
    }, 1100);

    // Jalan utama — abu
    addWithDelay(() => {
      const d = this.DEMO_DATA.jalanUtama;
      const l = L.geoJSON(d, {
        style: { color: '#7f8c8d', weight: 4, opacity: 0.9 },
      }).bindPopup(`
        <div class="popup-content">
          <strong>${d.properties.name}</strong>
          <br><span class="popup-cat">${d.properties.category}</span>
          <br>Panjang: <b>${d.properties.length}</b>
        </div>`).addTo(MapManager.map);
      return l;
    }, 1500);

    // Jalan sub
    addWithDelay(() => {
      const d = this.DEMO_DATA.jalanSub;
      const l = L.geoJSON(d, {
        style: { color: '#95a5a6', weight: 3, opacity: 0.8 },
      }).bindPopup(`
        <div class="popup-content">
          <strong>${d.properties.name}</strong>
          <br><span class="popup-cat">${d.properties.category}</span>
          <br>Panjang: <b>${d.properties.length}</b>
        </div>`).addTo(MapManager.map);
      return l;
    }, 1800);

    // Gerbang marker
    addWithDelay(() => {
      const d = this.DEMO_DATA.gerbang;
      const icon = L.divIcon({
        className: '',
        html: '<div style="background:#3498db;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
        iconSize: [14, 14], iconAnchor: [7, 7],
      });
      const c = d.geometry.coordinates;
      const l = L.marker([c[1], c[0]], { icon })
        .bindPopup(`<div class="popup-content"><strong>${d.properties.name}</strong><br><span class="popup-cat">📍 Marker</span></div>`)
        .addTo(MapManager.map);
      return l;
    }, 2100);

    // Pos keamanan marker
    addWithDelay(() => {
      const d = this.DEMO_DATA.taman;
      const icon = L.divIcon({
        className: '',
        html: '<div style="background:#9b59b6;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
        iconSize: [14, 14], iconAnchor: [7, 7],
      });
      const c = d.geometry.coordinates;
      const l = L.marker([c[1], c[0]], { icon })
        .bindPopup(`<div class="popup-content"><strong>${d.properties.name}</strong><br><span class="popup-cat">📍 Marker</span></div>`)
        .addTo(MapManager.map);
      return l;
    }, 2400);

    // Open a popup after all layers loaded to show area data
    addWithDelay(() => {
      const d = this.DEMO_DATA.kavlingA;
      if (this._demoLayers[0]) this._demoLayers[0].openPopup();
      return null;
    }, 3000);
  },

  clearDemoFeatures() {
    this._demoLayers.forEach(l => { try { MapManager.map?.removeLayer(l); } catch {} });
    this._demoLayers = [];
  },
};
