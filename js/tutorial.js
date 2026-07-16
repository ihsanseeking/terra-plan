// TerraPlan — Interactive guided tour
const Tutorial = {
  _step: 0,
  _steps: [],
  _overlay: null,
  _box: null,
  _spotlight: null,

  STEPS: [
    {
      title: '👋 Selamat datang di TerraPlan!',
      text: 'Platform pemetaan lahan digital. Tutorial ini akan memandu kamu mengenal semua fitur dalam ~2 menit.<br><br>Klik <b>Berikutnya</b> untuk mulai.',
      target: null,
      position: 'center',
    },
    {
      title: '📋 Daftar Proyek',
      text: 'Di sini tampil semua proyek lahan yang berstatus <b>Aktif</b>.<br><br>Klik salah satu kartu proyek untuk membuka peta & data lahannya.',
      target: '#project-list',
      position: 'right',
    },
    {
      title: '🔐 Mode Admin Global',
      text: 'Tombol ini untuk masuk sebagai <b>Admin Global</b> — bisa melihat & mengelola semua proyek termasuk Draft dan Arsip.<br><br>PIN admin global: <code>terraadmin</code>',
      target: '#btn-global-admin',
      position: 'right',
    },
    {
      title: '➕ Buat Proyek Baru',
      text: 'Setelah login sebagai admin global, tombol ini aktif untuk membuat proyek lahan baru.<br><br>Isi nama, lokasi, status, dan PIN khusus proyek.',
      target: '#btn-new-project',
      position: 'right',
    },
    {
      title: '🗺 Peta Interaktif',
      text: 'Ini area peta utama. Kamu bisa:<br>• <b>Scroll</b> untuk zoom in/out<br>• <b>Drag</b> untuk geser peta<br>• <b>Klik fitur</b> di peta untuk lihat detail',
      target: '#map',
      position: 'center',
    },
    {
      title: '🛰 Ganti Basemap',
      text: 'Pilih tampilan peta dasar:<br>• <b>Peta</b> — OpenStreetMap standar<br>• <b>Satelit</b> — foto udara Esri<br>• <b>Hybrid</b> — satelit + label jalan',
      target: '.basemap-group',
      position: 'bottom',
    },
    {
      title: '🔑 Masuk Mode Admin Proyek',
      text: 'Setiap proyek punya PIN tersendiri. Klik tombol ini lalu masukkan PIN proyek untuk mengaktifkan mode admin.<br><br>Dalam mode admin kamu bisa menggambar, mengedit, dan mengelola data.',
      target: '#btn-admin',
      position: 'bottom',
    },
    {
      title: '⬡ Toolbar Gambar (Admin)',
      text: 'Setelah login admin proyek, toolbar ini muncul di bawah peta:<br><br>• <b>Polygon</b> — gambar area/kavling bebas<br>• <b>Jalur</b> — gambar jalan/akses<br>• <b>Titik</b> — tandai lokasi penting<br><br>Klik tombol → klik di peta untuk mulai menggambar.',
      target: '#drawing-toolbar',
      position: 'top',
      requireAdmin: true,
    },
    {
      title: '📐 Hitung Otomatis',
      text: 'Setelah menggambar, luas & panjang dihitung <b>otomatis</b>:<br><br>• Polygon → Luas dalam <b>m²</b> dan <b>hektar</b><br>• Jalur → Panjang dalam <b>meter</b> atau <b>km</b><br><br>Hasil langsung tersimpan ke database.',
      target: '#tab-features',
      position: 'right',
    },
    {
      title: '🗂 Manajemen Layer',
      text: 'Layer membantu mengelompokkan area berdasarkan kategori (Perumahan, Komersial, RTH, dll).<br><br>• Klik <b>👁</b> untuk sembunyikan/tampilkan layer<br>• Setiap layer punya warna sendiri<br>• Aktifkan layer sebelum menggambar',
      target: '#tab-layers',
      position: 'right',
    },
    {
      title: '✏️ Edit Fitur',
      text: 'Klik area/jalur/titik di peta (saat admin) untuk membuka panel edit:<br><br>• Beri nama & label di peta<br>• Pilih zona/kategori<br>• Ubah warna & opasitas<br>• Pindah ke layer lain',
      target: '#feature-list',
      position: 'right',
    },
    {
      title: '🛸 Overlay Foto Drone',
      text: 'Tempel foto udara/drone di atas peta. Masukkan URL gambar dan koordinat batasnya — foto akan muncul tepat di lokasi yang sesuai.',
      target: '#btn-add-drone',
      position: 'bottom',
      requireAdmin: true,
    },
    {
      title: '👁 Mode Publik (Investor)',
      text: 'Tanpa login admin, semua orang hanya bisa <b>melihat</b> peta — tidak bisa mengedit.<br><br>Bagikan URL aplikasi ini ke investor atau klien untuk presentasi lahan.',
      target: '#mode-badge',
      position: 'bottom',
    },
    {
      title: '🎉 Siap digunakan!',
      text: 'Itu semua fitur utama TerraPlan.<br><br>Butuh bantuan lagi? Klik tombol <b>?</b> di header kapan saja untuk membuka ulang panduan ini.<br><br>Selamat memetakan! 🗺',
      target: null,
      position: 'center',
    },
  ],

  start(fromBeginning = true) {
    this._step = 0;
    this._buildDOM();
    this._show();
    if (fromBeginning) localStorage.setItem('tp_tutorial_seen', '1');
  },

  // ── DOM ─────────────────────────────────────────────────
  _buildDOM() {
    // Remove existing if any
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
      </div>
    `;
    document.body.appendChild(el);

    this._overlay   = el;
    this._box       = el.querySelector('#tut-box');
    this._spotlight = el.querySelector('#tut-spotlight');

    el.querySelector('#tut-next').addEventListener('click', () => this._next());
    el.querySelector('#tut-prev').addEventListener('click', () => this._prev());
    el.querySelector('#tut-skip').addEventListener('click', () => this.stop());
    el.addEventListener('click', (e) => {
      if (e.target === el) this.stop();
    });
  },

  _show() {
    const step = this.STEPS[this._step];
    const total = this.STEPS.length;

    // Progress dots
    const progress = this._overlay.querySelector('#tut-progress');
    progress.innerHTML = this.STEPS.map((_, i) =>
      `<span class="tut-dot ${i === this._step ? 'active' : i < this._step ? 'done' : ''}"></span>`
    ).join('');

    this._overlay.querySelector('#tut-title').textContent = step.title;
    this._overlay.querySelector('#tut-text').innerHTML = step.text;

    // Nav buttons
    const prev = this._overlay.querySelector('#tut-prev');
    const next = this._overlay.querySelector('#tut-next');
    prev.style.visibility = this._step === 0 ? 'hidden' : '';
    next.textContent = this._step === total - 1 ? '✓ Selesai' : 'Berikutnya →';

    // Skip label
    this._overlay.querySelector('#tut-skip').textContent =
      this._step === total - 1 ? '' : 'Lewati tutorial';

    // Spotlight & position
    this._positionBox(step);
    this._overlay.style.display = 'block';
  },

  _positionBox(step) {
    const spotlight = this._spotlight;
    const box = this._box;

    if (!step.target) {
      // Center modal
      spotlight.style.display = 'none';
      box.style.position = 'fixed';
      box.style.top = '50%';
      box.style.left = '50%';
      box.style.transform = 'translate(-50%, -50%)';
      box.style.maxWidth = '400px';
      return;
    }

    const el = document.querySelector(step.target);
    if (!el) {
      spotlight.style.display = 'none';
      box.style.position = 'fixed';
      box.style.top = '50%';
      box.style.left = '50%';
      box.style.transform = 'translate(-50%, -50%)';
      return;
    }

    const rect = el.getBoundingClientRect();
    const pad = 8;

    // Spotlight
    spotlight.style.display = 'block';
    spotlight.style.top    = (rect.top - pad) + 'px';
    spotlight.style.left   = (rect.left - pad) + 'px';
    spotlight.style.width  = (rect.width + pad * 2) + 'px';
    spotlight.style.height = (rect.height + pad * 2) + 'px';

    // Box position
    box.style.transform = '';
    box.style.position = 'fixed';
    box.style.maxWidth = '320px';

    const boxW = 320;
    const boxH = 240; // estimated
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 16;

    const pos = step.position;

    if (pos === 'right') {
      box.style.left = Math.min(rect.right + margin, vw - boxW - margin) + 'px';
      box.style.top = Math.max(margin, Math.min(rect.top, vh - boxH - margin)) + 'px';
    } else if (pos === 'left') {
      box.style.left = Math.max(margin, rect.left - boxW - margin) + 'px';
      box.style.top = Math.max(margin, Math.min(rect.top, vh - boxH - margin)) + 'px';
    } else if (pos === 'bottom') {
      box.style.top = Math.min(rect.bottom + margin, vh - boxH - margin) + 'px';
      box.style.left = Math.max(margin, Math.min(rect.left, vw - boxW - margin)) + 'px';
    } else if (pos === 'top') {
      box.style.top = Math.max(margin, rect.top - boxH - margin) + 'px';
      box.style.left = Math.max(margin, Math.min(rect.left, vw - boxW - margin)) + 'px';
    } else {
      box.style.top = '50%';
      box.style.left = '50%';
      box.style.transform = 'translate(-50%, -50%)';
    }

    // Scroll element into view if needed
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  },

  _next() {
    if (this._step >= this.STEPS.length - 1) { this.stop(); return; }
    this._step++;
    // Skip steps that require admin if not admin
    const step = this.STEPS[this._step];
    if (step.requireAdmin && !App.state.isAdmin) {
      this._step++;
    }
    if (this._step >= this.STEPS.length) { this.stop(); return; }
    this._show();
  },

  _prev() {
    if (this._step <= 0) return;
    this._step--;
    this._show();
  },

  stop() {
    this._overlay?.remove();
    this._overlay = null;
  },

  // Auto-start on first visit
  autoStart() {
    if (!localStorage.getItem('tp_tutorial_seen')) {
      // Small delay so map is rendered first
      setTimeout(() => this.start(), 800);
    }
  },
};
