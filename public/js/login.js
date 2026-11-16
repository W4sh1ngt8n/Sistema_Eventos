let intendedRole = null;
let intendedPage = null;

// Ao carregar, verifica se já existe admin
async function checkAdmin() {
  try {
    const data = await App.api('/auth/has-admin');
    if (data.hasAdmin) {
      // Oculta link de setup
      document.getElementById('setup-link-container').style.display = 'none';
    } else {
      // Mostra link de setup
      document.getElementById('setup-link-container').style.display = 'block';
    }
  } catch (err) {
    // Em caso de erro, mostra o link por segurança
    document.getElementById('setup-link-container').style.display = 'block';
  }
}

// ===== Acesso Livre =====
function accessFree() {
  window.location.href = '/pages/publicPortal.html';
}

// ===== Acesso por perfil =====
function accessRole(role, page) {
  intendedRole = role;
  intendedPage = page;

  const user = App.getUser();

  if (user) {
    if (user.perfil === role || user.perfil === 'ADMIN') {
      // Verifica se precisa trocar senha
      if (user.must_change_password) {
        window.location.href = '/pages/changePassword.html';
        return;
      }
      window.location.href = page;
    } else {
      document.getElementById('login-title').textContent = `Login — ${getRoleName(role)}`;
      App.showAlert('alert-container',
        `Você está logado como ${getRoleName(user.perfil)}. Esta área exige o perfil ${getRoleName(role)}. Faça login com outra conta.`,
        'warning');
      document.getElementById('login-modal').style.display = 'flex';
      document.getElementById('email').focus();
    }
  } else {
    document.getElementById('login-title').textContent = `Login — ${getRoleName(role)}`;
    document.getElementById('alert-container').innerHTML = '';
    document.getElementById('login-modal').style.display = 'flex';
    document.getElementById('email').focus();
  }
}

function getRoleName(role) {
  const names = {
    'MONITOR': 'Monitor',
    'AVALIADOR': 'Avaliador',
    'ORGANIZACAO': 'Organização',
    'DIRECAO': 'Direção',
    'ADMIN': 'Administrador'
  };
  return names[role] || role;
}

// ===== Login =====
async function fazerLogin() {
  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('senha').value;

  if (!email || !senha) {
    App.showAlert('alert-container', 'Preencha email e senha.');
    return;
  }

  try {
    const data = await App.api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha })
    });

    // Validar perfil
    if (intendedRole && data.user.perfil !== intendedRole && data.user.perfil !== 'ADMIN') {
      App.setAuth(data.token, data.user);
      App.showAlert('alert-container',
        `Login realizado, mas seu perfil é ${getRoleName(data.user.perfil)}. Esta área exige ${getRoleName(intendedRole)}.`,
        'warning');
      return;
    }

    App.setAuth(data.token, data.user);

    // Verifica troca obrigatória de senha
    if (data.user.must_change_password) {
      window.location.href = '/pages/changePassword.html';
      return;
    }

    window.location.href = intendedPage || '/pages/portal.html';
  } catch (err) {
    App.showAlert('alert-container', err.message);
  }
}

function cancelarLogin() {
  document.getElementById('login-modal').style.display = 'none';
  document.getElementById('email').value = '';
  document.getElementById('senha').value = '';
  document.getElementById('alert-container').innerHTML = '';
  intendedRole = null;
  intendedPage = null;
}

// ===== Setup =====
function mostrarSetup() {
  document.getElementById('login-modal').style.display = 'none';
  document.getElementById('setup-modal').style.display = 'flex';
}

function cancelarSetup() {
  document.getElementById('setup-modal').style.display = 'none';
}

async function fazerSetup() {
  const nome = document.getElementById('setup-nome').value.trim();
  const email = document.getElementById('setup-email').value.trim();
  const senha = document.getElementById('setup-senha').value;

  if (!nome || !email || !senha) {
    App.showAlert('setup-alert-container', 'Preencha todos os campos.');
    return;
  }

  if (senha.length < 6) {
    App.showAlert('setup-alert-container', 'Senha deve ter no mínimo 6 caracteres.');
    return;
  }

  try {
    const data = await App.api('/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ nome, email, senha })
    });

    App.showAlert('setup-alert-container', data.message, 'success');
    setTimeout(() => {
      cancelarSetup();
      document.getElementById('email').value = email;
      document.getElementById('senha').value = senha;
      intendedRole = 'ADMIN';
      intendedPage = '/pages/admin.html';
      document.getElementById('login-title').textContent = 'Login — Administrador';
      document.getElementById('login-modal').style.display = 'flex';
      // Oculta link de setup pois admin já existe
      document.getElementById('setup-link-container').style.display = 'none';
    }, 2000);
  } catch (err) {
    App.showAlert('setup-alert-container', err.message);
  }
}

document.getElementById('senha').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') fazerLogin();
});

// Inicializar
checkAdmin();