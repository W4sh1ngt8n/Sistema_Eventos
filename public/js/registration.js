let selectedEvent = null;

async function carregarEventosPublicos() {
  try {
    const eventos = await App.api('/events/active');
    const select = document.getElementById('reg-evento');

    if (!eventos || eventos.length === 0) {
      select.innerHTML = '<option value="">Nenhum evento disponível para inscrição</option>';
      return;
    }

    select.innerHTML = '<option value="">Selecione o evento desejado</option>' +
      eventos.map(e => {
        let label = `${e.nome} — ${App.formatDate(e.data)}`;
        if (e.vagas_disponiveis !== undefined) {
          label += ` (${e.vagas_disponiveis} vagas)`;
        }
        if (e.is_paid) {
          label += ` 💰 R$ ${(e.valor || 0).toFixed(2)}`;
        }
        return `<option value="${e.id}">${label}</option>`;
      }).join('');

    select.addEventListener('change', () => {
      const eventoId = parseInt(select.value);
      selectedEvent = eventos.find(e => e.id === eventoId);
      togglePaymentSection();
    });
  } catch (err) {
    App.showAlert('reg-alert', err.message);
  }
}

function togglePaymentSection() {
  const paymentBox = document.getElementById('payment-box');
  const comprovanteGroup = document.getElementById('comprovante-group');

  if (selectedEvent && selectedEvent.is_paid) {
    paymentBox.style.display = 'block';
    comprovanteGroup.style.display = 'block';

    document.getElementById('event-valor').textContent = `R$ ${(selectedEvent.valor || 0).toFixed(2)}`;
    document.getElementById('pix-key-display').textContent = selectedEvent.pix_key || '';

    gerarPixQrCode(selectedEvent.pix_key);
  } else {
    paymentBox.style.display = 'none';
    comprovanteGroup.style.display = 'none';
  }
}

async function gerarPixQrCode(pixKey) {
  if (!pixKey) {
    document.getElementById('pix-qr-container').innerHTML =
      '<p style="font-size:0.85rem;color:var(--text-light);">QR Code indisponível. Use a chave abaixo.</p>';
    return;
  }

  try {
    const response = await fetch('/api/registrations/pix-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pix_key: pixKey })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.qr_code_url) {
        document.getElementById('pix-qr-container').innerHTML =
          `<img src="${data.qr_code_url}" style="width:200px;height:200px;border-radius:8px;" alt="QR Code Pix">`;
      }
    } else {
      throw new Error('Falha ao gerar QR Code');
    }
  } catch (err) {
    document.getElementById('pix-qr-container').innerHTML =
      '<p style="font-size:0.85rem;color:var(--text-light);">QR Code indisponível. Use a chave abaixo.</p>';
  }
}

function copiarChavePix() {
  const chave = document.getElementById('pix-key-display').textContent;
  navigator.clipboard.writeText(chave).then(() => {
    alert('Chave Pix copiada: ' + chave);
  }).catch(() => {
    const textArea = document.createElement('textarea');
    textArea.value = chave;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    alert('Chave Pix copiada: ' + chave);
  });
}

// Dispara o download do QR Code (data URL base64) no navegador
function baixarQrCode(dataUrl, nomeArquivo) {
  try {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Erro ao baixar QR Code:', err);
  }
}

// Sanitiza o nome do evento para uso em nome de arquivo:
// remove acentos, substitui não-alfanuméricos por hífen e limita a 40 caracteres
function nomeEventoParaArquivo(nome) {
  return (nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 40);
}

// Monta o nome padronizado do arquivo: evento + CPF
function montarNomeArquivoQr(nomeEvento, cpf) {
  const cpfArquivo = (cpf || '').replace(/\D/g, '') || 'inscricao';
  const eventoArquivo = nomeEventoParaArquivo(nomeEvento || '');
  return eventoArquivo
    ? `qrcode-inscricao-${eventoArquivo}-${cpfArquivo}.png`
    : `qrcode-inscricao-${cpfArquivo}.png`;
}

// Exibe o QR recuperado com download automático + botão de fallback
function exibirQrComDownload(qrCodeUrl, nomeArquivo) {
  document.getElementById('qr-result').style.display = 'block';
  document.getElementById('qr-img').src = qrCodeUrl;

  // Download automático
  baixarQrCode(qrCodeUrl, nomeArquivo);

  // Botão manual de fallback (caso o navegador bloqueie o download automático)
  const btnAntigo = document.getElementById('btn-baixar-qr');
  if (btnAntigo) btnAntigo.remove();
  const btnDownload = document.createElement('button');
  btnDownload.id = 'btn-baixar-qr';
  btnDownload.className = 'btn btn-outline';
  btnDownload.style.marginTop = '8px';
  btnDownload.textContent = '⬇️ Baixar QR Code';
  btnDownload.onclick = () => baixarQrCode(qrCodeUrl, nomeArquivo);
  document.getElementById('qr-img').after(btnDownload);
}

