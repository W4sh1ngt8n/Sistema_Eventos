if (!App.requireAuth()) throw new Error('Unauthorized');
if (!App.requireRole('DIRECAO', 'ADMIN')) throw new Error('Forbidden');

App.renderHeader('Gestão de Usuários');

async function carregarUsuarios() {
  try {
    const users = await App.api('/users');
    const tbody = document.getElementById('lista-usuarios');

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-light);">Nenhum usuário cadastrado.</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(u => `
      <tr>
        <td>${App.escapeHtml(u.nome)}</td>
        <td>${App.escapeHtml(u.email)}</td>
        <td><span class="badge badge-info">${App.escapeHtml(u.perfil)}</span></td>
        <td><span class="badge ${u.ativo ? 'badge-success' : 'badge-danger'}">${u.ativo ? 'Ativo' : 'Inativo'}</span></td>
        <td>
          ${u.must_change_password
            ? '<span class="badge badge-warning">Pendente</span>'
            : '<span class="badge badge-success">Alterada</span>'}
        </td>
        <td>
          <button class="btn btn-sm btn-outline" onclick='editarUsuario(${App.escapeHtml(JSON.stringify(u))})'>Editar</button>
          ${App.getUser().perfil === 'ADMIN'
            ? `<button class="btn btn-sm btn-danger" onclick="excluirUsuario(${u.id})">Excluir</button>`
            : ''}
          <button class="btn btn-sm btn-warning" onclick="resetarSenha(${u.id})" title="Resetar para 123456">🔄 Resetar Senha</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    App.showAlert('user-alert', err.message);
  }
}

async function criarUsuario() {
  const data = {
    nome: document.getElementById('user-nome').value.trim(),
    email: document.getElementById('user-email').value.trim(),
    perfil: document.getElementById('user-perfil').value,
    cpf: document.getElementById('user-cpf').value
  };

  if (!data.nome || !data.email || !data.perfil) {
    App.showAlert('user-alert', 'Preencha todos os campos obrigatórios.');
    return;
  }

  try {
    const result = await App.api('/users', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    App.showAlert('user-alert',
      `Usuário cadastrado! Senha padrão: 123456. O usuário deverá alterá-la no primeiro acesso.`,
      'success');

    ['user-nome', 'user-email', 'user-cpf'].forEach(id => document.getElementById(id).value = '');
    carregarUsuarios();
  } catch (err) {
    App.showAlert('user-alert', err.message);
  }
}

function editarUsuario(user) {
  document.getElementById('edit-id').value = user.id;
  document.getElementById('edit-nome').value = user.nome;
  document.getElementById('edit-email').value = user.email;
  document.getElementById('edit-perfil').value = user.perfil;
  document.getElementById('edit-ativo').value = user.ativo ? '1' : '0';
  document.getElementById('edit-cpf').value = user.cpf || '';
  document.getElementById('modal-editar').style.display = 'flex';
}

function fecharModalEditar() {
  document.getElementById('modal-editar').style.display = 'none';
}

async function salvarEdicao() {
  const id = document.getElementById('edit-id').value;
  const data = {
    nome: document.getElementById('edit-nome').value.trim(),
    email: document.getElementById('edit-email').value.trim(),
    perfil: document.getElementById('edit-perfil').value,
    ativo: document.getElementById('edit-ativo').value === '1',
    cpf: document.getElementById('edit-cpf').value
  };

  try {
    await App.api(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    fecharModalEditar();
    App.showAlert('user-alert', 'Usuário atualizado com sucesso!', 'success');
    carregarUsuarios();
  } catch (err) {
    App.showAlert('user-alert', err.message);
  }
}

async function excluirUsuario(id) {
  if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
  try {
    await App.api(`/users/${id}`, { method: 'DELETE' });
    App.showAlert('user-alert', 'Usuário excluído com sucesso!', 'success');
    carregarUsuarios();
  } catch (err) {
    App.showAlert('user-alert', err.message);
  }
}

async function resetarSenha(id) {
  if (!confirm('Confirma o reset da senha para 123456? O usuário deverá alterá-la no próximo acesso.')) return;
  try {
    const result = await App.api(`/users/${id}/reset-password`, { method: 'PUT' });
    App.showAlert('user-alert', result.message, 'success');
    carregarUsuarios();
  } catch (err) {
    App.showAlert('user-alert', err.message);
  }
}

carregarUsuarios();