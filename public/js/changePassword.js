// Verifica se está autenticado
if (!App.requireAuth()) throw new Error('Unauthorized');

async function trocarSenha() {
  const novaSenha = document.getElementById('nova-senha').value;
  const confirmar = document.getElementById('confirmar-senha').value;

  if (!novaSenha || !confirmar) {
    App.showAlert('cp-alert', 'Preencha os dois campos.');
    return;
  }

  if (novaSenha !== confirmar) {
    App.showAlert('cp-alert', 'As senhas não coincidem.');
    return;
  }

  if (novaSenha.length < 6) {
    App.showAlert('cp-alert', 'Senha deve ter no mínimo 6 caracteres.');
    return;
  }

  if (novaSenha === '123456') {
    App.showAlert('cp-alert', 'A nova senha não pode ser igual à senha padrão.');
    return;
  }

  try {
    const data = await App.api('/auth/force-change-password', {
      method: 'PUT',
      body: JSON.stringify({ novaSenha })
    });

    // Atualiza token e usuário no localStorage
    App.setAuth(data.token, data.user);

    // Redireciona baseado no perfil
    const user = data.user;
    const redirectMap = {
      'ADMIN': '/pages/admin.html',
      'DIRECAO': '/pages/admin.html',
      'ORGANIZACAO': '/pages/admin.html',
      'MONITOR': '/pages/monitor.html',
      'AVALIADOR': '/pages/evaluation.html'
    };

    window.location.href = redirectMap[user.perfil] || '/pages/portal.html';
  } catch (err) {
    App.showAlert('cp-alert', err.message);
  }
}

document.getElementById('confirmar-senha').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') trocarSenha();
});