// Direciona o participante para a inscrição existente (bloqueio de duplicidade)
function mostrarInscricaoExistente(reg) {
  // Remove painel anterior, se houver
  const antigo = document.getElementById('recover-box');
  if (antigo) antigo.remove();

  // Limpa o alerta de erro — não é erro, é redirecionamento
  document.getElementById('reg-alert').innerHTML = '';

  const statusPagamento = !reg.evento_is_paid
    ? '— (evento gratuito)'
    : (reg.pagamento_validado
      ? '✅ Validado — credenciamento liberado'
      : '⏳ Pendente de validação pela organização');

  const box = document.createElement('div');
  box.id = 'recover-box';
  box.style.cssText = 'margin-top:12px;padding:16px;border:1px solid var(--border);border-radius:8px;';
  box.innerHTML = `
    <div class="alert alert-warning">
      ✅ <strong>Você já está inscrito neste evento!</strong><br>
      Participante: ${App.escapeHtml(reg.nome)}<br>
      Evento: ${App.escapeHtml(reg.evento_nome)} — ${App.formatDate(reg.evento_data)}<br>
      Pagamento: ${statusPagamento}
    </div>
    <div class="form-group">
      <label>Confirme o email usado na inscrição para recuperar seu QR Code:</label>
      <input type="email" id="recover-email" placeholder="email usado na inscrição">
    </div>
    <button class="btn btn-primary" onclick="recuperarQrCode()">Recuperar meu QR Code</button>
  `;
  document.getElementById('reg-alert').after(box);

  // Pré-preenche com o email digitado no formulário
  const emailForm = document.getElementById('reg-email');
  if (emailForm && emailForm.value) {
    document.getElementById('recover-email').value = emailForm.value.trim();
  }

  box.scrollIntoView({ behavior: 'smooth' });
}

// Recupera o QR Code da inscrição existente (exige email conferir)
async function recuperarQrCode() {
  const email = document.getElementById('recover-email').value.trim();
  const cpf = document.getElementById('reg-cpf').value.trim();
  const eventoId = parseInt(document.getElementById('reg-evento').value);

  if (!email) {
    App.showAlert('reg-alert', 'Informe o email usado na inscrição.');
    return;
  }

  try {
    const result = await App.api('/registrations/recover', {
      method: 'POST',
      body: JSON.stringify({ cpf, evento_id: eventoId, email })
    });

    const nomeArquivo = montarNomeArquivoQr(
      result.registration.evento_nome,
      cpf
    );
    exibirQrComDownload(result.qr_code_url, nomeArquivo);
    document.getElementById('qr-token').textContent = result.qr_token;

    const statusDiv = document.getElementById('payment-status-result');
    if (result.registration.evento_is_paid) {
      statusDiv.innerHTML = result.registration.pagamento_validado
        ? '<div class="alert alert-success">✅ Pagamento validado — credenciamento liberado.</div>'
        : '<div class="alert alert-warning">⏳ Pagamento pendente de validação pela organização.</div>';
    } else {
      statusDiv.innerHTML = '';
    }

    App.showAlert('reg-alert', 'QR Code recuperado com sucesso!', 'success');
    document.getElementById('qr-result').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    App.showAlert('reg-alert', err.message);
  }
}

async function fazerInscricao() {
  const data = {
    evento_id: parseInt(document.getElementById('reg-evento').value),
    cpf: document.getElementById('reg-cpf').value,
    nome: document.getElementById('reg-nome').value.trim(),
    tipo: document.getElementById('reg-tipo').value,
    email: document.getElementById('reg-email').value.trim(),
    telefone: document.getElementById('reg-telefone').value.trim(),
    instituicao: document.getElementById('reg-instituicao').value.trim()
  };

  if (selectedEvent && selectedEvent.is_paid) {
    data.comprovante_pix = document.getElementById('reg-comprovante').value.trim();
    if (!data.comprovante_pix) {
      App.showAlert('reg-alert', 'Para eventos pagos, o comprovante de pagamento é obrigatório.');
      return;
    }
  }

  if (!data.evento_id || !data.cpf || !data.nome || !data.tipo || !data.email) {
    App.showAlert('reg-alert', 'Preencha todos os campos obrigatórios.');
    return;
  }

  try {
    const result = await App.api('/registrations', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    const nomeArquivo = montarNomeArquivoQr(
      selectedEvent && selectedEvent.nome ? selectedEvent.nome : '',
      data.cpf
    );
    if (result.qr_code_url) {
      exibirQrComDownload(result.qr_code_url, nomeArquivo);
    }
    document.getElementById('qr-token').textContent = result.qr_token;

    const statusDiv = document.getElementById('payment-status-result');
    if (selectedEvent && selectedEvent.is_paid) {
      statusDiv.innerHTML = `
        <div class="alert alert-warning">
          ⏳ <strong>Pagamento em validação.</strong> Seu comprovante será verificado pela organização.
          Você receberá liberação para credenciamento após a validação.
        </div>
      `;
    } else {
      statusDiv.innerHTML = '';
    }

    App.showAlert('reg-alert', `Inscrição realizada! Bem-vindo(a), ${result.nome}.`, 'success');

    ['reg-cpf', 'reg-nome', 'reg-email', 'reg-telefone', 'reg-instituicao', 'reg-comprovante'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('reg-tipo').value = '';

    document.getElementById('qr-result').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    // Duplicidade: direciona o participante para a inscrição existente
    if (err.data && err.data.already_registered && err.data.registration) {
      mostrarInscricaoExistente(err.data.registration);
      return;
    }
    App.showAlert('reg-alert', err.message);
  }
}

carregarEventosPublicos();