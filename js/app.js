// Main application state + event orchestration
const App = {
  state: {
    currentProject: null,
    isAdmin: false,
    layers: [],
    features: [],
    droneOverlays: [],
    activeLayerId: null,
    selectedFeatureId: null,
    drawMode: null,
    isGlobalAdmin: false, // can see all projects
  },

  // ── Boot ─────────────────────────────────────────────────
  async init() {
    MapManager.init(CONFIG.defaultCenter, CONFIG.defaultZoom);
    this._bindMapEvents();
    this._bindUIEvents();
    UI.showPanel('projects');
    await this.loadProjectList();
    Tutorial.autoStart();
  },

  async loadProjectList() {
    try {
      UI.showPanel('projects');
      MapManager.clearAllLayers();
      UI.setProjectHeader(null, false);

      const projects = this.state.isGlobalAdmin
        ? await DB.getAllProjects()
        : await DB.getPublicProjects();

      UI.renderProjectList(projects, this.state.isGlobalAdmin);
    } catch (e) {
      UI.toast('Gagal memuat proyek: ' + e.message, 'error');
    }
  },

  // ── Project ───────────────────────────────────────────────
  async openProject(id) {
    try {
      const project = await DB.getProject(id);
      this.state.currentProject = project;
      this.state.isAdmin = Auth.isAdmin(id);
      this.state.activeLayerId = null;
      this.state.selectedFeatureId = null;

      MapManager.clearAllLayers();
      MapManager.fitProject(
        [project.center_lat, project.center_lng],
        project.zoom_level
      );

      await this._loadProjectData();
      UI.setProjectHeader(project, this.state.isAdmin);
      UI.showPanel('layers');
    } catch (e) {
      UI.toast('Gagal membuka proyek: ' + e.message, 'error');
    }
  },

  async _loadProjectData() {
    const id = this.state.currentProject.id;
    [this.state.layers, this.state.features, this.state.droneOverlays] = await Promise.all([
      DB.getLayers(id),
      DB.getFeatures(id),
      DB.getDroneOverlays(id),
    ]);

    // Init layer groups
    this.state.layers.forEach(l => {
      MapManager.addLayerGroup(l.id);
      if (!l.visible) MapManager.setLayerVisible(l.id, false);
    });

    // Render features
    this.state.features.forEach(f => {
      MapManager.renderFeature(f, f.layer_id || '_default', this.state.isAdmin);
    });

    // Render drone overlays
    this.state.droneOverlays.forEach(o => MapManager.renderDroneOverlay(o));

    UI.renderLayers(this.state.layers, this.state.isAdmin);
    UI.renderFeatures(this.state.features, this.state.layers, this.state.isAdmin);
  },

  async saveProject(formData) {
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        location: formData.location,
        status: formData.status,
        pin: formData.pin,
        zoom_level: parseInt(formData.zoom_level),
        center_lat: parseFloat(formData.lat),
        center_lng: parseFloat(formData.lng),
      };

      if (formData.id) {
        await DB.updateProject(formData.id, payload);
        if (this.state.currentProject?.id === formData.id) {
          this.state.currentProject = { ...this.state.currentProject, ...payload };
          UI.setProjectHeader(this.state.currentProject, this.state.isAdmin);
        }
        UI.toast('Proyek diperbarui', 'success');
      } else {
        const project = await DB.createProject(payload);
        UI.toast('Proyek dibuat', 'success');
        await this.openProject(project.id);
      }

      UI.closeModal('modal-project');
      if (!formData.id) return;
      await this.loadProjectList();
    } catch (e) {
      UI.toast('Gagal menyimpan: ' + e.message, 'error');
    }
  },

  async deleteProject(id, e) {
    e && e.stopPropagation();
    if (!confirm('Hapus proyek ini beserta semua datanya?')) return;
    try {
      await DB.deleteProject(id);
      UI.toast('Proyek dihapus', 'success');
      if (this.state.currentProject?.id === id) {
        this.state.currentProject = null;
        await this.loadProjectList();
      } else {
        await this.loadProjectList();
      }
    } catch (e) {
      UI.toast('Gagal menghapus: ' + e.message, 'error');
    }
  },

  // ── Auth ──────────────────────────────────────────────────
  async verifyPin(pin) {
    const id = this.state.currentProject?.id;
    if (!id) return;
    try {
      const ok = await Auth.verify(id, pin);
      if (ok) {
        this.state.isAdmin = true;
        UI.setProjectHeader(this.state.currentProject, true);
        UI.renderLayers(this.state.layers, true);
        UI.renderFeatures(this.state.features, this.state.layers, true);
        UI.closeModal('modal-pin');
        UI.toast('Mode admin aktif', 'success');
      } else {
        UI.toast('PIN salah', 'error');
      }
    } catch (e) {
      UI.toast('Error: ' + e.message, 'error');
    }
  },

  logout() {
    if (!this.state.currentProject) return;
    Auth.logout(this.state.currentProject.id);
    this.state.isAdmin = false;
    MapManager.disableDrawing();
    this.state.drawMode = null;
    document.querySelectorAll('.draw-btn').forEach(b => b.classList.remove('active'));
    UI.setProjectHeader(this.state.currentProject, false);
    UI.renderLayers(this.state.layers, false);
    UI.renderFeatures(this.state.features, this.state.layers, false);
    UI.toast('Keluar dari mode admin', 'info');
  },

  // ── Global admin (see all projects) ──────────────────────
  async verifyGlobalAdmin(pin) {
    // Global admin PIN is hardcoded "terraadmin" or configurable
    if (pin === 'terraadmin' || pin === '0000') {
      this.state.isGlobalAdmin = true;
      sessionStorage.setItem('tp_global_admin', 'true');
      UI.closeModal('modal-global-pin');
      await this.loadProjectList();
      UI.toast('Mode admin global aktif', 'success');
    } else {
      UI.toast('PIN global salah', 'error');
    }
  },

  // ── Layers ────────────────────────────────────────────────
  async addLayer(name, color) {
    if (!this.state.currentProject || !this.state.isAdmin) return;
    try {
      const layer = await DB.createLayer({
        project_id: this.state.currentProject.id,
        name,
        color,
        fill_color: color,
        sort_order: this.state.layers.length,
      });
      this.state.layers.push(layer);
      MapManager.addLayerGroup(layer.id);
      UI.renderLayers(this.state.layers, true);
      this.state.activeLayerId = layer.id;
      UI.toast(`Layer "${name}" ditambahkan`, 'success');
    } catch (e) {
      UI.toast('Gagal tambah layer: ' + e.message, 'error');
    }
  },

  setActiveLayer(layerId) {
    this.state.activeLayerId = layerId;
    document.querySelectorAll('.layer-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === layerId);
    });
    const layer = this.state.layers.find(l => l.id === layerId);
    if (layer) UI.toast(`Layer aktif: ${layer.name}`, 'info');
  },

  async toggleLayerVisibility(layerId, btn) {
    const layer = this.state.layers.find(l => l.id === layerId);
    if (!layer) return;
    const newVisible = !layer.visible;
    layer.visible = newVisible;
    MapManager.setLayerVisible(layerId, newVisible);
    if (btn) btn.textContent = newVisible ? '👁' : '🙈';
    if (this.state.isAdmin) {
      await DB.updateLayer(layerId, { visible: newVisible }).catch(() => {});
    }
  },

  async deleteLayer(layerId) {
    if (!confirm('Hapus layer ini? Semua fitur di layer ini akan kehilangan referensi layer.')) return;
    try {
      await DB.deleteLayer(layerId);
      this.state.layers = this.state.layers.filter(l => l.id !== layerId);
      MapManager.removeLayerGroup(layerId);
      UI.renderLayers(this.state.layers, true);
      UI.toast('Layer dihapus', 'success');
    } catch (e) {
      UI.toast('Gagal hapus layer: ' + e.message, 'error');
    }
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
      name: formData.name,
      label: formData.label,
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
      MapManager.renderFeature(
        this.state.features[idx],
        updated.layer_id || '_default',
        true
      );
      UI.renderFeatures(this.state.features, this.state.layers, true);
      UI.closeModal('modal-feature');
      UI.toast('Fitur diperbarui', 'success');
    } catch (e) {
      UI.toast('Gagal simpan: ' + e.message, 'error');
    }
  },

  async deleteFeature(featureId, e) {
    e && e.stopPropagation();
    if (!confirm('Hapus fitur ini?')) return;
    try {
      await DB.deleteFeature(featureId);
      this.state.features = this.state.features.filter(f => f.id !== featureId);
      MapManager.removeFeature(featureId);
      UI.renderFeatures(this.state.features, this.state.layers, true);
      UI.toast('Fitur dihapus', 'success');
    } catch (e) {
      UI.toast('Gagal hapus: ' + e.message, 'error');
    }
  },

  // ── Drawing ───────────────────────────────────────────────
  setDrawMode(mode) {
    if (!this.state.isAdmin) { UI.toast('Masuk mode admin terlebih dahulu', 'error'); return; }

    document.querySelectorAll('.draw-btn').forEach(b => b.classList.remove('active'));
    if (this.state.drawMode === mode) {
      this.state.drawMode = null;
      MapManager.disableDrawing();
      return;
    }
    this.state.drawMode = mode;
    document.querySelector(`.draw-btn[data-mode="${mode}"]`)?.classList.add('active');

    const layerColor = this._getActiveLayerColor();
    MapManager.enableDrawing(mode, { color: layerColor, fillColor: layerColor, opacity: 0.4 });
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
    if (!type) return;

    const geojson = layer.toGeoJSON();
    let area_m2 = null, length_m = null;

    if (type === 'polygon') area_m2 = Geo.polygonArea(geojson);
    if (type === 'polyline') length_m = Geo.lineLength(geojson);

    const layerColor = this._getActiveLayerColor();
    const payload = {
      project_id: this.state.currentProject.id,
      layer_id: this.state.activeLayerId || null,
      name: '',
      type,
      geojson,
      area_m2,
      length_m,
      category: 'Default',
      color: layerColor,
      fill_color: layerColor,
      opacity: 0.5,
    };

    try {
      const feature = await DB.createFeature(payload);
      this.state.features.push(feature);
      MapManager.renderFeature(feature, feature.layer_id || '_default', true);
      UI.renderFeatures(this.state.features, this.state.layers, true);

      // Open edit modal immediately
      UI.populateFeatureModal(feature, this.state.layers);
      document.getElementById('fm-id').value = feature.id;
      UI.openModal('modal-feature');

      let msg = type === 'polygon' ? `Luas: ${Geo.formatAreaBoth(area_m2)}` :
                type === 'polyline' ? `Panjang: ${Geo.formatLength(length_m)}` : 'Marker ditambahkan';
      UI.toast(msg, 'success');
    } catch (e) {
      UI.toast('Gagal simpan: ' + e.message, 'error');
    }
  },

  // ── Drone overlays ────────────────────────────────────────
  async addDroneOverlay(formData) {
    if (!this.state.currentProject || !this.state.isAdmin) return;
    try {
      const bounds = [
        [parseFloat(formData.south), parseFloat(formData.west)],
        [parseFloat(formData.north), parseFloat(formData.east)],
      ];
      const payload = {
        project_id: this.state.currentProject.id,
        layer_id: this.state.activeLayerId || null,
        name: formData.name,
        image_url: formData.image_url,
        bounds,
        opacity: parseFloat(formData.opacity) || 0.8,
      };
      const overlay = await DB.createDroneOverlay(payload);
      this.state.droneOverlays.push(overlay);
      MapManager.renderDroneOverlay(overlay);
      UI.closeModal('modal-drone');
      UI.toast('Overlay drone ditambahkan', 'success');
    } catch (e) {
      UI.toast('Gagal tambah overlay: ' + e.message, 'error');
    }
  },

  // ── Map center capture ────────────────────────────────────
  captureMapCenter() {
    const c = MapManager.map.getCenter();
    const z = MapManager.map.getZoom();
    document.getElementById('pm-lat').value = c.lat.toFixed(6);
    document.getElementById('pm-lng').value = c.lng.toFixed(6);
    document.getElementById('pm-zoom').value = z;
    UI.toast('Posisi peta disalin ke form', 'info');
  },

  // ── Event bindings ────────────────────────────────────────
  _bindMapEvents() {
    MapManager.map.on(L.Draw.Event.CREATED, (e) => this._onDrawCreated(e));
    MapManager.map.on('click', () => {
      if (!this.state.drawMode) UI.closeAllModals();
    });
  },

  _bindUIEvents() {
    // Back to projects
    document.getElementById('btn-back').addEventListener('click', () => {
      this.state.currentProject = null;
      this.state.isAdmin = false;
      this.loadProjectList();
    });

    // Admin panel toggle
    document.getElementById('btn-admin').addEventListener('click', () => {
      document.getElementById('pin-input').value = '';
      UI.openModal('modal-pin');
    });

    document.getElementById('btn-logout').addEventListener('click', () => this.logout());

    // PIN submit
    document.getElementById('btn-pin-submit').addEventListener('click', () => {
      this.verifyPin(document.getElementById('pin-input').value.trim());
    });
    document.getElementById('pin-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.verifyPin(e.target.value.trim());
    });

    // Global admin
    document.getElementById('btn-global-admin').addEventListener('click', () => {
      document.getElementById('global-pin-input').value = '';
      UI.openModal('modal-global-pin');
    });
    document.getElementById('btn-global-pin-submit').addEventListener('click', () => {
      this.verifyGlobalAdmin(document.getElementById('global-pin-input').value.trim());
    });

    // New project
    document.getElementById('btn-new-project').addEventListener('click', () => {
      if (!this.state.isGlobalAdmin) { UI.toast('Masuk mode admin global dulu', 'error'); return; }
      UI.populateProjectModal(null);
      UI.openModal('modal-project');
    });

    // Edit project
    document.getElementById('btn-edit-project').addEventListener('click', () => {
      UI.populateProjectModal(this.state.currentProject);
      UI.openModal('modal-project');
    });

    // Project form submit
    document.getElementById('btn-project-save').addEventListener('click', () => {
      const f = document.getElementById('form-project');
      this.saveProject({
        id: document.getElementById('pm-id').value,
        name: document.getElementById('pm-name').value.trim(),
        description: document.getElementById('pm-desc').value.trim(),
        location: document.getElementById('pm-location').value.trim(),
        status: document.getElementById('pm-status').value,
        pin: document.getElementById('pm-pin').value.trim(),
        zoom_level: document.getElementById('pm-zoom').value,
        lat: document.getElementById('pm-lat').value,
        lng: document.getElementById('pm-lng').value,
      });
    });

    document.getElementById('btn-capture-center').addEventListener('click', () => this.captureMapCenter());

    // Add layer
    document.getElementById('btn-add-layer').addEventListener('click', () => {
      document.getElementById('layer-name-input').value = '';
      document.getElementById('layer-color-input').value = '#3388ff';
      UI.openModal('modal-layer');
    });

    document.getElementById('btn-layer-save').addEventListener('click', () => {
      const name = document.getElementById('layer-name-input').value.trim();
      const color = document.getElementById('layer-color-input').value;
      if (!name) { UI.toast('Masukkan nama layer', 'error'); return; }
      this.addLayer(name, color);
      UI.closeModal('modal-layer');
    });

    // Drawing toolbar
    document.querySelectorAll('.draw-btn').forEach(btn => {
      btn.addEventListener('click', () => this.setDrawMode(btn.dataset.mode));
    });

    // Feature modal save
    document.getElementById('btn-feature-save').addEventListener('click', () => {
      this.saveFeature({
        id: document.getElementById('fm-id').value,
        name: document.getElementById('fm-name').value.trim(),
        label: document.getElementById('fm-label').value.trim(),
        category: document.getElementById('fm-category').value,
        color: document.getElementById('fm-color').value,
        fill: document.getElementById('fm-fill').value,
        opacity: document.getElementById('fm-opacity').value,
        layer_id: document.getElementById('fm-layer').value,
      });
    });

    document.getElementById('btn-feature-delete').addEventListener('click', () => {
      const id = document.getElementById('fm-id').value;
      if (id) { UI.closeModal('modal-feature'); this.deleteFeature(id); }
    });

    // Drone overlay
    document.getElementById('btn-add-drone').addEventListener('click', () => {
      // Pre-fill bounds from current map view
      const bounds = MapManager.map.getBounds();
      document.getElementById('drone-name').value = '';
      document.getElementById('drone-url').value = '';
      document.getElementById('drone-opacity').value = '0.8';
      document.getElementById('drone-north').value = bounds.getNorth().toFixed(6);
      document.getElementById('drone-south').value = bounds.getSouth().toFixed(6);
      document.getElementById('drone-east').value = bounds.getEast().toFixed(6);
      document.getElementById('drone-west').value = bounds.getWest().toFixed(6);
      UI.openModal('modal-drone');
    });

    document.getElementById('btn-drone-save').addEventListener('click', () => {
      this.addDroneOverlay({
        name: document.getElementById('drone-name').value.trim(),
        image_url: document.getElementById('drone-url').value.trim(),
        opacity: document.getElementById('drone-opacity').value,
        north: document.getElementById('drone-north').value,
        south: document.getElementById('drone-south').value,
        east: document.getElementById('drone-east').value,
        west: document.getElementById('drone-west').value,
      });
    });

    // Basemap switcher
    document.querySelectorAll('.basemap-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.basemap-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        MapManager.setBasemap(btn.dataset.basemap);
      });
    });

    // Close modal buttons
    document.querySelectorAll('.modal-close, .btn-modal-cancel').forEach(btn => {
      btn.addEventListener('click', () => UI.closeAllModals());
    });

    // Tab switching inside layers panel
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById(`tab-${tab}`).classList.add('active');
      });
    });

    // Category auto-fill color
    document.getElementById('fm-category').addEventListener('change', (e) => {
      const style = getCategoryStyle(e.target.value);
      document.getElementById('fm-color').value = style.color;
      document.getElementById('fm-fill').value = style.fill;
    });

    // Help / tutorial button
    document.getElementById('btn-help').addEventListener('click', () => Tutorial.start());

    // Restore global admin from session
    if (sessionStorage.getItem('tp_global_admin') === 'true') {
      this.state.isGlobalAdmin = true;
    }
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
