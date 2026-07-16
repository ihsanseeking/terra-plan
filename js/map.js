// Leaflet map management
const MapManager = {
  map: null,
  drawControl: null,
  layerGroups: {},      // layerId → L.LayerGroup
  featureLayers: {},    // featureId → L.Layer
  droneImageLayers: {}, // overlayId → L.ImageOverlay
  editableLayers: null,

  init(center, zoom) {
    this.map = L.map('map', { zoomControl: false }).setView(center, zoom);

    // Base tiles
    this._tiles = {
      osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 22,
      }),
      satellite: L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: '© Esri', maxZoom: 22 }
      ),
      hybrid: L.tileLayer(
        'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
        { attribution: '© Google', maxZoom: 22 }
      ),
    };
    this._tiles.osm.addTo(this.map);
    this._currentBase = 'osm';

    L.control.zoom({ position: 'topright' }).addTo(this.map);
    L.control.scale({ imperial: false }).addTo(this.map);

    this.editableLayers = new L.FeatureGroup();
    this.map.addLayer(this.editableLayers);
  },

  setBasemap(name) {
    if (this._tiles[this._currentBase]) {
      this.map.removeLayer(this._tiles[this._currentBase]);
    }
    if (this._tiles[name]) {
      this._tiles[name].addTo(this.map);
      this._currentBase = name;
    }
  },

  // ── Layer groups ─────────────────────────────────────────
  addLayerGroup(layerId) {
    if (!this.layerGroups[layerId]) {
      const group = L.layerGroup().addTo(this.map);
      this.layerGroups[layerId] = group;
    }
    return this.layerGroups[layerId];
  },

  removeLayerGroup(layerId) {
    if (this.layerGroups[layerId]) {
      this.map.removeLayer(this.layerGroups[layerId]);
      delete this.layerGroups[layerId];
    }
  },

  setLayerVisible(layerId, visible) {
    const group = this.layerGroups[layerId];
    if (!group) return;
    if (visible) this.map.addLayer(group);
    else this.map.removeLayer(group);
  },

  clearAllLayers() {
    Object.keys(this.layerGroups).forEach(id => {
      this.map.removeLayer(this.layerGroups[id]);
    });
    this.layerGroups = {};
    this.featureLayers = {};
    this.droneImageLayers = {};
    this.editableLayers.clearLayers();
  },

  // ── Render features ──────────────────────────────────────
  renderFeature(feature, layerId, isAdmin) {
    const style = getCategoryStyle(feature.category);
    const color = feature.color || style.color;
    const fillColor = feature.fill_color || style.fill;
    const opacity = feature.opacity ?? 0.5;

    let layer;
    const geo = feature.geojson;

    if (feature.type === 'polygon') {
      layer = L.geoJSON(geo, {
        style: { color, fillColor, weight: 2, opacity: 1, fillOpacity: opacity },
      });
    } else if (feature.type === 'polyline') {
      layer = L.geoJSON(geo, {
        style: { color, weight: 3, opacity: 0.9 },
      });
    } else if (feature.type === 'marker') {
      const coords = geo.type === 'Feature' ? geo.geometry.coordinates : geo.coordinates;
      const icon = this._makeIcon(color);
      layer = L.marker([coords[1], coords[0]], { icon, draggable: isAdmin });
    }

    if (!layer) return;

    // Popup
    const popupContent = this._buildPopup(feature);
    layer.bindPopup(popupContent);

    // Label
    if (feature.label) {
      layer.bindTooltip(feature.label, { permanent: true, direction: 'center', className: 'feature-label' });
    }

    // Click → select feature
    layer.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      App.selectFeature(feature.id);
    });

    const group = this.layerGroups[layerId] || this.addLayerGroup(layerId);
    layer.addTo(group);
    this.featureLayers[feature.id] = layer;
    return layer;
  },

  _makeIcon(color) {
    return L.divIcon({
      className: '',
      html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  },

  _buildPopup(feature) {
    let html = `<div class="popup-content"><strong>${feature.name || 'Tanpa nama'}</strong>`;
    if (feature.category && feature.category !== 'Default') html += `<br><span class="popup-cat">${feature.category}</span>`;
    if (feature.area_m2) html += `<br>Luas: <b>${Geo.formatAreaBoth(feature.area_m2)}</b>`;
    if (feature.length_m) html += `<br>Panjang: <b>${Geo.formatLength(feature.length_m)}</b>`;
    if (feature.label) html += `<br>Label: ${feature.label}`;
    html += '</div>';
    return html;
  },

  removeFeature(featureId) {
    const layer = this.featureLayers[featureId];
    if (layer) {
      Object.values(this.layerGroups).forEach(g => { try { g.removeLayer(layer); } catch {} });
      this.map.removeLayer(layer);
      delete this.featureLayers[featureId];
    }
  },

  updateFeatureStyle(featureId, color, fillColor, opacity) {
    const layer = this.featureLayers[featureId];
    if (!layer) return;
    if (layer.setStyle) layer.setStyle({ color, fillColor, fillOpacity: opacity });
  },

  fitFeature(featureId) {
    const layer = this.featureLayers[featureId];
    if (!layer) return;
    if (layer.getBounds) this.map.fitBounds(layer.getBounds(), { padding: [40, 40] });
    else if (layer.getLatLng) this.map.setView(layer.getLatLng(), 18);
  },

  // ── Drone overlays ───────────────────────────────────────
  renderDroneOverlay(overlay) {
    const bounds = overlay.bounds; // [[south,west],[north,east]]
    const imgLayer = L.imageOverlay(overlay.image_url, bounds, {
      opacity: overlay.opacity ?? 0.8,
      interactive: false,
    });

    const group = this.layerGroups[overlay.layer_id] || this.addLayerGroup(overlay.layer_id || 'drone');
    imgLayer.addTo(group);
    this.droneImageLayers[overlay.id] = imgLayer;
    return imgLayer;
  },

  removeDroneOverlay(overlayId) {
    const layer = this.droneImageLayers[overlayId];
    if (layer) {
      this.map.removeLayer(layer);
      Object.values(this.layerGroups).forEach(g => { try { g.removeLayer(layer); } catch {} });
      delete this.droneImageLayers[overlayId];
    }
  },

  // ── Shape editing ─────────────────────────────────────────
  startEditFeature(featureId) {
    const layer = this.featureLayers[featureId];
    if (!layer) return false;
    this._editingId = featureId;
    this._editingType = layer instanceof L.Marker ? 'marker' : 'path';

    if (this._editingType === 'marker') {
      // Markers are already draggable (created with draggable:true in admin mode)
      // Just give visual feedback
      if (layer.dragging) layer.dragging.enable();
      layer.setOpacity(0.7);
    } else {
      // Polygon or Polyline (L.GeoJSON / FeatureGroup)
      layer.eachLayer(l => {
        if (l.editing) {
          l.editing.enable();
          l.setStyle?.({ dashArray: '6 4', weight: 3 });
        }
      });
    }
    return true;
  },

  finishEditFeature() {
    const featureId = this._editingId;
    const layer = this.featureLayers[featureId];
    if (!layer) return null;

    let geo;
    if (this._editingType === 'marker') {
      if (layer.dragging) layer.dragging.disable();
      layer.setOpacity(1);
      geo = layer.toGeoJSON(); // Feature{Point}
    } else {
      layer.eachLayer(l => {
        if (l.editing) {
          l.editing.disable();
          l.setStyle?.({ dashArray: null });
        }
      });
      const fc = layer.toGeoJSON(); // FeatureCollection
      geo = fc.features?.[0] || fc;
    }

    this._editingId = null;
    this._editingType = null;
    return geo;
  },

  cancelEditFeature(originalFeature, isAdmin) {
    const featureId = this._editingId;
    const layer = this.featureLayers[featureId];
    if (layer) {
      if (this._editingType === 'marker') {
        if (layer.dragging) layer.dragging.disable();
        layer.setOpacity(1);
      } else {
        layer.eachLayer(l => {
          if (l.editing) {
            l.editing.disable();
            l.setStyle?.({ dashArray: null });
          }
        });
      }
      this.removeFeature(featureId);
    }
    this._editingId = null;
    this._editingType = null;
    if (originalFeature) {
      this.renderFeature(originalFeature, originalFeature.layer_id || '_default', isAdmin);
    }
  },

  // ── Drawing tools ────────────────────────────────────────
  enableDrawing(type, options = {}) {
    this.disableDrawing();
    const drawOptions = {
      shapeOptions: {
        color: options.color || '#3388ff',
        fillColor: options.fillColor || '#3388ff',
        fillOpacity: options.opacity ?? 0.4,
        weight: 2,
      },
    };

    let handler;
    if (type === 'polygon') {
      handler = new L.Draw.Polygon(this.map, drawOptions);
    } else if (type === 'polyline') {
      handler = new L.Draw.Polyline(this.map, {
        shapeOptions: { color: options.color || '#3388ff', weight: 3 },
      });
    } else if (type === 'marker') {
      handler = new L.Draw.Marker(this.map, {
        icon: this._makeIcon(options.color || '#3388ff'),
      });
    }

    if (handler) {
      handler.enable();
      this._activeHandler = handler;
    }
  },

  disableDrawing() {
    if (this._activeHandler) {
      this._activeHandler.disable();
      this._activeHandler = null;
    }
  },

  fitProject(center, zoom) {
    this.map.setView(center, zoom);
  },
};
