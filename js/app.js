// TerraPlan — Main application
const App = {
  state: {
    mode: 'landing',        // 'landing' | 'public' | 'admin'
    currentAdmin: null,     // admin object (session)
    viewAdmin: null,        // admin object (public view target)
    currentProject: null,
    isAdmin: false,
    layers: [],
    features: [],
    droneOverlays: [],
    activeLayerId: null,
    selectedFeatureId: null,
    drawMode: null,
  },

  // ── Boot ─────────────────────────────────────────────────
  async init() {
    MapManager.init(CONFIG.defaultCenter, CONFIG.defaultZoom);
    this._bindMapEvents();
    this._bindUIEvents();

    const route = Router.getMode();
    this.state.mode = route.mode;

    if (route.mode === 'public') {
      await this._initPublicView(route.slug);
    } else if (route.mode === 'admin') {
      await this._initAdminGate(route.slug);
    } else {
      this._initLanding();
    }

    Tutorial.autoStart();
  },

  // ── Landing ───────────────────────────────────────────────
  _initLanding() {
    UI.showPanel('landing');
    UI.setHeader(null, false, null);
    this._openMobileSidebar();
  },

  _openMobileSidebar() {
    const sb  = document.getElementById('sidebar');
    const fab = document.getElementById('fab-sidebar');
    sb?.classList.add('mobile-open');
    fab?.classList.add('open');
    if (fab) fab.querySelector('#fab-icon').textContent = '✕';
  },

  // ── Public view ───────────────────────────────────────────
  async _initPublicView(slug) {
    try {
      const admin = await DB.getAdminBySlug(slug);
      if (!admin) {
        UI.toast(`Workspace "${slug}" tidak ditemukan`, 'error');
        this._initLanding();
        return;
      }
      this.state.viewAdmin = admin;
      this.state.mode = 'public';
      UI.setHeader(null, false, admin);
      await this.loadProjectList();
      UI.showPanel('projects');
      this._openMobileSidebar();
      Tutorial.autoStart();
    } catch (e) {
      UI.toast('Gagal memuat workspace: ' + e.message, 'error');
      this._initLanding();
    }
  },

  // ── Admin gate (login or auto-resume session) ─────────────
  async _initAdminGate(slug) {
    const session = Auth.getSession();
    if (session && session.slug === slug) {
      // Resume existing session
      this.state.currentAdmin = session;
      this.state.isAdmin = true;
      UI.setHeader(null, true, session);
      await this.loadProjectList();
      UI.showPanel('projects');
      this._openMobileSidebar();
      Tutorial.autoStart();
    } else {
      // Show login for this slug
      UI.showPanel('admin-login');
      document.getElementById('login-slug-label').textContent = slug;
      document.getElementById('login-username').value = '';
      document.getElementById('login-password').value = '';
      this._openMobileSidebar();
      Tutorial.autoStart();
    }
  },

  // ── Auth actions ──────────────────────────────────────────
  async doLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    if (!username || !password) { UI.toast('Lengkapi username dan password', 'error'); return; }
    try {
      const admin = await Auth.login(username, password);
      this.state.currentAdmin = admin;
      this.state.isAdmin = true;
      this.state.mode = 'admin';
      Router.setURL('admin', admin.slug);
      UI.setHeader(null, true, admin);
      await this.loadProjectList();
      UI.showPanel('projects');
      this._openMobileSidebar();
      Tutorial.autoStart();
      UI.toast(`Selamat datang, ${admin.display_name || admin.username}!`, 'success');
    } catch (e) {
      UI.toast(e.message, 'error');
    }
  },

  async doRegister() {
    try {
      const admin = await Auth.register({
        username:     document.getElementById('reg-username').value.trim(),
        slug:         document.getElementById('reg-slug').value.trim(),
        displayName:  document.getElementById('reg-display').value.trim(),
        password:     document.getElementById('reg-password').value,
        confirmPassword: document.getElementById('reg-confirm').value,
        platformKey:  document.getElementById('reg-key').value.trim(),
      });
      this.state.currentAdmin = admin;
      this.state.isAdmin = true;
      this.state.mode = 'admin';
      UI.closeModal('modal-register');
      Router.setURL('admin', admin.slug);
      UI.setHeader(null, true, admin);
      await this.loadProjectList();
      UI.showPanel('projects');
      Tutorial.autoStart();
      UI.toast(`Akun berhasil dibuat! Selamat datang, ${admin.display_name || admin.username}`, 'success');
    } catch (e) {
      UI.toast(e.message, 'error');
    }
  },

  doLogout() {
    Auth.logout();
    this.state.currentAdmin = null;
    this.state.isAdmin = false;
    this.state.currentProject = null;
    this.state.mode = 'landing';
    Router.setURL(null, null);
    MapManager.clearAllLayers();
    this._initLanding();
    UI.toast('Berhasil keluar', 'info');
  },

  // ── Project list ──────────────────────────────────────────
  async loadProjectList() {
    try {
      MapManager.clearAllLayers();
      this.state.currentProject = null;

      let projects;
      if (this.state.isAdmin && this.state.currentAdmin) {
        projects = await DB.getAllProjectsByAdmin(this.state.currentAdmin.id);
      } else if (this.state.viewAdmin) {
        projects = await DB.getPublicProjectsByAdmin(this.state.viewAdmin.id);
      } else {
        projects = [];
      }

      UI.renderProjectList(projects, this.state.isAdmin);
      const admin = this.state.currentAdmin || this.state.viewAdmin;
      UI.setHeader(null, this.state.isAdmin, admin);
    } catch (e) {
      UI.toast('Gagal memuat proyek: ' + e.message, 'error');
    }
  },

  // ── Open project ──────────────────────────────────────────
  async openProject(id) {
    try {
      const project = await DB.getProject(id);
      this.state.currentProject = project;
      this.state.activeLayerId = null;
      this.state.selectedFeatureId = null;

      MapManager.clearAllLayers();
      MapManager.fitProject([project.center_lat, project.center_lng], project.zoom_level);

      await this._loadProjectData();
      const admin = this.state.currentAdmin || this.state.viewAdmin;
      UI.setHeader(project, this.state.isAdmin, admin);
      UI.showPanel('layers');
      this._closeMobileSidebar?.();
      Tutorial.autoStart();
    } catch (e) {
      UI.toast('Gagal membuka proyek: ' + e.message, 'error');
    }
  },

  async _loadProjectData() {
    const id = this.state.currentProject.id;
    [this.state.layers, this.state.features, this.state.droneOverlays] = await Promise.all([
      DB.getLayers(id), DB.getFeatures(id), DB.getDroneOverlays(id),
    ]);

    this.state.layers.forEach(l => {
      MapManager.addLayerGroup(l.id);
      if (!l.visible) MapManager.setLayerVisible(l.id, false);
    });
    this.state.features.forEach(f => MapManager.renderFeature(f, f.layer_id || '_default', this.state.isAdmin));
    this.state.droneOverlays.forEach(o => MapManager.renderDroneOverlay(o));

    UI.renderLayers(this.state.layers, this.state.isAdmin);
    UI.renderFeatures(this.state.features, this.state.layers, this.state.isAdmin);
    UI.renderDroneList(this.state.droneOverlays, this.state.isAdmin);
    UI.renderStats(this.state.features);
    UI.renderLegend(this.state.features);
  },

  // ── Project CRUD ──────────────────────────────────────────
  async saveProject(formData) {
    if (!this.state.isAdmin || !this.state.currentAdmin) return;
    try {
      const payload = {
        name: formData.name, description: formData.description,
        location: formData.location, status: formData.status,
        zoom_level: parseInt(formData.zoom_level),
        center_lat: parseFloat(formData.lat),
        center_lng: parseFloat(formData.lng),
        admin_id: this.state.currentAdmin.id,
      };

      if (formData.id) {
        await DB.updateProject(formData.id, payload);
        if (this.state.currentProject?.id === formData.id) {
          this.state.currentProject = { ...this.state.currentProject, ...payload };
          const admin = this.state.currentAdmin;
          UI.setHeader(this.state.currentProject, true, admin);
        }
        UI.toast('Proyek diperbarui', 'success');
      } else {
        const project = await DB.createProject(payload);
        UI.toast('Proyek dibuat', 'success');
        UI.closeModal('modal-project');
        await this.openProject(project.id);
        return;
      }
      UI.closeModal('modal-project');
      await this.loadProjectList();
    } catch (e) {
      UI.toast('Gagal menyimpan: ' + e.message, 'error');
    }
  },

  async deleteProject(id, e) {
    e?.stopPropagation();
    if (!confirm('Hapus proyek ini beserta semua datanya?')) return;
    try {
      await DB.deleteProject(id);
      UI.toast('Proyek dihapus', 'success');
      if (this.state.currentProject?.id === id) {
        this.state.currentProject = null;
      }
      await this.loadProjectList();
      UI.showPanel('projects');
    } catch (e) {
      UI.toast('Gagal menghapus: ' + e.message, 'error');
    }
  },

  // ── Share link ────────────────────────────────────────────
  async copyPublicLink() {
    const admin = this.state.currentAdmin;
    if (!admin) return;
    const link = Router.getPublicLink(admin.slug);
    try {
      await navigator.clipboard.writeText(link);
      UI.toast('Link publik disalin: ' + link, 'success', 5000);
    } catch {
      prompt('Copy link publik ini:', link);
    }
  },

  // ── Layers ────────────────────────────────────────────────
  async addLayer(name, color) {
    if (!this.state.isAdmin || !this.state.currentProject) return;
    try {
      const layer = await DB.createLayer({
        project_id: this.state.currentProject.id, name,
        color, fill_color: color, sort_order: this.state.layers.length,
      });
      this.state.layers.push(layer);
      MapManager.addLayerGroup(layer.id);
      UI.renderLayers(this.state.layers, true);
      this.state.activeLayerId = layer.id;
      UI.toast(`Layer "${name}" ditambahkan`, 'success');
    } catch (e) { UI.toast('Gagal tambah layer: ' + e.message, 'error'); }
  },

  setActiveLayer(layerId) {
    this.state.activeLayerId = layerId;
    document.querySelectorAll('.layer-item').forEach(el =>
      el.classList.toggle('active', el.dataset.id === layerId));
    const layer = this.state.layers.find(l => l.id === layerId);
    if (layer) UI.toast(`Layer aktif: ${layer.name}`, 'info');
  },

  async toggleLayerVisibility(layerId, btn) {
    const layer = this.state.layers.find(l => l.id === layerId);
    if (!layer) return;
    layer.visible = !layer.visible;
    MapManager.setLayerVisible(layerId, layer.visible);
    if (btn) btn.textContent = layer.visible ? '👁' : '🙈';
    if (this.state.isAdmin) await DB.updateLayer(layerId, { visible: layer.visible }).catch(() => {});
  },

  async deleteLayer(layerId) {
    const featuresInLayer = this.state.features.filter(f => f.layer_id === layerId);
    const confirmMsg = featuresInLayer.length
      ? `Hapus layer ini beserta ${featuresInLayer.length} fitur di dalamnya?`
      : 'Hapus layer ini?';
    if (!confirm(confirmMsg)) return;
    try {
      // Delete features in this layer from DB first
      await Promise.all(featuresInLayer.map(f => DB.deleteFeature(f.id)));
      featuresInLayer.forEach(f => MapManager.removeFeature(f.id));
      this.state.features = this.state.features.filter(f => f.layer_id !== layerId);

      await DB.deleteLayer(layerId);
      this.state.layers = this.state.layers.filter(l => l.id !== layerId);
      if (this.state.activeLayerId === layerId) this.state.activeLayerId = null;
      MapManager.removeLayerGroup(layerId);
      UI.renderLayers(this.state.layers, true);
      UI.renderFeatures(this.state.features, this.state.layers, true);
      UI.renderStats(this.state.features);
      UI.renderLegend(this.state.features);
      UI.toast('Layer dihapus', 'success');
    } catch (e) { UI.toast('Gagal hapus layer: ' + e.message, 'error'); }
  },

  // ── Features ──────────────────────────────────────────────
  selectFeature(featureId) {
    this.state.selectedFeatureId = featureId;
    const feature = this.state.features.find(f => f.id === featureId);
    if (!feature) return;
    MapManager.fitFeature(featureId);
    if (this.state.isAdmin) {
      UI.populateFeatureModal(feature, this.state.layers);
      document.getElementById('fm-id').value = feature.id;
      UI.openModal('modal-feature');
    }
  },

  async saveFeature(formData) {
    const id = formData.id;
    if (!id) return;
    const style = getCategoryStyle(formData.category);
    const payload = {
      name: formData.name, label: formData.label,
      category: formData.category,
      color: formData.color || style.color,
      fill_color: formData.fill || style.fill,
      opacity: parseFloat(formData.opacity),
      layer_id: formData.layer_id || null,
    };
    try {
      const updated = await DB.updateFeature(id, payload);
      const idx = this.state.features.findIndex(f => f.id === id);
      if (idx !== -1) this.state.features[idx] = { ...this.state.features[idx], ...updated };
      MapManager.removeFeature(id);
      MapManager.renderFeature(this.state.features[idx], updated.layer_id || '_default', true);
      UI.renderFeatures(this.state.features, this.state.layers, true);
      UI.renderStats(this.state.features);
      UI.renderLegend(this.state.features);
      UI.closeModal('modal-feature');
      UI.toast('Fitur diperbarui', 'success');
    } catch (e) { UI.toast('Gagal simpan: ' + e.message, 'error'); }
  },

  async deleteFeature(featureId, e) {
    e?.stopPropagation();
    if (!confirm('Hapus fitur ini?')) return;
    try {
      await DB.deleteFeature(featureId);
      this.state.features = this.state.features.filter(f => f.id !== featureId);
      MapManager.removeFeature(featureId);
      UI.renderFeatures(this.state.features, this.state.layers, true);
      UI.renderStats(this.state.features);
      UI.renderLegend(this.state.features);
      UI.closeModal('modal-feature');
      UI.toast('Fitur dihapus', 'success');
    } catch (e) { UI.toast('Gagal hapus: ' + e.message, 'error'); }
  },

  // ── Shape editing ─────────────────────────────────────────
  startShapeEdit(featureId) {
    const feature = this.state.features.find(f => f.id === featureId);
    if (!feature) return;
    this._editingOriginal = JSON.parse(JSON.stringify(feature));
    this.state.selectedFeatureId = featureId;
    UI.closeAllModals();
    MapManager.fitFeature(featureId);
    const ok = MapManager.startEditFeature(featureId);
    if (!ok) { UI.toast('Tidak bisa mengedit bentuk fitur ini', 'error'); return; }
    document.getElementById('edit-bar').style.display = 'flex';
    document.getElementById('edit-bar-name').textContent = feature.name || 'Tanpa nama';
    UI.toast('Drag titik-titik untuk mengubah bentuk', 'info', 4000);
  },

  async saveShapeEdit() {
    const featureId = this.state.selectedFeatureId;
    if (!featureId) return;
    const geo = MapManager.finishEditFeature();
    if (!geo) return;

    const feature = this.state.features.find(f => f.id === featureId);
    const area_m2  = feature?.type === 'polygon'  ? Geo.polygonArea(geo) : null;
    const length_m = feature?.type === 'polyline' ? Geo.lineLength(geo)  : null;

    try {
      const updated = await DB.updateFeature(featureId, { geojson: geo, area_m2, length_m });
      const idx = this.state.features.findIndex(f => f.id === featureId);
      if (idx !== -1) this.state.features[idx] = { ...this.state.features[idx], ...updated };
      // Re-render with updated shape
      MapManager.removeFeature(featureId);
      MapManager.renderFeature(this.state.features[idx], this.state.features[idx].layer_id || '_default', true);
      UI.renderFeatures(this.state.features, this.state.layers, true);
      document.getElementById('edit-bar').style.display = 'none';
      this._editingOriginal = null;
      const metric = area_m2 ? Geo.formatAreaBoth(area_m2) : length_m ? Geo.formatLength(length_m) : '';
      UI.toast(`Bentuk disimpan${metric ? ' — ' + metric : ''}`, 'success');
    } catch (e) {
      UI.toast('Gagal simpan bentuk: ' + e.message, 'error');
    }
  },

  cancelShapeEdit() {
    MapManager.cancelEditFeature(this._editingOriginal, true);
    this._editingOriginal = null;
    document.getElementById('edit-bar').style.display = 'none';
    UI.toast('Edit bentuk dibatalkan', 'info');
  },

  // ── Drawing ───────────────────────────────────────────────
  setDrawMode(mode) {
    if (!this.state.isAdmin) { UI.toast('Login admin terlebih dahulu', 'error'); return; }
    document.querySelectorAll('.draw-btn').forEach(b => b.classList.remove('active'));
    if (this.state.drawMode === mode) {
      this.state.drawMode = null;
      MapManager.disableDrawing();
      return;
    }
    this.state.drawMode = mode;
    document.querySelectorAll(`.draw-btn[data-mode="${mode}"]`).forEach(b => b.classList.add('active'));
    const color = this._getActiveLayerColor();
    MapManager.enableDrawing(mode, { color, fillColor: color, opacity: 0.4 });
    this._closeMobileSidebar?.();
  },

  _getActiveLayerColor() {
    if (this.state.activeLayerId) {
      const l = this.state.layers.find(l => l.id === this.state.activeLayerId);
      return l?.color || '#3388ff';
    }
    return '#3388ff';
  },

  async _onDrawCreated(e) {
    const { layer, layerType } = e;
    MapManager.disableDrawing();
    this.state.drawMode = null;
    document.querySelectorAll('.draw-btn').forEach(b => b.classList.remove('active'));

    const typeMap = { polygon: 'polygon', polyline: 'polyline', marker: 'marker' };
    const type = typeMap[layerType];
    if (!type || !this.state.currentProject) return;

    const geojson = layer.toGeoJSON();
    const area_m2  = type === 'polygon'  ? Geo.polygonArea(geojson) : null;
    const length_m = type === 'polyline' ? Geo.lineLength(geojson)  : null;
    const color = this._getActiveLayerColor();

    try {
      const feature = await DB.createFeature({
        project_id: this.state.currentProject.id,
        layer_id: this.state.activeLayerId || null,
        name: '', type, geojson, area_m2, length_m,
        category: 'Default', color, fill_color: color, opacity: 0.5,
      });
      this.state.features.push(feature);
      MapManager.renderFeature(feature, feature.layer_id || '_default', true);
      UI.renderFeatures(this.state.features, this.state.layers, true);
      UI.renderStats(this.state.features);
      UI.renderLegend(this.state.features);

      UI.populateFeatureModal(feature, this.state.layers);
      document.getElementById('fm-id').value = feature.id;
      UI.openModal('modal-feature');

      const msg = type === 'polygon'  ? `Luas: ${Geo.formatAreaBoth(area_m2)}` :
                  type === 'polyline' ? `Panjang: ${Geo.formatLength(length_m)}` : 'Marker ditambahkan';
      UI.toast(msg, 'success');
    } catch (e) {
      UI.toast('Gagal simpan: ' + e.message, 'error');
    }
  },

  // ── Drone overlays ────────────────────────────────────────
  _setDroneFile(file) {
    if (file.size > 20 * 1024 * 1024) { UI.toast('File terlalu besar (maks 20 MB)', 'error'); return; }
    this._droneFile = file;
    document.getElementById('drone-upload-hint').style.display    = 'none';
    document.getElementById('drone-upload-preview').style.display = '';
    document.getElementById('drone-preview-name').textContent = `${file.name} (${(file.size/1024/1024).toFixed(1)} MB)`;
    const reader = new FileReader();
    reader.onload = (e) => { document.getElementById('drone-preview-img').src = e.target.result; };
    reader.readAsDataURL(file);
  },

  _resetDroneUpload() {
    this._droneFile = null;
    document.getElementById('drone-file').value = '';
    document.getElementById('drone-upload-hint').style.display    = '';
    document.getElementById('drone-upload-preview').style.display = 'none';
    document.getElementById('drone-preview-img').src = '';
  },

  async addDroneOverlay(formData) {
    if (!this.state.isAdmin || !this.state.currentProject) return;
    try {
      let imageUrl = formData.image_url;

      // Upload file jika ada
      if (this._droneFile) {
        UI.toast('Mengupload gambar...', 'info', 10000);
        imageUrl = await DB.uploadDroneImage(this._droneFile, this.state.currentAdmin.id);
      }

      if (!imageUrl) { UI.toast('Pilih file atau masukkan URL gambar', 'error'); return; }

      const bounds = [
        [parseFloat(formData.south), parseFloat(formData.west)],
        [parseFloat(formData.north), parseFloat(formData.east)],
      ];
      const overlay = await DB.createDroneOverlay({
        project_id: this.state.currentProject.id,
        layer_id: this.state.activeLayerId || null,
        name: formData.name, image_url: imageUrl,
        bounds, opacity: parseFloat(formData.opacity) || 0.8,
      });
      this.state.droneOverlays.push(overlay);
      MapManager.renderDroneOverlay(overlay);
      UI.renderDroneList(this.state.droneOverlays, this.state.isAdmin);
      UI.closeModal('modal-drone');
      this._resetDroneUpload();
      UI.toast('Overlay drone ditambahkan', 'success');
    } catch (e) { UI.toast('Gagal tambah overlay: ' + e.message, 'error'); }
  },

  // ── Drone overlay delete ──────────────────────────────────
  async deleteDroneOverlay(id) {
    if (!confirm('Hapus overlay drone ini?')) return;
    try {
      await DB.deleteDroneOverlay(id);
      this.state.droneOverlays = this.state.droneOverlays.filter(o => o.id !== id);
      MapManager.removeDroneOverlay(id);
      UI.renderDroneList(this.state.droneOverlays, this.state.isAdmin);
      UI.toast('Overlay drone dihapus', 'success');
    } catch (e) { UI.toast('Gagal hapus overlay: ' + e.message, 'error'); }
  },

  // ── UI helpers ────────────────────────────────────────────
  captureMapCenter() {
    const c = MapManager.map.getCenter();
    document.getElementById('pm-lat').value = c.lat.toFixed(6);
    document.getElementById('pm-lng').value = c.lng.toFixed(6);
    document.getElementById('pm-zoom').value = MapManager.map.getZoom();
    UI.toast('Posisi peta disalin ke form', 'info');
  },

  // ── Event bindings ────────────────────────────────────────
  _bindMapEvents() {
    MapManager.map.on(L.Draw.Event.CREATED, (e) => this._onDrawCreated(e));
  },

  _bindUIEvents() {
    // ── Landing ──
    document.getElementById('btn-view-go').addEventListener('click', () => {
      const slug = document.getElementById('view-slug-input').value.trim();
      if (!slug) { UI.toast('Masukkan kode workspace', 'error'); return; }
      Router.setURL('view', slug);
      this._initPublicView(slug);
    });
    document.getElementById('view-slug-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-view-go').click();
    });
    document.getElementById('btn-goto-login').addEventListener('click', () => {
      UI.showPanel('admin-login');
      this._openMobileSidebar();
      Tutorial.autoStart();
    });
    document.getElementById('btn-goto-register').addEventListener('click', () => {
      this._clearRegisterForm();
      UI.openModal('modal-register');
    });

    // ── Admin login panel ──
    document.getElementById('btn-do-login').addEventListener('click', () => this.doLogin());
    document.getElementById('login-password').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.doLogin();
    });
    document.getElementById('btn-login-register').addEventListener('click', () => {
      this._clearRegisterForm();
      UI.openModal('modal-register');
    });
    document.getElementById('btn-login-back').addEventListener('click', () => {
      Router.setURL(null, null);
      this._initLanding();
    });

    // ── Register modal ──
    document.getElementById('btn-do-register').addEventListener('click', () => this.doRegister());
    // Auto-generate slug from username
    document.getElementById('reg-username').addEventListener('input', (e) => {
      const slugEl = document.getElementById('reg-slug');
      if (!slugEl._userEdited) {
        slugEl.value = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      }
    });
    document.getElementById('reg-slug').addEventListener('input', (e) => {
      e.target._userEdited = !!e.target.value;
    });

    // ── Header ──
    document.getElementById('btn-logout').addEventListener('click', () => {
      if (confirm('Keluar dari akun admin?')) this.doLogout();
    });
    document.getElementById('btn-share').addEventListener('click', () => this.copyPublicLink());
    document.getElementById('btn-help').addEventListener('click', () => Tutorial.start());
    document.getElementById('btn-fit-all').addEventListener('click', () => MapManager.fitAllFeatures());
    document.getElementById('btn-legend').addEventListener('click', () => UI.toggleLegend());
    document.getElementById('btn-legend-close').addEventListener('click', () => UI.toggleLegend());

    // ── Back to project list ──
    document.getElementById('btn-back').addEventListener('click', () => {
      this.state.currentProject = null;
      MapManager.clearAllLayers();
      const admin = this.state.currentAdmin || this.state.viewAdmin;
      UI.setHeader(null, this.state.isAdmin, admin);
      this.loadProjectList();
      UI.showPanel('projects');
      // Auto-open sidebar on mobile so project list is visible
      if (window.innerWidth <= 640) {
        const sb  = document.getElementById('sidebar');
        const fab = document.getElementById('fab-sidebar');
        sb?.classList.add('mobile-open');
        fab?.classList.add('open');
        if (fab) fab.querySelector('#fab-icon').textContent = '✕';
      }
    });

    // ── New/edit project ──
    document.getElementById('btn-new-project').addEventListener('click', () => {
      UI.populateProjectModal(null);
      UI.openModal('modal-project');
    });
    document.getElementById('btn-edit-project').addEventListener('click', () => {
      UI.populateProjectModal(this.state.currentProject);
      UI.openModal('modal-project');
    });
    document.getElementById('btn-project-save').addEventListener('click', () => {
      this.saveProject({
        id:           document.getElementById('pm-id').value,
        name:         document.getElementById('pm-name').value.trim(),
        description:  document.getElementById('pm-desc').value.trim(),
        location:     document.getElementById('pm-location').value.trim(),
        status:       document.getElementById('pm-status').value,
        zoom_level:   document.getElementById('pm-zoom').value,
        lat:          document.getElementById('pm-lat').value,
        lng:          document.getElementById('pm-lng').value,
      });
    });
    document.getElementById('btn-capture-center').addEventListener('click', () => this.captureMapCenter());

    // ── Layer ──
    document.getElementById('btn-add-layer').addEventListener('click', () => {
      document.getElementById('layer-name-input').value = '';
      document.getElementById('layer-color-input').value = '#3388ff';
      UI.openModal('modal-layer');
    });
    document.getElementById('btn-layer-save').addEventListener('click', () => {
      const name  = document.getElementById('layer-name-input').value.trim();
      const color = document.getElementById('layer-color-input').value;
      if (!name) { UI.toast('Masukkan nama layer', 'error'); return; }
      this.addLayer(name, color);
      UI.closeModal('modal-layer');
    });

    // ── Drawing toolbar ──
    document.querySelectorAll('.draw-btn').forEach(btn =>
      btn.addEventListener('click', () => this.setDrawMode(btn.dataset.mode)));

    // ── Feature modal ──
    document.getElementById('btn-feature-save').addEventListener('click', () => {
      this.saveFeature({
        id:       document.getElementById('fm-id').value,
        name:     document.getElementById('fm-name').value.trim(),
        label:    document.getElementById('fm-label').value.trim(),
        category: document.getElementById('fm-category').value,
        color:    document.getElementById('fm-color').value,
        fill:     document.getElementById('fm-fill').value,
        opacity:  document.getElementById('fm-opacity').value,
        layer_id: document.getElementById('fm-layer').value,
      });
    });
    document.getElementById('btn-feature-delete').addEventListener('click', () => {
      const id = document.getElementById('fm-id').value;
      if (id) { UI.closeModal('modal-feature'); this.deleteFeature(id); }
    });
    document.getElementById('fm-category').addEventListener('change', (e) => {
      const style = getCategoryStyle(e.target.value);
      document.getElementById('fm-color').value = style.color;
      document.getElementById('fm-fill').value  = style.fill;
    });

    // ── Drone overlay ──
    document.getElementById('btn-add-drone').addEventListener('click', () => {
      const bounds = MapManager.map.getBounds();
      document.getElementById('drone-name').value    = '';
      document.getElementById('drone-url').value     = '';
      document.getElementById('drone-opacity').value = '0.8';
      document.getElementById('drone-north').value   = bounds.getNorth().toFixed(6);
      document.getElementById('drone-south').value   = bounds.getSouth().toFixed(6);
      document.getElementById('drone-east').value    = bounds.getEast().toFixed(6);
      document.getElementById('drone-west').value    = bounds.getWest().toFixed(6);
      this._resetDroneUpload();
      UI.openModal('modal-drone');
    });

    // File picker via click or drag-drop
    const uploadArea = document.getElementById('drone-upload-area');
    const fileInput  = document.getElementById('drone-file');
    uploadArea.addEventListener('click', (e) => {
      if (!e.target.closest('#drone-upload-clear')) fileInput.click();
    });
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) this._setDroneFile(file);
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) this._setDroneFile(fileInput.files[0]);
    });
    document.getElementById('drone-upload-clear').addEventListener('click', () => this._resetDroneUpload());

    document.getElementById('btn-drone-save').addEventListener('click', () => {
      this.addDroneOverlay({
        name:      document.getElementById('drone-name').value.trim(),
        image_url: document.getElementById('drone-url').value.trim(),
        opacity:   document.getElementById('drone-opacity').value,
        north:     document.getElementById('drone-north').value,
        south:     document.getElementById('drone-south').value,
        east:      document.getElementById('drone-east').value,
        west:      document.getElementById('drone-west').value,
      });
    });

    // ── Basemap switcher ──
    document.querySelectorAll('.basemap-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.basemap-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        MapManager.setBasemap(btn.dataset.basemap);
      });
    });

    // ── Tabs ──
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById(`tab-${tab}`).classList.add('active');
      });
    });

    // ── Shape edit bar ──
    document.getElementById('btn-edit-save').addEventListener('click', () => this.saveShapeEdit());
    document.getElementById('btn-edit-cancel').addEventListener('click', () => this.cancelShapeEdit());

    // ── Close modals ──
    document.querySelectorAll('.modal-close, .btn-modal-cancel').forEach(btn =>
      btn.addEventListener('click', () => UI.closeAllModals()));

    // ── Mobile: FAB sidebar toggle ──
    const fab     = document.getElementById('fab-sidebar');
    const sidebar = document.getElementById('sidebar');
    fab?.addEventListener('click', () => {
      const isOpen = sidebar.classList.toggle('mobile-open');
      fab.classList.toggle('open', isOpen);
      fab.querySelector('#fab-icon').textContent = isOpen ? '✕' : '☰';
    });
    // Close sidebar when map tapped on mobile
    MapManager.map.on('click', () => {
      if (window.innerWidth <= 640 && sidebar.classList.contains('mobile-open')) {
        sidebar.classList.remove('mobile-open');
        fab.classList.remove('open');
        fab.querySelector('#fab-icon').textContent = '☰';
      }
    });
    // Auto-close sidebar when project opens on mobile (focus map)
    const _origOpenProject = this.openProject.bind(this);
    this._closeMobileSidebar = () => {
      sidebar.classList.remove('mobile-open');
      fab?.classList.remove('open');
      if (fab) fab.querySelector('#fab-icon').textContent = '☰';
    };
  },

  _clearRegisterForm() {
    ['reg-username','reg-slug','reg-display','reg-password','reg-confirm','reg-key']
      .forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('reg-slug')._userEdited = false;
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
