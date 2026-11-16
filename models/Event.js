const { getDb } = require('../config/database');

class Event {
  static create({ nome, data, hora_inicio, hora_fim, vagas, local, descricao, ativo = true, carga_horaria = 0, is_paid = false, valor = 0, pix_key = null }) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO eventos (nome, data, hora_inicio, hora_fim, vagas, local, descricao, ativo, carga_horaria, is_paid, valor, pix_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(nome, data, hora_inicio, hora_fim, vagas, local || null, descricao || null, ativo ? 1 : 0, carga_horaria, is_paid ? 1 : 0, valor, pix_key || null);
    return this.findById(info.lastInsertRowid);
  }

  static findById(id) {
    const db = getDb();
    const event = db.prepare('SELECT * FROM eventos WHERE id = ?').get(id);
    if (event) {
      event.ativo = !!event.ativo;
      event.is_paid = !!event.is_paid;
      event.vagas_disponiveis = this.getAvailableSlots(id);
    }
    return event;
  }

  static findAll() {
    const db = getDb();
    const events = db.prepare('SELECT * FROM eventos ORDER BY data DESC, hora_inicio DESC').all();
    return events.map(e => {
      e.ativo = !!e.ativo;
      e.is_paid = !!e.is_paid;
      e.vagas_disponiveis = this.getAvailableSlots(e.id);
      return e;
    });
  }

  static findActive() {
    const db = getDb();
    return db.prepare('SELECT * FROM eventos WHERE ativo = 1 ORDER BY data DESC').all().map(e => {
      e.ativo = !!e.ativo;
      e.is_paid = !!e.is_paid;
      e.vagas_disponiveis = this.getAvailableSlots(e.id);
      return e;
    });
  }

  static update(id, { nome, data, hora_inicio, hora_fim, vagas, local, descricao, ativo, carga_horaria, is_paid, valor, pix_key }) {
    const db = getDb();
    const event = this.findById(id);
    if (!event) return null;

    const updates = [];
    const values = [];

    if (nome !== undefined) { updates.push('nome = ?'); values.push(nome); }
    if (data !== undefined) { updates.push('data = ?'); values.push(data); }
    if (hora_inicio !== undefined) { updates.push('hora_inicio = ?'); values.push(hora_inicio); }
    if (hora_fim !== undefined) { updates.push('hora_fim = ?'); values.push(hora_fim); }
    if (vagas !== undefined) { updates.push('vagas = ?'); values.push(vagas); }
    if (local !== undefined) { updates.push('local = ?'); values.push(local); }
    if (descricao !== undefined) { updates.push('descricao = ?'); values.push(descricao); }
    if (ativo !== undefined) { updates.push('ativo = ?'); values.push(ativo ? 1 : 0); }
    if (carga_horaria !== undefined) { updates.push('carga_horaria = ?'); values.push(carga_horaria); }
    if (is_paid !== undefined) { updates.push('is_paid = ?'); values.push(is_paid ? 1 : 0); }
    if (valor !== undefined) { updates.push('valor = ?'); values.push(valor); }
    if (pix_key !== undefined) { updates.push('pix_key = ?'); values.push(pix_key); }

    if (updates.length === 0) return event;

    updates.push("updated_at = datetime('now', 'localtime')");
    values.push(id);

    db.prepare(`UPDATE eventos SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  static delete(id) {
    const db = getDb();
    const info = db.prepare('DELETE FROM eventos WHERE id = ?').run(id);
    return info.changes > 0;
  }

  static getAvailableSlots(eventId) {
    const db = getDb();
    const event = db.prepare('SELECT vagas FROM eventos WHERE id = ?').get(eventId);
    if (!event) return 0;
    const count = db.prepare('SELECT COUNT(*) as total FROM inscricoes WHERE evento_id = ?').get(eventId).total;
    return Math.max(0, event.vagas - count);
  }

  static countRegistrations(eventId) {
    const db = getDb();
    return db.prepare('SELECT COUNT(*) as total FROM inscricoes WHERE evento_id = ?').get(eventId).total;
  }

  static countAttendances(eventId) {
    const db = getDb();
    return db.prepare('SELECT COUNT(*) as total FROM presencas WHERE evento_id = ?').get(eventId).total;
  }

  static countWorks(eventId) {
    const db = getDb();
    return db.prepare('SELECT COUNT(*) as total FROM trabalhos WHERE evento_id = ?').get(eventId).total;
  }
}

module.exports = Event;