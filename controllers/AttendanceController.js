const Attendance = require('../models/Attendance');
const { limparCPF, formatarCPF } = require('../utils/cpfValidator');

class AttendanceController {
  static async registerByQr(req, res) {
    const { qr_token, evento_id } = req.body;

    if (!qr_token || !evento_id) {
      return res.status(400).json({ error: 'QR Token e evento_id são obrigatórios.' });
    }

    try {
      const presence = Attendance.registerByQrToken(qr_token, evento_id, 'QR_CODE', req.user ? req.user.nome : null);
      return res.status(201).json({
        success: true,
        message: `Presença registrada: ${presence.nome}`,
        data: presence
      });
    } catch (err) {
      if (err.message.includes('PAGAMENTO NÃO VALIDADO')) {
        return res.status(403).json({ error: err.message, payment_blocked: true });
      }
      return res.status(400).json({ error: err.message });
    }
  }

  static async registerByCpf(req, res) {
    const { cpf, evento_id } = req.body;

    if (!cpf || !evento_id) {
      return res.status(400).json({ error: 'CPF e evento_id são obrigatórios.' });
    }

    const cpfFormatado = formatarCPF(limparCPF(cpf));

    try {
      const presence = Attendance.registerByCpf(cpfFormatado, evento_id, 'CPF_MANUAL', req.user ? req.user.nome : null);
      return res.status(201).json({
        success: true,
        message: `Presença registrada: ${presence.nome}`,
        data: presence
      });
    } catch (err) {
      if (err.message.includes('PAGAMENTO NÃO VALIDADO')) {
        return res.status(403).json({ error: err.message, payment_blocked: true });
      }
      return res.status(400).json({ error: err.message });
    }
  }

  static async findByEvent(req, res) {
    const { evento_id } = req.params;
    const presences = Attendance.findByEvent(evento_id);
    return res.json(presences);
  }

  // ================================================================
  //  ENDPOINTS PARA DISPOSITIVOS FÍSICOS (autenticados por X-Device-Key)
  // ================================================================

  // Registro individual de presença pelo leitor QR
  static async registerByDevice(req, res) {
    const { qr_token, evento_id } = req.body;

    if (!qr_token || !evento_id) {
      return res.status(400).json({ error: 'QR Token e evento_id são obrigatórios.' });
    }

    try {
      const presence = Attendance.registerByQrToken(qr_token, evento_id, 'QR_DEVICE', req.device ? req.device.nome : null);
      return res.status(201).json({
        success: true,
        message: `Presença registrada: ${presence.nome}`,
        data: presence
      });
    } catch (err) {
      if (err.message.includes('PAGAMENTO NÃO VALIDADO')) {
        return res.status(403).json({ error: err.message, payment_blocked: true });
      }
      return res.status(400).json({ error: err.message });
    }
  }

  // Sincronização da fila offline do dispositivo.
  // Processa cada item e retorna o status individual — o dispositivo
  // remove da fila os itens resolvidos e mantém apenas os 'erro'.
  static async syncBatch(req, res) {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Envie items: array de { qr_token, evento_id }.' });
    }
    if (items.length > 50) {
      return res.status(400).json({ error: 'Máximo de 50 itens por sincronização.' });
    }

    const nomeDispositivo = req.device ? req.device.nome : null;

    const results = items.map(({ qr_token, evento_id }) => {
      if (!qr_token || !evento_id) {
        return { qr_token: qr_token || null, status: 'erro', message: 'Item inválido: qr_token e evento_id são obrigatórios.' };
      }
      try {
        const presence = Attendance.registerByQrToken(qr_token, evento_id, 'QR_DEVICE_SYNC', nomeDispositivo);
        return { qr_token, status: 'ok', message: `Presença registrada: ${presence.nome}` };
      } catch (err) {
        if (err.message.includes('PAGAMENTO NÃO VALIDADO')) {
          return { qr_token, status: 'pagamento_bloqueado', message: err.message };
        }
        if (err.message.includes('já registrada')) {
          return { qr_token, status: 'duplicado', message: err.message };
        }
        if (err.message.includes('não encontrado') || err.message.includes('não pertence') || err.message.includes('não inscrito')) {
          return { qr_token, status: 'nao_encontrado', message: err.message };
        }
        return { qr_token, status: 'erro', message: err.message };
      }
    });

    return res.json({ results });
  }
}

module.exports = AttendanceController;