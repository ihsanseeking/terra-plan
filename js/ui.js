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
