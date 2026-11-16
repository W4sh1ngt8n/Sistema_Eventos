const API_URL = '/api';

const App = {
  getToken() {
    return localStorage.getItem('uniego_token');
  },

  getUser() {
    const userStr = localStorage.getItem('uniego_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  setAuth(token, user) {
    localStorage.setItem('uniego_token', token);
    localStorage.setItem('uniego_user', JSON.stringify(user));
  },

  logout() {
    localStorage.removeItem('uniego_token');
    localStorage.removeItem('uniego_user');
    window.location.href = '/';
  },

  async api(path, options = {}) {
    const token = this.getToken();
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_URL}${path}`, { ...options, headers });

    if (response.status === 401) {
      if (token) {
        // Havia token mas foi rejeitado — sessão expirou
        this.logout();
        return;
      }
      // Sem token enviado — não redireciona, apenas erro
      throw new Error('Autenticação necessária para esta operação.');
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/pdf')) {
      return response;
    }

    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error || 'Erro na requisição');
      // Anexa o corpo completo (ex.: already_registered + dados da inscrição existente)
      error.data = data;
      throw error;
    }
    return data;
  },

  requireAuth() {
    if (!this.getToken()) {
      window.location.href = '/';
      return false;
    }
    return true;
  },

  requireRole(...roles) {
    const user = this.getUser();
    if (!user || !roles.includes(user.perfil)) {
      window.location.href = '/';
      return false;
    }
    return true;
  },

  // Escapa HTML antes de interpolar em innerHTML (proteção contra XSS)
  escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  },

  formatarCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  },

  mascararCPF(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 11) value = value.substring(0, 11);
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    input.value = value;
  },

  mascararTelefone(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 11) value = value.substring(0, 11);
    if (value.length > 10) {
      value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (value.length > 6) {
      value = value.replace(/(\d{2})(\d{4})(\d)/, '($1) $2-$3');
    } else if (value.length > 2) {
      value = value.replace(/(\d{2})(\d)/, '($1) $2');
    }
    input.value = value;
  },

  showAlert(containerId, message, type = 'error') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `<div class="alert alert-${type}">${this.escapeHtml(message)}</div>`;
    if (type !== 'error') {
      setTimeout(() => { container.innerHTML = ''; }, 6000);
    }
  },

  formatDate(dateStr) {
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  },

  renderHeader(pageTitle) {
    const user = this.getUser();
    const header = document.getElementById('app-header');
    if (!header) return;

    header.innerHTML = `
      <h2>${pageTitle}</h2>
      <div class="user-info">
        <span>${this.escapeHtml(user.nome)} (${this.escapeHtml(user.perfil)})</span>
        <button class="btn btn-sm btn-outline" onclick="App.goToPortal()" style="color:white;border-color:rgba(255,255,255,0.3)">Portal</button>
        <button class="btn btn-sm btn-danger" onclick="App.logout()">Sair</button>
      </div>
    `;
  },

  renderPublicHeader(pageTitle) {
    const header = document.getElementById('app-header');
    if (!header) return;
    header.innerHTML = `
      <h2>${pageTitle}</h2>
      <div class="user-info">
        <a href="/" style="color:white;font-size:0.85rem;text-decoration:none;">Página Inicial</a>
      </div>
    `;
  },

  goToPortal() {
    window.location.href = '/pages/portal.html';
  }
};