const { getDb } = require('../config/database');

class Work {
  static create({ evento_id, cpf_autor, titulo, modalidade, link_arquivo }) {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO trabalhos (evento_id, cpf_autor, titulo, modalidade, link_arquivo, status)
      VALUES (?, ?, ?, ?, ?, 'SUBMETIDO')
    `);
    const info = stmt.run(evento_id, cpf_autor, titulo, modalidade, link_arquivo);
    return this.findById(info.lastInsertRowid);
  }

  static findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM trabalhos WHERE id = ?').get(id);
  }

  static findByEvent(evento_id) {
    const db = getDb();
    return db.prepare(`
      SELECT t.*,
        GROUP_CONCAT(u.nome) as avaliadores_nomes,
        COUNT(a.id) as total_avaliadores,
        (SELECT COUNT(*) FROM avaliacoes av WHERE av.trabalho_id = t.id) as avaliacoes_concluidas
      FROM trabalhos t
      LEFT JOIN atribuicoes a ON a.trabalho_id = t.id
      LEFT JOIN usuarios u ON a.avaliador_id = u.id
      WHERE t.evento_id = ?
      GROUP BY t.id
      ORDER BY t.created_at
    `).all(evento_id);
  }

  static findByEvaluator(avaliador_id) {
    const db = getDb();
    return db.prepare(`
      SELECT t.*, e.nome as evento_nome, u.nome as avaliador_nome
      FROM trabalhos t
      JOIN eventos e ON t.evento_id = e.id
      JOIN atribuicoes a ON a.trabalho_id = t.id
      JOIN usuarios u ON a.avaliador_id = u.id
      WHERE a.avaliador_id = ?
      ORDER BY t.created_at
    `).all(avaliador_id);
  }

  static updateStatus(trabalho_id, status) {
    const db = getDb();
    db.prepare('UPDATE trabalhos SET status = ? WHERE id = ?').run(status, trabalho_id);
    return this.findById(trabalho_id);
  }

  static assignEvaluator(trabalho_id, avaliador_id) {
    const db = getDb();
    try {
      db.prepare('INSERT INTO atribuicoes (trabalho_id, avaliador_id) VALUES (?, ?)').run(trabalho_id, avaliador_id);
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        throw new Error('Avaliador já atribuído a este trabalho.');
      }
      throw err;
    }

    // Atualizar status
    const work = this.findById(trabalho_id);
    if (work && work.status === 'SUBMETIDO') {
      this.updateStatus(trabalho_id, 'EM_AVALIACAO');
    }
    return this.findById(trabalho_id);
  }

  static getAssignedEvaluators(trabalho_id) {
    const db = getDb();
    return db.prepare(`
      SELECT u.id, u.nome, u.email
      FROM usuarios u
      JOIN atribuicoes a ON a.avaliador_id = u.id
      WHERE a.trabalho_id = ?
    `).all(trabalho_id);
  }
}

module.exports = Work;