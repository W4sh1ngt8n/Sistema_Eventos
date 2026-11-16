const Event = require('../models/Event');

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function horaParaMinutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

class EventController {
  static async listActive(req, res) {
    const events = Event.findActive();
    return res.json(events.map(e => {
      e.vagas_disponiveis = Event.getAvailableSlots(e.id);
      return e;
    }));
  }

  static async list(req, res) {
    const events = Event.findAll();
    return res.json(events);
  }

  static async findById(req, res) {
    const event = Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Evento não encontrado.' });
    }
    return res.json(event);
  }

  static async create(req, res) {
    const { nome, data, hora_inicio, hora_fim, vagas, local, descricao, carga_horaria, is_paid, valor, pix_key } = req.body;

    if (!nome || !data || !hora_inicio || !hora_fim || vagas === undefined) {
      return res.status(400).json({ error: 'Nome, data, horário de início/fim e vagas são obrigatórios.' });
    }

    if (!DATA_RE.test(data)) {
      return res.status(400).json({ error: 'Data inválida. Use o formato AAAA-MM-DD.' });
    }

    if (!HORA_RE.test(hora_inicio) || !HORA_RE.test(hora_fim)) {
      return res.status(400).json({ error: 'Horário inválido. Use o formato HH:MM.' });
    }

    if (horaParaMinutos(hora_fim) <= horaParaMinutos(hora_inicio)) {
      return res.status(400).json({ error: 'O horário de fim deve ser posterior ao de início.' });
    }

    if (!Number.isInteger(vagas) || vagas < 0) {
      return res.status(400).json({ error: 'Vagas deve ser um número inteiro maior ou igual a zero.' });
    }

    if (carga_horaria !== undefined && (!Number.isInteger(carga_horaria) || carga_horaria < 0)) {
      return res.status(400).json({ error: 'Carga horária deve ser um número inteiro maior ou igual a zero.' });
    }

    const isPaidBool = !!is_paid;
    const valorNum = valor !== undefined ? parseFloat(valor) : 0;

    if (isPaidBool && (!Number.isFinite(valorNum) || valorNum <= 0)) {
      return res.status(400).json({ error: 'Eventos pagos devem ter um valor maior que zero.' });
    }

    if (isPaidBool && (!pix_key || pix_key.trim() === '')) {
      return res.status(400).json({ error: 'Eventos pagos devem ter uma chave Pix informada.' });
    }

    try {
      const event = Event.create({
        nome, data, hora_inicio, hora_fim, vagas, local, descricao, carga_horaria,
        is_paid: isPaidBool,
        valor: isPaidBool ? valorNum : 0,
        pix_key: isPaidBool ? pix_key : null
      });
      return res.status(201).json(event);
    } catch (err) {
      console.error('Erro ao criar evento:', err);
      return res.status(500).json({ error: 'Erro ao criar evento.' });
    }
  }

  static async update(req, res) {
    const id = parseInt(req.params.id);
    const event = Event.findById(id);
    if (!event) {
      return res.status(404).json({ error: 'Evento não encontrado.' });
    }

    const { nome, data, hora_inicio, hora_fim, vagas, local, descricao, carga_horaria, ativo, is_paid, valor, pix_key } = req.body;

    // Whitelist: nunca repassa req.body inteiro ao model
    const updateData = {};

    if (nome !== undefined) updateData.nome = nome;
    if (local !== undefined) updateData.local = local;
    if (descricao !== undefined) updateData.descricao = descricao;
    if (ativo !== undefined) updateData.ativo = !!ativo;

    if (data !== undefined) {
      if (!DATA_RE.test(data)) {
        return res.status(400).json({ error: 'Data inválida. Use o formato AAAA-MM-DD.' });
      }
      updateData.data = data;
    }

    if (hora_inicio !== undefined || hora_fim !== undefined) {
      const hi = hora_inicio !== undefined ? hora_inicio : event.hora_inicio;
      const hf = hora_fim !== undefined ? hora_fim : event.hora_fim;
      if (!HORA_RE.test(hi) || !HORA_RE.test(hf)) {
        return res.status(400).json({ error: 'Horário inválido. Use o formato HH:MM.' });
      }
      if (horaParaMinutos(hf) <= horaParaMinutos(hi)) {
        return res.status(400).json({ error: 'O horário de fim deve ser posterior ao de início.' });
      }
      if (hora_inicio !== undefined) updateData.hora_inicio = hora_inicio;
      if (hora_fim !== undefined) updateData.hora_fim = hora_fim;
    }

    if (vagas !== undefined) {
      if (!Number.isInteger(vagas) || vagas < 0) {
        return res.status(400).json({ error: 'Vagas deve ser um número inteiro maior ou igual a zero.' });
      }
      const inscritos = Event.countRegistrations(id);
      if (vagas < inscritos) {
        return res.status(400).json({ error: `Não é possível reduzir as vagas abaixo do número de inscritos (${inscritos}).` });
      }
      updateData.vagas = vagas;
    }

    if (carga_horaria !== undefined) {
      if (!Number.isInteger(carga_horaria) || carga_horaria < 0) {
        return res.status(400).json({ error: 'Carga horária deve ser um número inteiro maior ou igual a zero.' });
      }
      updateData.carga_horaria = carga_horaria;
    }

    if (is_paid !== undefined) {
      const isPaidBool = !!is_paid;
      updateData.is_paid = isPaidBool;

      if (isPaidBool) {
        // Valida valor/chave efetivos (novos ou já existentes no evento)
        const valorEfetivo = valor !== undefined ? parseFloat(valor) : event.valor;
        const pixEfetiva = pix_key !== undefined ? pix_key : event.pix_key;
        if (!Number.isFinite(valorEfetivo) || valorEfetivo <= 0) {
          return res.status(400).json({ error: 'Eventos pagos devem ter um valor maior que zero.' });
        }
        if (!pixEfetiva || pixEfetiva.trim() === '') {
          return res.status(400).json({ error: 'Eventos pagos devem ter uma chave Pix informada.' });
        }
        if (valor !== undefined) updateData.valor = valorEfetivo;
        if (pix_key !== undefined) updateData.pix_key = pix_key;
      } else {
        // Evento convertido para gratuito: limpa os dados de pagamento
        updateData.valor = 0;
        updateData.pix_key = null;
      }
    }

    try {
      const updated = Event.update(id, updateData);
      if (!updated) {
        return res.status(404).json({ error: 'Evento não encontrado.' });
      }
      return res.json(updated);
    } catch (err) {
      console.error('Erro ao atualizar evento:', err);
      return res.status(500).json({ error: 'Erro ao atualizar evento.' });
    }
  }

  static async delete(req, res) {
    const deleted = Event.delete(parseInt(req.params.id));
    if (!deleted) {
      return res.status(404).json({ error: 'Evento não encontrado.' });
    }
    return res.json({ message: 'Evento excluído com sucesso.' });
  }

  // Cabeçalho deste método foi reconstruído a partir do padrão do arquivo original
  static async getMetrics(req, res) {
    const id = parseInt(req.params.id);
    const event = Event.findById(id);
    if (!event) {
      return res.status(404).json({ error: 'Evento não encontrado.' });
    }
    return res.json({
      inscritos: Event.countRegistrations(id),
      presentes: Event.countAttendances(id),
      trabalhos: Event.countWorks(id),
      vagas_disponiveis: Event.getAvailableSlots(id)
    });
  }
}

module.exports = EventController;