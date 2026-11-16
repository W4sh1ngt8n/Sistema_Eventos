const { getDb } = require('../config/database');
const crypto = require('crypto');
const Event = require('./Event');

class Registration {
  static create({ evento_id, cpf, nome, tipo, email, telefone, instituicao, comprovante_pix }) {
    const db = getDb();

    const vagasDisponiveis = Event.getAvailableSlots(evento_id);
    if (vagasDisponiveis <= 0) {
      throw new Error('Evento esgotado. Não há vagas disponíveis.');
    }

    const existing = db.prepare('SELECT id FROM inscricoes WHERE evento_id = ? AND cpf = ?').get(evento_id, cpf);
    if (existing) {
      throw new Error('CPF já inscrito neste evento.');
    }

    const event = Event.findById(evento_id);
    if (event) {
      const conflicting = db.prepare(`
        SELECT i.id, e.nome as evento_nome, e.hora_inicio, e.hora_fim
        FROM inscricoes i
        JOIN eventos e ON i.evento_id = e.id
        WHERE i.cpf = ? AND e.data = ? AND e.id != ?
          AND (
            (e.hora_inicio < ? AND e.hora_fim > ?) OR
            (e.hora_inicio < ? AND e.hora_fim > ?) OR
            (e.hora_inicio >= ? AND e.hora_fim <= ?)
          )
      `).get(cpf, event.data, evento_id, event.hora_fim, event.hora_inicio, event.hora_fim, event.hora_inicio, event.hora_inicio, event.hora_fim);

      if (conflicting) {
        throw new Error(`Conflito de horário com o evento: ${conflicting.evento_nome}`);
      }
    }

    if (event && event.is_paid) {
      if (!comprovante_pix || comprovante_pix.trim() === '') {
        throw new Error('Este é um evento pago. É obrigatório informar o comprovante de pagamento Pix.');
      }
    }

    const qr_token = crypto.randomBytes(16).toString('hex');

    const stmt = db.prepare(`
      INSERT INTO inscricoes (evento_id, cpf, nome, tipo, email, telefone, instituicao, qr_token, comprovante_pix, pagamento_validado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const pagamentoInicial = (event && event.is_paid) ? 0 : 1;
    const info = stmt.run(evento_id, cpf, nome, tipo, email, telefone || null, instituicao || null, qr_token, comprovante_pix || null, pagamentoInicial);

    return this.findById(info.lastInsertRowid);
  }

  static findById(id) {
    const db = getDb();
    return db.prepare(`
      SELECT i.*, e.nome as evento_nome, e.data as evento_data, e.is_paid as evento_is_paid, e.valor as evento_valor
      FROM inscricoes i
      JOIN eventos e ON i.evento_id = e.id
      WHERE i.id = ?
    `).get(id);
  }

  static findByQrToken(token) {
    const db = getDb();
    return db.prepare(`
      SELECT i.*, e.nome as evento_nome, e.data as evento_data, e.is_paid as evento_is_paid
      FROM inscricoes i
      JOIN eventos e ON i.evento_id = e.id
      WHERE i.qr_token = ?
    `).get(token);
  }

  static findByCpfAndEvent(cpf, evento_id) {
    const db = getDb();
    return db.prepare(`
      SELECT i.*, e.is_paid as evento_is_paid
      FROM inscricoes i
      JOIN eventos e ON i.evento_id = e.id
      WHERE i.cpf = ? AND i.evento_id = ?
    `).get(cpf, evento_id);
  }

  // Recuperação: exige que o email informado bata com o da inscrição (segundo fator)
  static findByCpfEventAndEmail(cpf, evento_id, email) {
    const db = getDb();
    return db.prepare(`
      SELECT i.*, e.nome as evento_nome, e.data as evento_data, e.is_paid as evento_is_paid
      FROM inscricoes i
      JOIN eventos e ON i.evento_id = e.id
      WHERE i.cpf = ? AND i.evento_id = ? AND LOWER(TRIM(i.email)) = LOWER(TRIM(?))
    `).get(cpf, evento_id, email);
  }

  static findByEvent(evento_id) {
    const db = getDb();
    return db.prepare(`
      SELECT i.*, e.nome as evento_nome, e.is_paid as evento_is_paid, e.valor as evento_valor,
        CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END as presente
      FROM inscricoes i
      JOIN eventos e ON i.evento_id = e.id
      LEFT JOIN presencas p ON p.inscricao_id = i.id AND p.evento_id = i.evento_id
      WHERE i.evento_id = ?
      ORDER BY i.nome
    `).all(evento_id);
  }

  static findByCpf(cpf) {
    const db = getDb();
    // ROTA PÚBLICA: retorna apenas campos mínimos.
    // NUNCA expor qr_token, comprovante_pix, email/telefone ou trilha de auditoria.
    return db.prepare(`
      SELECT i.id, i.evento_id, i.nome, i.pagamento_validado, i.created_at,
        e.nome as evento_nome, e.data as evento_data, e.is_paid as evento_is_paid, e.valor as evento_valor
      FROM inscricoes i
      JOIN eventos e ON i.evento_id = e.id
      WHERE i.cpf = ?
      ORDER BY e.data DESC
    `).all(cpf);
  }

  static validatePayment(id, validatedBy) {
    const db = getDb();
    db.prepare(`
      UPDATE inscricoes
      SET pagamento_validado = 1,
          pagamento_validado_por = ?,
          pagamento_validado_em = datetime('now', 'localtime')
      WHERE id = ?
    `).run(validatedBy, id);
    return this.findById(id);
  }

  static invalidatePayment(id) {
    const db = getDb();
    db.prepare(`
      UPDATE inscricoes
      SET pagamento_validado = 0,
          pagamento_validado_por = NULL,
          pagamento_validado_em = NULL
      WHERE id = ?
    `).run(id);
    return this.findById(id);
  }
}

module.exports = Registration;