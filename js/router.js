// URL-based routing: ?view=slug | ?admin=slug | (landing)
const Router = {
  get params() { return new URLSearchParams(window.location.search); },

  getMode() {
    const p = this.params;
    if (p.has('view'))  return { mode: 'public', slug: p.get('view') };
    if (p.has('admin')) return { mode: 'admin',  slug: p.get('admin') };
    return { mode: 'landing', slug: null };
  },

  setURL(key, value) {
    const url = new URL(window.location.href);
    url.search = '';
    if (key && value) url.searchParams.set(key, value);
    window.history.pushState({}, '', url);
  },

  getPublicLink(slug) {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('view', slug);
    return url.toString();
  },

  getAdminLink(slug) {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('admin', slug);
    return url.toString();
  },

  async copyPublicLink(slug) {
    const link = this.getPublicLink(slug);
    try {
      await navigator.clipboard.writeText(link);
      return link;
    } catch {
      return link; // fallback: caller shows it in prompt
    }
  },
};
