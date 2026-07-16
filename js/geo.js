// Geographic calculations using Turf.js
const Geo = {
  // Area in m² from GeoJSON polygon feature
  polygonArea(geojsonFeature) {
    try { return turf.area(geojsonFeature); }
    catch { return 0; }
  },

  // Length in meters from GeoJSON linestring feature
  lineLength(geojsonFeature) {
    try { return turf.length(geojsonFeature, { units: 'meters' }); }
    catch { return 0; }
  },

  formatArea(m2) {
    if (m2 >= 10000) {
      return `${(m2 / 10000).toLocaleString('id-ID', { maximumFractionDigits: 4 })} ha`;
    }
    return `${m2.toLocaleString('id-ID', { maximumFractionDigits: 2 })} m²`;
  },

  formatLength(m) {
    if (m >= 1000) {
      return `${(m / 1000).toLocaleString('id-ID', { maximumFractionDigits: 3 })} km`;
    }
    return `${m.toLocaleString('id-ID', { maximumFractionDigits: 2 })} m`;
  },

  formatAreaBoth(m2) {
    const ha = m2 / 10000;
    return `${m2.toLocaleString('id-ID', { maximumFractionDigits: 2 })} m²  (${ha.toLocaleString('id-ID', { maximumFractionDigits: 4 })} ha)`;
  },
};
