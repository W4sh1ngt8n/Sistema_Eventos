const isLogged = App.isLoggedIn();
const currentUser = App.getUser();

// Perfis que podem ver a lista de trabalhos submetidos
const canViewWorksList = isLogged &&
  ['ORGANIZACAO', 'DIRECAO', 'ADMIN'].includes(currentUser.perfil);

// Perfis que podem acessar esta página autenticados
const allowedRoles = ['MONITOR', 'ORGANIZACAO', 'DIRECAO', 'ADMIN'];

if (isLogged) {
  if (!allowedRoles.includes(currentUser.perfil)) {
    // Avaliador ou outro perfil — redireciona
    window.location.href = '/';
    throw new Error('Acesso negado');
  }
  App.renderHeader('Submissão de Trabalhos');

  if (!canViewWorksList) {
    // Monitor logado — pode submeter mas NÃO vê a lista
    const notice = document.getElementById('public-notice');
    notice.style.display = 'block';
    notice.innerHTML = 'ℹ️ Como <strong>Monitor</strong>, você pode submeter trabalhos, mas não tem acesso à lista de trabalhos submetidos. A lista e a delegação de avaliadores são restritas à Organização e Direção.';
    document.getElementById('works-list-section').style.display = 'none';
  }
} else {
  // Acesso público — pode submeter, não vê a lista
  App.renderPublicHeader('Submissão de Trabalhos');
  document.getElementById('public-notice').style.display = 'block';
  document.getElementById('works-list-section').style.display = 'none';
}

let eventosCache = [];
let avaliadoresCache = [];
let trabalhosCache = [];

async function carregarEventos() {
  try {
    const eventos = await App.api('/events/active');
    eventosCache = eventos;
    const options = eventos.map(e =>
      `<option value="${e.id}">${App.escapeHtml(e.nome)} — ${App.formatDate(e.data)}</option>`
    ).join('');

    const selectWork = document.getElementById('work-evento');
    const selectFiltro = document.getElementById('work-filtro-evento');
    selectWork.innerHTML = '<option value="">Selecione o evento</option>' + options;
    if (selectFiltro) {
      selectFiltro.innerHTML = '<option value="">Todos os eventos</option>' + options;
    }

    if (canViewWorksList) carregarTrabalhos();
  } catch (err) {
    App.showAlert('work-alert', err.message);
  }
}

async function carregarAvaliadores() {
  if (!canViewWorksList) return;
  try {
    const users = await App.api('/users');
    avaliadoresCache = users.filter(u => u.perfil === 'AVALIADOR' && u.ativo);
  } catch (err) {
    console.error(err);
  }
}

async function submeterTrabalho() {
  const data = {
    evento_id: parseInt(document.getElementById('work-evento').value),
    cpf_autor: document.getElementById('work-cpf').value,
    titulo: document.getElementById('work-titulo').value.trim(),
    modalidade: document.getElementById('work-modalidade').value,
    link_arquivo: document.getElementById('work-link').value.trim()
  };

  if (!data.evento_id || !data.cpf_autor || !data.titulo || !data.modalidade || !data.link_arquivo) {
    App.showAlert('work-alert', 'Preencha todos os campos obrigatórios.');
    return;
  }

  try {
    await App.api('/works', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    App.showAlert('work-alert', 'Trabalho submetido com sucesso!', 'success');
    ['work-cpf', 'work-titulo', 'work-link'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('work-modalidade').value = '';
    if (canViewWorksList) carregarTrabalhos();
  } catch (err) {
    App.showAlert('work-alert', err.message);
  }
}

async function carregarTrabalhos() {
  if (!canViewWorksList) return;

  const eventoId = document.getElementById('work-filtro-evento').value;
  const tbody = document.getElementById('lista-trabalhos');

  try {
    let trabalhos = [];
    if (eventoId) {
      trabalhos = await App.api(`/works/event/${eventoId}`);
    } else {
      for (const ev of eventosCache) {
        const evTrabalhos = await App.api(`/works/event/${ev.id}`);
        trabalhos = trabalhos.concat(evTrabalhos);
      }
    }
    trabalhosCache = trabalhos;

    if (trabalhos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-light);">Nenhum trabalho submetido.</td></tr>';
      return;
    }

    const statusBadge = {
      'SUBMETIDO': 'badge-info',
      'EM_AVALIACAO': 'badge-warning',
      'AVALIADO': 'badge-success'
    };

    const canAssign = currentUser.perfil === 'ADMIN' ||
      currentUser.perfil === 'DIRECAO' || currentUser.perfil === 'ORGANIZACAO';

    tbody.innerHTML = trabalhos.map(t => `
      <tr>
        <td>#${t.id}</td>
        <td>${App.escapeHtml(t.titulo)}</td>
        <td>${App.escapeHtml((t.modalidade || '').replace(/_/g, ' '))}</td>
        <td>${App.escapeHtml(t.cpf_autor)}</td>
        <td><span class="badge ${statusBadge[t.status] || 'badge-info'}">${App.escapeHtml((t.status || '').replace(/_/g, ' '))}</span></td>
        <td>
          ${App.escapeHtml(t.avaliadores_nomes || '—')}
          ${canAssign
            ? `<br><button class="btn btn-sm btn-outline" style="margin-top:4px;" onclick="abrirModalAtribuir(${t.id})">+ Atribuir</button>`
            : ''}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    // Se 403, usuário não tem permissão
    if (err.message.includes('Autenticação') || err.message.includes('acesso')) {
      document.getElementById('works-list-section').style.display = 'none';
    }
    console.error(err);
  }
}

// Recebe apenas o ID e resolve o título do cache via textContent (imune a XSS)
function abrirModalAtribuir(trabalhoId) {
  const trabalho = trabalhosCache.find(t => t.id === trabalhoId);
  if (!trabalho) return;

  document.getElementById('atribuir-trabalho-id').value = trabalhoId;
  document.getElementById('atribuir-titulo').textContent = trabalho.titulo;

  const select = document.getElementById('select-avaliador');
  if (avaliadoresCache.length === 0) {
    select.innerHTML = '<option value="">Nenhum avaliador cadastrado</option>';
  } else {
    select.innerHTML = '<option value="">Selecione o avaliador</option>' +
      avaliadoresCache.map(a => `<option value="${a.id}">${App.escapeHtml(a.nome)} (${App.escapeHtml(a.email)})</option>`).join('');
  }

  document.getElementById('modal-atribuir').style.display = 'flex';
}

function fecharModalAtribuir() {
  document.getElementById('modal-atribuir').style.display = 'none';
}

async function confirmarAtribuicao() {
  const trabalhoId = parseInt(document.getElementById('atribuir-trabalho-id').value);
  const avaliadorId = parseInt(document.getElementById('select-avaliador').value);

  if (!avaliadorId) {
    const alertDiv = document.getElementById('atribuir-alert');
    alertDiv.innerHTML = '<div class="alert alert-error">Selecione um avaliador.</div>';
    return;
  }

  try {
    await App.api(`/works/${trabalhoId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ avaliador_id: avaliadorId })
    });

    fecharModalAtribuir();
    App.showAlert('work-alert', 'Avaliador atribuído com sucesso!', 'success');
    carregarTrabalhos();
  } catch (err) {
    const alertDiv = document.getElementById('atribuir-alert');
    alertDiv.innerHTML = `<div class="alert alert-error">${App.escapeHtml(err.message)}</div>`;
  }
}

carregarEventos();
if (canViewWorksList) carregarAvaliadores();