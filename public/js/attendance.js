if (!App.requireAuth()) throw new Error('Unauthorized');
if (!App.requireRole('MONITOR', 'ORGANIZACAO', 'ADMIN', 'DIRECAO')) throw new Error('Forbidden');

App.renderHeader('Portaria / Credenciamento');

let eventoSelecionado = null;
let eventoAtualIsPaid = false;
let eventosCache = [];
let statsTimer = null;

async function carregarEventos() {
  try {
    const eventos = await App.api('/events');
    eventosCache = eventos;
    const select = document.getElementById('evento-select');

    if (eventos.length === 0) {
      select.innerHTML = '<option value="">Nenhum evento disponível</option>';
      return;
    }

    select.innerHTML = '<option value="">Selecione o evento para credenciamento</option>' +
      eventos.map(e => `<option value="${e.id}">${e.nome} — ${App.formatDate(e.data)}${e.is_paid ? ' (PAGO R$ ' + (e.valor || 0).toFixed(2) + ')' : ''}</option>`).join('');

    select.addEventListener('change', () => {
      eventoSelecionado = select.value;
      const evento = eventos.find(e => e.id == eventoSelecionado);
      eventoAtualIsPaid = evento ? evento.is_paid : false;
      if (eventoSelecionado) {
        atualizarPainelEvento();
        iniciarAtualizacaoStats();
        carregarListaPresencas();
        carregarPagamentosPendentes();
      }
    });
  } catch (err) {
    App.showAlert('qr-alert', err.message);
  }
}

// ===== QR CODE (Leitor USB) =====
const qrInput = document.getElementById('qr-input');

qrInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const token = qrInput.value.trim();

    if (!token) return;

    if (!eventoSelecionado) {
      App.showAlert('qr-alert', 'Selecione um evento antes de escanear.', 'warning');
      qrInput.value = '';
      qrInput.focus();
      return;
    }

    try {
      const result = await App.api('/attendance/qr', {
        method: 'POST',
        body: JSON.stringify({ qr_token: token, evento_id: parseInt(eventoSelecionado) })
      });

      document.getElementById('ultima-presenca').innerHTML = `
        <div class="alert alert-success">
          ✅ <strong>${result.data.nome}</strong> — Presença registrada com sucesso!
        </div>
      `;

      qrInput.value = '';
      qrInput.focus();
      carregarListaPresencas();
      carregarPagamentosPendentes();
    } catch (err) {
      // Verificar se é bloqueio de pagamento
      if (err.message.includes('PAGAMENTO NÃO VALIDADO')) {
        document.getElementById('ultima-presenca').innerHTML = `
          <div class="alert alert-danger">
            🚫 <strong>BLOQUEADO:</strong> ${err.message}
          </div>
        `;
      } else {
        document.getElementById('ultima-presenca').innerHTML = `
          <div class="alert alert-error">❌ ${err.message}</div>
        `;
      }
      qrInput.value = '';
      qrInput.focus();
    }
  }
});

document.addEventListener('click', () => {
  if (document.getElementById('tab-qr').classList.contains('active')) {
    qrInput.focus();
  }
});

// ===== CÂMERA DO CELULAR (tela dividida: câmera em cima, dados embaixo) =====
let cameraScanner = null;
let cameraAtiva = false;
let usandoFrontal = false;
let ultimoTokenCamera = '';
let ultimoTokenCameraMs = 0;

// Painel de status grande da parte inferior (espelho do OLED do leitor físico)
function mostrarStatusCamera(tipo, titulo, detalhe) {
  const classes = { ok: 'status-ok', dup: 'status-dup', neg: 'status-neg', neutro: 'status-neutro' };
  document.getElementById('camera-resultado').innerHTML = `
    <div class="status-grande ${classes[tipo] || 'status-neutro'}">
      <div class="st-titulo">${titulo}</div>
      <div class="st-detalhe">${detalhe}</div>
    </div>
  `;
}

// Nome do evento no painel inferior
function atualizarPainelEvento() {
  const el = document.getElementById('camera-evento-nome');
  if (!el) return;
  const ev = eventosCache.find(e => e.id == eventoSelecionado);
  el.textContent = ev ? ev.nome : 'Selecione um evento';
}

