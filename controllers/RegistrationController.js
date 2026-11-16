const Registration = require('../models/Registration');
const Event = require('../models/Event');
const { validarCPF, formatarCPF, limparCPF } = require('../utils/cpfValidator');
const { generateQrCodeDataUrl } = require('../utils/qrToken');

class RegistrationController {
  static async create(req, res) {
    const { evento_id, cpf, nome, tipo, email, telefone, instituicao, comprovante_pix } = req.body;

    if (!evento_id || !cpf || !nome || !tipo || !email) {
      return res.status(400).json({ error: 'Evento, CPF, nome, tipo e email são obrigatórios.' });
    }

    const cpfLimpo = limparCPF(cpf);
    if (!validarCPF(cpfLimpo)) {
      return res.status(400).json({ error: 'CPF inválido.' });
    }

    const event = Event.findById(evento_id);
    if (!event) {
      return res.status(404).json({ error: 'Evento não encontrado.' });
    }

    if (!event.ativo) {
      return res.status(400).json({ error: 'Evento não está ativo para inscrições.' });
    }

    try {
      const registration = Registration.create({
        evento_id,
        cpf: formatarCPF(cpfLimpo),
        nome,
        tipo,
        email,
        telefone,
        instituicao,
        comprovante_pix
      });

      // Gera o QR Code DEPOIS de persistir a inscrição:
      // se a geração falhar, a inscrição não é perdida (o token continua válido
      // e o QR pode ser regenerado depois)
      try {
        registration.qr_code_url = await generateQrCodeDataUrl(registration.qr_token);
      } catch (qrErr) {
        console.error('Erro ao gerar QR Code da inscrição:', qrErr);
        registration.qr_code_url = null;
      }

      return res.status(201).json(registration);
    } catch (err) {
      // Duplicidade: detectada pelo model OU pelo índice único do banco.
      // Retorna os dados da inscrição existente para o frontend direcionar o participante.
      const isDuplicate = err.message === 'CPF já inscrito neste evento.'
        || (err.code === 'SQLITE_CONSTRAINT_UNIQUE' && String(err.message).includes('inscricoes'));

      if (isDuplicate) {
        const existing = Registration.findByCpfAndEvent(formatarCPF(cpfLimpo), evento_id);
        if (existing) {
          return res.status(409).json({
            error: 'CPF já inscrito neste evento.',
            already_registered: true,
            registration: {
              id: existing.id,
              nome: existing.nome,
              evento_nome: existing.evento_nome,
              evento_data: existing.evento_data,
              evento_is_paid: !!existing.evento_is_paid,
              pagamento_validado: !!existing.pagamento_validado,
              created_at: existing.created_at
            }
          });
        }
        return res.status(400).json({ error: 'CPF já inscrito neste evento.' });
      }

      if (err.code && String(err.code).startsWith('SQLITE_')) {
        console.error('Erro ao criar inscrição:', err);
        return res.status(500).json({ error: 'Erro ao processar inscrição. Tente novamente.' });
      }
      // Erros de negócio (vagas, conflito, comprovante) → mensagem clara
      return res.status(400).json({ error: err.message });
    }
  }

  // Recuperação de inscrição existente (público).
  // Segundo fator: CPF + evento + email devem conferir com a inscrição.
  static async recover(req, res) {
    const { cpf, evento_id, email } = req.body;

    if (!cpf || !evento_id || !email) {
      return res.status(400).json({ error: 'CPF, evento e email são obrigatórios para recuperar a inscrição.' });
    }

    const cpfLimpo = limparCPF(cpf);
    if (!validarCPF(cpfLimpo)) {
      return res.status(400).json({ error: 'CPF inválido.' });
    }

    const registration = Registration.findByCpfEventAndEmail(formatarCPF(cpfLimpo), evento_id, email.trim());
    if (!registration) {
      // Resposta genérica: não revela qual campo não confere
      return res.status(404).json({ error: 'Não encontramos inscrição com esses dados. Verifique CPF, evento e email.' });
    }

    try {
      const qrCodeUrl = await generateQrCodeDataUrl(registration.qr_token);
      return res.json({
        registration: {
          id: registration.id,
          nome: registration.nome,
          evento_nome: registration.evento_nome,
          evento_data: registration.evento_data,
          evento_is_paid: !!registration.evento_is_paid,
          pagamento_validado: !!registration.pagamento_validado
        },
        qr_code_url: qrCodeUrl,
        qr_token: registration.qr_token
      });
    } catch (err) {
      console.error('Erro ao gerar QR Code de recuperação:', err);
      return res.status(500).json({ error: 'Erro ao gerar QR Code. Tente novamente.' });
    }
  }

  static async findByEvent(req, res) {
    const { evento_id } = req.params;
    const registrations = Registration.findByEvent(evento_id);
    return res.json(registrations);
  }

  static async findByCpf(req, res) {
    const { cpf } = req.params;
    const registrations = Registration.findByCpf(formatarCPF(limparCPF(cpf)));
    return res.json(registrations);
  }

  // Validar pagamento de uma inscrição
  static async validatePayment(req, res) {
    const { id } = req.params;
    const inscricao = Registration.findById(id);

    if (!inscricao) {
      return res.status(404).json({ error: 'Inscrição não encontrada.' });
    }

    if (!inscricao.evento_is_paid) {
      return res.status(400).json({ error: 'Este evento é gratuito. Não há pagamento para validar.' });
    }

    if (inscricao.pagamento_validado) {
      return res.status(400).json({ error: 'Pagamento já validado anteriormente.' });
    }

    const updated = Registration.validatePayment(id, req.user.nome);
    return res.json({
      message: 'Pagamento validado com sucesso. Credenciamento liberado.',
      data: updated
    });
  }

  // Reverter validação de pagamento
  static async invalidatePayment(req, res) {
    const { id } = req.params;
    const inscricao = Registration.findById(id);

    if (!inscricao) {
      return res.status(404).json({ error: 'Inscrição não encontrada.' });
    }

    if (!inscricao.evento_is_paid) {
      return res.status(400).json({ error: 'Este evento é gratuito. Não há pagamento para reverter.' });
    }

    const updated = Registration.invalidatePayment(id);
    return res.json({
      message: 'Validação de pagamento revertida.',
      data: updated
    });
  }
}

module.exports = RegistrationController;