// PIN-based admin auth per project (stored in sessionStorage)
const Auth = {
  _key(projectId) { return `tp_admin_${projectId}`; },

  isAdmin(projectId) {
    return sessionStorage.getItem(this._key(projectId)) === 'true';
  },

  login(projectId) {
    sessionStorage.setItem(this._key(projectId), 'true');
  },

  logout(projectId) {
    sessionStorage.removeItem(this._key(projectId));
  },

  async verify(projectId, pin) {
    const project = await DB.getProject(projectId);
    if (project.pin === pin) {
      this.login(projectId);
      return true;
    }
    return false;
  },
};
