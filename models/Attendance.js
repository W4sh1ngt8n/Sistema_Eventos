const { getDb } = require('../config/database');
const Registration = require('./Registration');
const Event = require('./Event');

class Attendance {
  // credenciadoPor: nome de quem registrou a presença
  // (operador autenticado via JWT ou nome do dispositivo físico)
  static registerByQrToken(qr_token, evento_id, metodo = 'QR_CODE', credenciadoPor = null) {
    const db = getDb();
    const inscricao = Registration.findByQrToken(qr_token);

    if (!inscricao) {
      throw new Error('QR Code não encontrado. Verifique o código ou use o CPF.');
    }

    if (inscricao.evento_id !== evento_id) {
      throw new Error(`Inscrição não pertence a este evento. Inscrito em: ${inscricao.evento_nome}`);
    }

    // BLOQUEIO: evento pago sem pagamento validado
    if (inscricao.evento_is_paid && !inscricao.pagamento_validado) {
      throw new Error('PAGAMENTO NÃO VALIDADO: Este evento é pago e o comprovante ainda não foi validado. Dirija-se à organização.');
    }

    return this._createPresence(evento_id, inscricao, metodo, credenciadoPor);
  }

  static registerByCpf(cpf, evento_id, metodo = 'CPF_MANUAL', credenciadoPor = null) {
    const db = getDb();
    const inscricao = Registration.findByCpfAndEvent(cpf, evento_id);

    if (!inscricao) {
      throw new Error('CPF não inscrito neste evento.');
    }

    // BLOQUEIO: evento pago sem pagamento validado
    if (inscricao.evento_is_paid && !inscricao.pagamento_validado) {
      throw new Error('PAGAMENTO NÃO VALIDADO: Este evento é pago e o comprovante ainda não foi validado. Dirija-se à organização.');
    }

    return this._createPresence(evento_id, inscricao, metodo, credenciadoPor);
  }

  static _createPresence(evento_id, inscricao, metodo, credenciadoPor = null) {
    const db = getDb();

    // Verificar duplicidade
    const existing = db.prepare('SELECT id FROM presencas WHERE evento_id = ? AND cpf = ?').get(evento_id, inscricao.cpf);
    if (existing) {
      throw new Error('Presença já registrada para este CPF neste evento.');
    }

    const stmt = db.prepare(`
      INSERT INTO presencas (evento_id, inscricao_id, cpf, nome, metodo, credenciado_por)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(evento_id, inscricao.id, inscricao.cpf, inscricao.nome, metodo, credenciadoPor || null);

    return db.prepare(`
      SELECT p.*, i.email, i.tipo, i.pagamento_validado
      FROM presencas p
      LEFT JOIN inscricoes i ON p.inscricao_id = i.id
      WHERE p.id = ?
    `).get(info.lastInsertRowid);
  }

  static findByEvent(evento_id) {
    const db = getDb();
    return db.prepare(`
      SELECT p.*, i.email, i.tipo, i.pagamento_validado, i.comprovante_pix
      FROM presencas p
      LEFT JOIN inscricoes i ON p.inscricao_id = i.id
      WHERE p.evento_id = ?
      ORDER BY p.data_hora
    `).all(evento_id);
  }

  static findByEventAndCpf(evento_id, cpf) {
    const db = getDb();
    return db.prepare('SELECT * FROM presencas WHERE evento_id = ? AND cpf = ?').get(evento_id, cpf);
  }
}

module.exports = Attendance;