const CONFIG = {
  supabaseUrl: 'https://mntdjssqtyquiwemqhhf.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1udGRqc3NxdHlxdWl3ZW1xaGhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxODg0MTIsImV4cCI6MjA5OTc2NDQxMn0.xEUU0th_cBZZM4qPskR5X4990u4330WsNO6i6suD_I0',
  defaultCenter: [-6.2, 106.816667],
  defaultZoom: 13,
};

const ZONE_CATEGORIES = [
  { label: 'Default',         color: '#3388ff', fill: '#3388ff' },
  { label: 'Perumahan',       color: '#e74c3c', fill: '#e74c3c' },
  { label: 'Komersial',       color: '#f39c12', fill: '#f39c12' },
  { label: 'Fasilitas Umum',  color: '#3498db', fill: '#3498db' },
  { label: 'RTH/Taman',       color: '#27ae60', fill: '#27ae60' },
  { label: 'Industri',        color: '#8e44ad', fill: '#8e44ad' },
  { label: 'Jalan/Akses',     color: '#7f8c8d', fill: '#7f8c8d' },
  { label: 'Kavling',         color: '#e67e22', fill: '#e67e22' },
];

function getCategoryStyle(category) {
  const found = ZONE_CATEGORIES.find(z => z.label === category);
  return found || ZONE_CATEGORIES[0];
}
