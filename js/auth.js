// Multi-admin auth — SHA-256 password hashing via Web Crypto
const Auth = {
  _SESSION_KEY: 'tp_admin_session',
  PLATFORM_KEY: 'TERRAPLAN2024', // required to register a new admin account

  // ── Hashing ──────────────────────────────────────────────
  async sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  // ── Session ───────────────────────────────────────────────
  getSession() {
    try { return JSON.parse(sessionStorage.getItem(this._SESSION_KEY)) || null; }
    catch { return null; }
  },

  isLoggedIn() { return !!this.getSession(); },

  _saveSession(admin) {
    sessionStorage.setItem(this._SESSION_KEY, JSON.stringify({
      id: admin.id, username: admin.username,
      slug: admin.slug, display_name: admin.display_name,
    }));
  },

  logout() { sessionStorage.removeItem(this._SESSION_KEY); },

  // ── Login ─────────────────────────────────────────────────
  async login(username, password) {
    const hash = await this.sha256(password);
    const admin = await DB.getAdminByUsername(username);
    if (!admin) throw new Error('Username tidak ditemukan');
    if (admin.password_hash !== hash) throw new Error('Password salah');
    this._saveSession(admin);
    return admin;
  },

  // ── Register ──────────────────────────────────────────────
  async register({ username, slug, displayName, password, confirmPassword, platformKey }) {
    if (platformKey !== this.PLATFORM_KEY) throw new Error('Platform key salah');
    if (password !== confirmPassword) throw new Error('Konfirmasi password tidak cocok');
    if (password.length < 6) throw new Error('Password minimal 6 karakter');
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('Slug hanya boleh huruf kecil, angka, dan tanda -');
    if (!username.trim()) throw new Error('Username tidak boleh kosong');

    const password_hash = await this.sha256(password);
    const admin = await DB.createAdmin({ username: username.trim(), slug: slug.trim(), display_name: displayName.trim(), password_hash });
    this._saveSession(admin);
    return admin;
  },
};
