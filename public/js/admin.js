if (!App.requireAuth()) throw new Error('Unauthorized');
if (!App.requireRole('ADMIN', 'DIRECAO', 'ORGANIZACAO')) throw new Error('Forbidden');

App.renderHeader('Painel Administrativo');

let eventosCache = [];

async function carregarEventos() {
  try {
    eventosCache = await App.api('/events');
    const options = eventosCache.map(e => `<option value="${e.id}">${App.escapeHtml(e.nome)} — ${App.formatDate(e.data)}</option>`).join('');

    ['evento-filtro', 'cert-evento', 'cert-lote-evento', 'rel-evento'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = id === 'evento-filtro'
        ? '<option value="">Selecione um evento</option>' + options
        : options;
    });

    carregarListaEventos();
  } catch (err) {
    console.error('Erro ao carregar eventos:', err);
    carregarListaEventos();
  }
}

async function carregarMetricas() {
  const eventoId = document.getElementById('evento-filtro').value;
  if (!eventoId) return;

  try {
    const metrics = await App.api(`/events/${eventoId}/metrics`);
    document.getElementById('kpi-grid').innerHTML = `
      <div class="kpi-card"><div class="kpi-value">${metrics.inscritos}</div><div class="kpi-label">Inscritos Confirmados</div></div>
      <div class="kpi-card"><div class="kpi-value">${metrics.presentes}</div><div class="kpi-label">Credenciados / Presentes</div></div>
      <div class="kpi-card"><div class="kpi-value">${metrics.trabalhos}</div><div class="kpi-label">Trabalhos Submetidos</div></div>
      <div class="kpi-card"><div class="kpi-value">${metrics.vagas_disponiveis}</div><div class="kpi-label">Vagas Disponíveis</div></div>
    `;
  } catch (err) { console.error(err); }
}

function togglePaymentFields() {
  const isPaid = document.getElementById('ev-is-paid').value === '1';
  document.getElementById('ev-valor-group').style.display = isPaid ? 'block' : 'none';
  document.getElementById('ev-pix-group').style.display = isPaid ? 'block' : 'none';
}

