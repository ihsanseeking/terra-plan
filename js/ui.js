// UI helpers: modals, toasts, panels, render functions
const UI = {
  // ── Toast ─────────────────────────────────────────────────
  toast(msg, type = 'info', duration = 3000) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast show ${type}`;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), duration);
  },

  // ── Modal ─────────────────────────────────────────────────
  openModal(id)    { document.getElementById(id)?.classList.add('open'); },
  closeModal(id)   { document.getElementById(id)?.classList.remove('open'); },
  closeAllModals() { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open')); },

  // ── Panel switching ───────────────────────────────────────
  showPanel(name) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`panel-${name}`)?.classList.add('active');
  },

  // ── Header ────────────────────────────────────────────────
  setHeader(project, isAdmin, adminObj) {
    const title = project ? project.name : (adminObj ? `${adminObj.display_name || adminObj.username}` : 'TerraPlan');
    document.getElementById('project-title').textContent = title;

    const badge = document.getElementById('mode-badge');
    badge.textContent = isAdmin ? 'ADMIN' : 'PUBLIK';
    badge.className   = `mode-badge ${isAdmin ? 'admin' : 'public'}`;

    document.getElementById('btn-admin-login').style.display  = isAdmin ? 'none' : '';
    document.getElementById('btn-logout').style.display       = isAdmin ? '' : 'none';
    document.getElementById('btn-share').style.display        = isAdmin ? '' : 'none';
    document.getElementById('btn-edit-project').style.display = (isAdmin && project) ? '' : 'none';
    document.getElementById('btn-add-drone').style.display    = (isAdmin && project) ? '' : 'none';
    document.getElementById('btn-new-project').style.display  = isAdmin ? '' : 'none';
    document.getElementById('btn-add-layer').style.display    = isAdmin ? '' : 'none';
    document.getElementById('drawing-toolbar').style.display  = (isAdmin && project) ? 'flex' : 'none';
    const fitBtn = document.getElementById('btn-fit-all');
    if (fitBtn) fitBtn.style.display = project ? '' : 'none';

    // Mobile-only action bars visibility
    const mobProjects = document.getElementById('mob-projects-actions');
    const mobLayers   = document.getElementById('mob-layers-actions');
    if (mobProjects) mobProjects.style.display = isAdmin ? '' : 'none';
    if (mobLayers)   mobLayers.style.display   = (isAdmin && project) ? '' : 'none';
  },

  // ── Project list ──────────────────────────────────────────
  renderProjectList(projects, isAdmin) {
    const list = document.getElementById('project-list');
    if (!projects.length) {
      list.innerHTML = '<p class="empty-msg">Belum ada proyek aktif.</p>';
      return;
    }
    list.innerHTML = projects.map(p => `
      <div class="project-card" data-id="${p.id}">
        <div class="project-card-header">
          <span class="project-status status-${p.status}">${p.status}</span>
          ${isAdmin ? `<button class="btn-icon" onclick="App.deleteProject('${p.id}',event)" title="Hapus">🗑</button>` : ''}
        </div>
        <div class="project-name">${p.name}</div>
        <div class="project-loc">${p.location || ''}</div>
        <div class="project-desc">${p.description || ''}</div>
      </div>
    `).join('');
    list.querySelectorAll('.project-card').forEach(card =>
      card.addEventListener('click', () => App.openProject(card.dataset.id)));
  },

  // ── Layer list ────────────────────────────────────────────
  renderLayers(layers, isAdmin) {
    const list = document.getElementById('layer-list');
    if (!layers.length) { list.innerHTML = '<p class="empty-msg">Belum ada layer.</p>'; return; }
    list.innerHTML = layers.map(l => `
      <div class="layer-item" data-id="${l.id}">
        <span class="layer-color" style="background:${l.color}"></span>
        <span class="layer-name">${l.name}</span>
        <div class="layer-actions">
          <button class="btn-icon" onclick="App.toggleLayerVisibility('${l.id}',this)">${l.visible ? '👁' : '🙈'}</button>
          ${isAdmin ? `
            <button class="btn-icon" onclick="App.setActiveLayer('${l.id}')" title="Aktifkan">✏️</button>
            <button class="btn-icon" onclick="App.deleteLayer('${l.id}')" title="Hapus">🗑</button>
          ` : ''}
        </div>
      </div>
    `).join('');
  },

  // ── Feature list ──────────────────────────────────────────
  renderFeatures(features, layers, isAdmin) {
    const list = document.getElementById('feature-list');
    if (!features.length) { list.innerHTML = '<p class="empty-msg">Belum ada area/jalur.</p>'; return; }
    const layerMap = Object.fromEntries(layers.map(l => [l.id, l]));
    list.innerHTML = features.map(f => {
      const color = f.color || layerMap[f.layer_id]?.color || '#3388ff';
      const icon  = f.type === 'polygon' ? '⬡' : f.type === 'polyline' ? '〰' : '📍';
      const metric = f.area_m2 ? Geo.formatArea(f.area_m2) : f.length_m ? Geo.formatLength(f.length_m) : '';
      return `
        <div class="feature-item" data-id="${f.id}">
          <span class="feature-dot" style="background:${color}">${icon}</span>
          <div class="feature-info">
            <div class="feature-name">${f.name || 'Tanpa nama'}</div>
            ${metric ? `<div class="feature-metric">${metric}</div>` : ''}
          </div>
          ${isAdmin ? `<button class="btn-icon del-feature" onclick="App.deleteFeature('${f.id}',event)">🗑</button>` : ''}
        </div>`;
    }).join('');
    list.querySelectorAll('.feature-item').forEach(el =>
      el.addEventListener('click', (e) => {
        if (e.target.closest('.del-feature')) return;
        App.selectFeature(el.dataset.id);
      }));
  },

  // ── Feature modal ─────────────────────────────────────────
  populateFeatureModal(feature, layers) {
    document.getElementById('fm-name').value    = feature.name  || '';
    document.getElementById('fm-label').value   = feature.label || '';
    document.getElementById('fm-color').value   = feature.color || '#3388ff';
    document.getElementById('fm-fill').value    = feature.fill_color || '#3388ff';
    document.getElementById('fm-opacity').value = feature.opacity ?? 0.5;

    document.getElementById('fm-category').innerHTML = ZONE_CATEGORIES.map(z =>
      `<option value="${z.label}" ${z.label === feature.category ? 'selected' : ''}>${z.label}</option>`).join('');

    document.getElementById('fm-layer').innerHTML =
      '<option value="">-- Tanpa Layer --</option>' +
      layers.map(l => `<option value="${l.id}" ${l.id === feature.layer_id ? 'selected' : ''}>${l.name}</option>`).join('');

    let stats = '';
    if (feature.area_m2)  stats += `<div>Luas: <b>${Geo.formatAreaBoth(feature.area_m2)}</b></div>`;
    if (feature.length_m) stats += `<div>Panjang: <b>${Geo.formatLength(feature.length_m)}</b></div>`;
    document.getElementById('fm-stats').innerHTML = stats;

    // Show/hide Edit Bentuk button (not for drone overlays)
    const btnEditShape = document.getElementById('btn-edit-shape');
    if (btnEditShape) {
      btnEditShape.style.display = '';
      btnEditShape.onclick = () => App.startShapeEdit(feature.id);
    }
  },

  // ── Project stats ─────────────────────────────────────────
  renderStats(features) {
    const el = document.getElementById('project-stats');
    if (!el) return;
    if (!features.length) { el.style.display = 'none'; return; }

    const totalArea = features.filter(f => f.type === 'polygon' && f.area_m2)
      .reduce((s, f) => s + f.area_m2, 0);
    const totalLen  = features.filter(f => f.type === 'polyline' && f.length_m)
      .reduce((s, f) => s + f.length_m, 0);
    const markerCt  = features.filter(f => f.type === 'marker').length;

    let html = '';
    if (totalArea)  html += `<div class="stat-item"><span class="stat-icon">⬡</span><b>${Geo.formatAreaBoth(totalArea)}</b></div>`;
    if (totalLen)   html += `<div class="stat-item"><span class="stat-icon">〰</span><b>${Geo.formatLength(totalLen)}</b></div>`;
    if (markerCt)   html += `<div class="stat-item"><span class="stat-icon">📍</span><b>${markerCt} titik</b></div>`;

    el.innerHTML   = html;
    el.style.display = html ? '' : 'none';
  },

  // ── Drone list ────────────────────────────────────────────
  renderDroneList(overlays, isAdmin) {
    const list   = document.getElementById('drone-list');
    const addWrap = document.getElementById('drone-add-wrap');
    if (addWrap) addWrap.style.display = isAdmin ? '' : 'none';
    if (!overlays.length) {
      list.innerHTML = '<p class="empty-msg">Belum ada overlay drone.</p>';
      return;
    }
    list.innerHTML = overlays.map(o => `
      <div class="drone-item" data-id="${o.id}">
        <div class="drone-thumb">${o.image_url ? `<img src="${o.image_url}" />` : '🛸'}</div>
        <div class="drone-info">
          <div class="drone-name">${o.name || 'Overlay Drone'}</div>
          <div class="drone-meta">Opasitas: ${o.opacity ?? 0.8}</div>
        </div>
        ${isAdmin ? `<button class="btn-icon" onclick="App.deleteDroneOverlay('${o.id}')" title="Hapus">🗑</button>` : ''}
      </div>`).join('');
  },

  // ── Map legend ────────────────────────────────────────────
  renderLegend(features) {
    const body = document.getElementById('legend-body');
    if (!body) return;

    // Collect unique categories used in this project
    const used = [...new Set(features.map(f => f.category).filter(Boolean))];
    if (!used.length) { document.getElementById('map-legend').style.display = 'none'; return; }

    body.innerHTML = used.map(cat => {
      const style = getCategoryStyle(cat);
      return `<div class="legend-item">
        <span class="legend-swatch" style="background:${style.fill};border-color:${style.color}"></span>
        <span>${cat}</span>
      </div>`;
    }).join('');
  },

  toggleLegend() {
    const legend = document.getElementById('map-legend');
    const btn    = document.getElementById('btn-legend');
    if (!legend) return;
    const show = legend.style.display === 'none';
    legend.style.display = show ? '' : 'none';
    btn?.classList.toggle('active', show);
  },

  // ── Project modal ─────────────────────────────────────────
  populateProjectModal(project) {
    document.getElementById('pm-id').value       = project?.id          || '';
    document.getElementById('pm-name').value     = project?.name        || '';
    document.getElementById('pm-desc').value     = project?.description || '';
    document.getElementById('pm-location').value = project?.location    || '';
    document.getElementById('pm-status').value   = project?.status      || 'draft';
    document.getElementById('pm-zoom').value     = project?.zoom_level  || 15;
    document.getElementById('pm-lat').value      = project?.center_lat  || CONFIG.defaultCenter[0];
    document.getElementById('pm-lng').value      = project?.center_lng  || CONFIG.defaultCenter[1];
  },
};
