// All Supabase database operations
let _sb = null;

function getDb() {
  if (!_sb) _sb = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
  return _sb;
}

const DB = {
  // ── Projects ──────────────────────────────────────────────
  async getPublicProjects() {
    const { data, error } = await getDb()
      .from('projects')
      .select('*')
      .eq('status', 'aktif')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getAllProjects() {
    const { data, error } = await getDb()
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getProject(id) {
    const { data, error } = await getDb()
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async createProject(payload) {
    const { data, error } = await getDb()
      .from('projects')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateProject(id, payload) {
    const { data, error } = await getDb()
      .from('projects')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteProject(id) {
    const { error } = await getDb().from('projects').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Layers ────────────────────────────────────────────────
  async getLayers(projectId) {
    const { data, error } = await getDb()
      .from('layers')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data;
  },

  async createLayer(payload) {
    const { data, error } = await getDb()
      .from('layers')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateLayer(id, payload) {
    const { data, error } = await getDb()
      .from('layers')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteLayer(id) {
    const { error } = await getDb().from('layers').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Features ──────────────────────────────────────────────
  async getFeatures(projectId) {
    const { data, error } = await getDb()
      .from('features')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  },

  async createFeature(payload) {
    const { data, error } = await getDb()
      .from('features')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateFeature(id, payload) {
    const { data, error } = await getDb()
      .from('features')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteFeature(id) {
    const { error } = await getDb().from('features').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Drone Overlays ────────────────────────────────────────
  async getDroneOverlays(projectId) {
    const { data, error } = await getDb()
      .from('drone_overlays')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  },

  async createDroneOverlay(payload) {
    const { data, error } = await getDb()
      .from('drone_overlays')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateDroneOverlay(id, payload) {
    const { data, error } = await getDb()
      .from('drone_overlays')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteDroneOverlay(id) {
    const { error } = await getDb().from('drone_overlays').delete().eq('id', id);
    if (error) throw error;
  },
};