async function salvarEvento() {
  const id = document.getElementById('ev-id').value;
  const data = {
    nome: document.getElementById('ev-nome').value.trim(),
    data: document.getElementById('ev-data').value,
    hora_inicio: document.getElementById('ev-inicio').value,
    hora_fim: document.getElementById('ev-fim').value,
    vagas: parseInt(document.getElementById('ev-vagas').value),
    local: document.getElementById('ev-local').value.trim(),
    carga_horaria: parseInt(document.getElementById('ev-carga').value) || 0,
    descricao: document.getElementById('ev-descricao').value.trim(),
    ativo: document.getElementById('ev-ativo').value === '1',
    is_paid: document.getElementById('ev-is-paid').value === '1',
    valor: parseFloat(document.getElementById('ev-valor').value),
    pix_key: document.getElementById('ev-pix-key').value.trim()
  };

  try {
    if (id) {
      await App.api(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    } else {
      await App.api('/events', { method: 'POST', body: JSON.stringify(data) });
    }
    limparFormEvento();
    carregarEventos();
  } catch (err) {
    App.showAlert('evento-alert', err.message);
  }
}

function editarEvento(id) {
  const evento = eventosCache.find(e => e.id === id);
  if (!evento) return;

  document.getElementById('ev-id').value = evento.id;
  document.getElementById('ev-nome').value = evento.nome;
  document.getElementById('ev-data').value = evento.data;
  document.getElementById('ev-inicio').value = evento.hora_inicio;
  document.getElementById('ev-fim').value = evento.hora_fim;
  document.getElementById('ev-vagas').value = evento.vagas;
  document.getElementById('ev-local').value = evento.local || '';
  document.getElementById('ev-carga').value = evento.carga_horaria || 0;
  document.getElementById('ev-descricao').value = evento.descricao || '';
  document.getElementById('ev-ativo').value = evento.ativo ? '1' : '0';
  document.getElementById('ev-is-paid').value = evento.is_paid ? '1' : '0';
  document.getElementById('ev-valor').value = evento.valor || 0;
  document.getElementById('ev-pix-key').value = evento.pix_key || '';
  togglePaymentFields();
  document.getElementById('evento-form-title').textContent = 'Editar Evento';
}

async function excluirEvento(id) {
  if (!confirm('Tem certeza que deseja excluir este evento?\nTodas as inscrições e presenças serão removidas.')) return;
  try {
    await App.api(`/events/${id}`, { method: 'DELETE' });
    carregarEventos();
  } catch (err) {
    alert(err.message);
  }
}

function limparFormEvento() {
  document.getElementById('ev-id').value = '';
  ['ev-nome', 'ev-data', 'ev-inicio', 'ev-fim', 'ev-local', 'ev-descricao', 'ev-pix-key'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('ev-vagas').value = '0';
  document.getElementById('ev-carga').value = '0';
  document.getElementById('ev-ativo').value = '1';
  document.getElementById('ev-is-paid').value = '0';
  document.getElementById('ev-valor').value = '0';
  togglePaymentFields();
  document.getElementById('evento-form-title').textContent = 'Criar Novo Evento';
}

function carregarListaEventos() {
  const tbody = document.getElementById('lista-eventos');
  if (!tbody) return;

  if (!eventosCache || eventosCache.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-light);">Nenhum evento cadastrado.</td></tr>';
    return;
  }
  tbody.innerHTML = eventosCache.map(e => `
    <tr>
      <td>${App.escapeHtml(e.nome)}</td>
      <td>${App.formatDate(e.data)}</td>
      <td>${e.vagas}</td>
      <td>${e.is_paid
        ? `<span class="badge badge-warning">Pago R$ ${(e.valor || 0).toFixed(2)}</span>`
        : '<span class="badge badge-success">Gratuito</span>'}</td>
      <td><span class="badge ${e.ativo ? 'badge-success' : 'badge-danger'}">${e.ativo ? 'Ativo' : 'Inativo'}</span></td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="editarEvento(${e.id})">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="excluirEvento(${e.id})">Excluir</button>
      </td>
    </tr>
  `).join('');
}

async function gerarCertificado() {
  const evento_id = document.getElementById('cert-evento').value;
  const cpf = document.getElementById('cert-cpf').value.trim();
  if (!evento_id || !cpf) { alert('Selecione o evento e informe o CPF.'); return; }

  try {
    const response = await fetch('/api/reports/certificate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${App.getToken()}` },
      body: JSON.stringify({ evento_id: parseInt(evento_id), cpf })
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Erro ao gerar certificado.');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (err) {
    App.showAlert('cert-alert', err.message);
  }
}

async function gerarCertificadosLote() {
  const evento_id = document.getElementById('cert-lote-evento').value;
  if (!evento_id) { alert('Selecione um evento.'); return; }

  try {
    const response = await fetch('/api/reports/certificates/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${App.getToken()}` },
      body: JSON.stringify({ evento_id: parseInt(evento_id) })
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Erro ao gerar certificados.');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (err) {
    App.showAlert('cert-lote-alert', err.message);
  }
}

async function gerarRelatorioEvento() {
  const evento_id = document.getElementById('rel-evento').value;
  if (!evento_id) { alert('Selecione um evento.'); return; }

  try {
    const response = await fetch(`/api/reports/event/${evento_id}`, {
      headers: { 'Authorization': `Bearer ${App.getToken()}` }
    });
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (err) {
    alert(err.message);
  }
}

async function gerarRelatorioSemestral() {
  const ano = document.getElementById('sem-ano').value;
  const semestre = document.getElementById('sem-periodo').value;

  try {
    const response = await fetch('/api/reports/semester', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${App.getToken()}` },
      body: JSON.stringify({ ano: parseInt(ano), semestre: parseInt(semestre) })
    });
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (err) {
    App.showAlert('sem-alert', err.message);
  }
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
}

carregarEventos();