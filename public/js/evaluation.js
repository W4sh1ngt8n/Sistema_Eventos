if (!App.requireAuth()) throw new Error('Unauthorized');
if (!App.requireRole('AVALIADOR', 'ADMIN')) throw new Error('Forbidden');

App.renderHeader('Avaliação de Trabalhos');

let trabalhosCache = [];

async function carregarTrabalhos() {
  try {
    const trabalhos = await App.api('/works/my-evaluations');
    trabalhosCache = trabalhos;
    const tbody = document.getElementById('lista-trabalhos');

    if (trabalhos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-light);">Nenhum trabalho atribuído a você.</td></tr>';
      return;
    }

    const statusBadge = {
      'SUBMETIDO': 'badge-info',
      'EM_AVALIACAO': 'badge-warning',
      'AVALIADO': 'badge-success'
    };

    tbody.innerHTML = trabalhos.map(t => `
      <tr>
        <td>#${t.id}</td>
        <td>${App.escapeHtml(t.titulo)}</td>
        <td>${App.escapeHtml((t.modalidade || '').replace(/_/g, ' '))}</td>
        <td><span class="badge ${statusBadge[t.status] || 'badge-info'}">${App.escapeHtml((t.status || '').replace(/_/g, ' '))}</span></td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="abrirModal(${t.id})">Avaliar</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    App.showAlert('eval-alert', err.message);
  }
}

// Recebe apenas o ID e resolve o título do cache via textContent (seguro)
function abrirModal(id) {
  const trabalho = trabalhosCache.find(t => t.id === id);
  if (!trabalho) return;

  document.getElementById('trabalho-id').value = id;
  document.getElementById('modal-titulo').textContent = trabalho.titulo;
  document.getElementById('nota-input').value = '';
  document.getElementById('observacoes-input').value = '';
  document.getElementById('modal-avaliacao').style.display = 'flex';
}

function fecharModal() {
  document.getElementById('modal-avaliacao').style.display = 'none';
}

async function salvarAvaliacao() {
  const trabalho_id = parseInt(document.getElementById('trabalho-id').value);
  const nota = parseFloat(document.getElementById('nota-input').value);
  const observacoes = document.getElementById('observacoes-input').value.trim();

  if (isNaN(nota) || nota < 0 || nota > 10) {
    App.showAlert('eval-alert', 'Nota deve estar entre 0,0 e 10,0.');
    return;
  }

  try {
    await App.api('/evaluations', {
      method: 'POST',
      body: JSON.stringify({ trabalho_id, nota, observacoes })
    });
    fecharModal();
    App.showAlert('eval-alert', 'Avaliação registrada com sucesso!', 'success');
    carregarTrabalhos();
  } catch (err) {
    App.showAlert('eval-alert', err.message);
  }
}

carregarTrabalhos();