// Contador Pres: X/Y Falt: Z — usa o endpoint de métricas (JWT)
async function atualizarStats() {
  if (!eventoSelecionado) return;
  try {
    const m = await App.api(`/events/${eventoSelecionado}/metrics`);
    const inscritos = m.inscritos || 0;
    const presentes = m.presentes || 0;
    const faltantes = Math.max(0, inscritos - presentes);
    const el = document.getElementById('camera-contador');
    if (el) el.textContent = `Pres: ${presentes}/${inscritos}  Falt: ${faltantes}`;
  } catch (err) { /* silencioso — painel mantém o último valor */ }
}

function iniciarAtualizacaoStats() {
  pararAtualizacaoStats();
  atualizarStats();
  statsTimer = setInterval(atualizarStats, 30000);
}

function pararAtualizacaoStats() {
  if (statsTimer) { clearInterval(statsTimer); statsTimer = null; }
}

async function iniciarCamera(frontal = usandoFrontal) {
  await pararCamera();

  if (typeof Html5Qrcode === 'undefined') {
    App.showAlert('camera-alert', 'Biblioteca de leitura não carregou. Verifique a internet e recarregue a página.');
    return;
  }

  try {
    cameraScanner = new Html5Qrcode('qr-reader');
    await cameraScanner.start(
      { facingMode: frontal ? 'user' : 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (texto) => processarLeituraCamera(texto),
      () => { /* quadro sem QR Code — ignora */ }
    );
    cameraAtiva = true;
    usandoFrontal = frontal;
    document.getElementById('camera-alert').innerHTML = '';

    // Rótulo do botão mostra para qual câmera ele alterna
    const btn = document.getElementById('btn-alternar-camera');
    if (btn) btn.textContent = frontal ? '🔄 Usar câmera traseira' : '🔄 Usar câmera frontal';
  } catch (err) {
    cameraScanner = null;
    let msg = 'Não foi possível acessar a câmera.';
    const nome = err && err.name ? err.name : '';
    if (nome === 'NotAllowedError') {
      msg = 'Permissão de câmera negada. Autorize o acesso nas configurações do navegador e tente novamente.';
    } else if (nome === 'NotFoundError' || nome === 'OverconstrainedError') {
      msg = 'Nenhuma câmera compatível encontrada neste dispositivo.';
    } else if (window.location.protocol !== 'https:' &&
               !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      msg = 'A câmera só funciona em página segura (HTTPS). Acesse pelo domínio Cloudflare ou configure HTTPS na rede local.';
    }
    App.showAlert('camera-alert', msg);
  }
}

async function pararCamera() {
  if (!cameraScanner || !cameraAtiva) return;
  try {
    await cameraScanner.stop();
    cameraScanner.clear();
  } catch (err) { /* câmera já liberada */ }
  cameraScanner = null;
  cameraAtiva = false;
}

// Alterna frontal/traseira: para a câmera atual e reinicia com a outra
async function alternarCamera() {
  await iniciarCamera(!usandoFrontal);
}

function processarLeituraCamera(tokenBruto) {
  const token = (tokenBruto || '').trim();
  if (!token) return;

  // Debounce: mesmo crachá lido nos últimos 5s é ignorado
  const agora = Date.now();
  if (token === ultimoTokenCamera && agora - ultimoTokenCameraMs < 5000) return;
  ultimoTokenCamera = token;
  ultimoTokenCameraMs = agora;

  if (!eventoSelecionado) {
    App.showAlert('camera-alert', 'Selecione um evento antes de escanear.', 'warning');
    return;
  }

  App.api('/attendance/qr', {
    method: 'POST',
    body: JSON.stringify({ qr_token: token, evento_id: parseInt(eventoSelecionado) })
  }).then(result => {
    mostrarStatusCamera('ok', 'AUTORIZADO', result.data.nome);
    if (navigator.vibrate) navigator.vibrate(200);
    atualizarStats();
    carregarListaPresencas();
    carregarPagamentosPendentes();
  }).catch(err => {
    if (err.message.includes('PAGAMENTO NÃO VALIDADO')) {
      mostrarStatusCamera('neg', 'NAO LIBERADO', 'Pagamento pendente — dirija-se à organização');
    } else if (err.message.includes('já registrada')) {
      mostrarStatusCamera('dup', 'JÁ REGISTRADO', 'Presença já registrada neste evento');
    } else {
      mostrarStatusCamera('neg', 'ERRO', err.message);
    }
    if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
  });
}

// ===== CPF Manual =====
async function registrarPorCpf() {
  const cpf = document.getElementById('cpf-input').value.trim();

  if (!cpf) {
    App.showAlert('cpf-alert', 'Digite o CPF do participante.');
    return;
  }

  if (!eventoSelecionado) {
    App.showAlert('cpf-alert', 'Selecione um evento antes de registrar.', 'warning');
    return;
  }

  try {
    const result = await App.api('/attendance/cpf', {
      method: 'POST',
      body: JSON.stringify({ cpf, evento_id: parseInt(eventoSelecionado) })
    });

    document.getElementById('cpf-resultado').innerHTML = `
      <div class="alert alert-success">
        ✅ <strong>${result.data.nome}</strong> — Presença registrada com sucesso!
      </div>
    `;
    document.getElementById('cpf-input').value = '';
    carregarListaPresencas();
    carregarPagamentosPendentes();
  } catch (err) {
    if (err.message.includes('PAGAMENTO NÃO VALIDADO')) {
      document.getElementById('cpf-resultado').innerHTML = `
        <div class="alert alert-danger">
          🚫 <strong>BLOQUEADO:</strong> ${err.message}
        </div>
      `;
    } else {
      document.getElementById('cpf-resultado').innerHTML = `
        <div class="alert alert-error">❌ ${err.message}</div>
      `;
    }
  }
}

// ===== Validação de Pagamentos =====
async function carregarPagamentosPendentes() {
  if (!eventoSelecionado) return;
  if (!eventoAtualIsPaid) {
    document.getElementById('lista-pagamentos').innerHTML =
      '<tr><td colspan="5" style="text-align:center;color:var(--text-light);">Este é um evento gratuito. Não há pagamentos para validar.</td></tr>';
    return;
  }

  try {
    const inscricoes = await App.api(`/registrations/event/${eventoSelecionado}`);
    const pendentes = inscricoes.filter(i => !i.pagamento_validado);
    const tbody = document.getElementById('lista-pagamentos');

    if (pendentes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-light);">Nenhum pagamento pendente. Todos validados!</td></tr>';
      return;
    }

    tbody.innerHTML = pendentes.map(i => `
      <tr>
        <td>${i.nome}</td>
        <td>${i.cpf}</td>
        <td style="font-size:0.85rem;max-width:200px;word-break:break-all;">${i.comprovante_pix || '—'}</td>
        <td><span class="badge badge-warning">Pendente</span></td>
        <td>
          <button class="btn btn-sm btn-success" onclick="validarPagamento(${i.id})">✅ Validar</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

async function validarPagamento(inscricaoId) {
  try {
    await App.api(`/registrations/${inscricaoId}/validate-payment`, { method: 'PUT' });
    App.showAlert('pagamentos-alert', 'Pagamento validado com sucesso! Credenciamento liberado.', 'success');
    carregarPagamentosPendentes();
  } catch (err) {
    App.showAlert('pagamentos-alert', err.message);
  }
}

// ===== Lista de Presenças =====
async function carregarListaPresencas() {
  if (!eventoSelecionado) return;

  try {
    const presencas = await App.api(`/attendance/event/${eventoSelecionado}`);
    const tbody = document.getElementById('lista-presencas');

    if (presencas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-light);">Nenhuma presença registrada ainda.</td></tr>';
      return;
    }

    const metodoLabel = {
      QR_CODE: 'QR Code',
      CPF_MANUAL: 'CPF Manual',
      QR_DEVICE: 'Leitor QR',
      QR_DEVICE_SYNC: 'Leitor QR (sync)'
    };
    const metodoBadge = {
      QR_CODE: 'badge-info',
      CPF_MANUAL: 'badge-warning',
      QR_DEVICE: 'badge-success',
      QR_DEVICE_SYNC: 'badge-success'
    };

    tbody.innerHTML = presencas.map(p => `
      <tr>
        <td>${p.nome}</td>
        <td>${p.cpf}</td>
        <td><span class="badge ${metodoBadge[p.metodo] || 'badge-info'}">${metodoLabel[p.metodo] || p.metodo}</span></td>
        <td>${p.credenciado_por || '—'}</td>
        <td>${p.data_hora}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

// ===== Tabs =====
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  event.target.classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');

  if (tab === 'qr') qrInput.focus();
  if (tab === 'lista') carregarListaPresencas();
  if (tab === 'pagamentos') carregarPagamentosPendentes();

  // Câmera: liga ao entrar na aba e desliga ao sair (libera a câmera)
  if (tab === 'camera') {
    iniciarCamera();
    iniciarAtualizacaoStats();
  } else {
    pararCamera();
    pararAtualizacaoStats();
  }
}

carregarEventos();