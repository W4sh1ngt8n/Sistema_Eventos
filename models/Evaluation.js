const { getDb } = require('../config/database');
const Work = require('./Work');

class Evaluation {
  static create({ trabalho_id, avaliador_id, nota, observacoes }) {
    const db = getDb();

    // Validar nota — rejeita NaN, null e valores fora do intervalo
    if (!Number.isFinite(nota) || nota < 0 || nota > 10) {
      throw new Error('Nota deve estar entre 0,0 e 10,0.');
    }

    // Verificar se o avaliador foi atribuído ao trabalho
    const assigned = db.prepare('SELECT id FROM atribuicoes WHERE trabalho_id = ? AND avaliador_id = ?').get(trabalho_id, avaliador_id);
    if (!assigned) {
      throw new Error('Avaliador não está atribuído a este trabalho.');
    }

    // Verificar se já avaliou
    const existing = db.prepare('SELECT id FROM avaliacoes WHERE trabalho_id = ? AND avaliador_id = ?').get(trabalho_id, avaliador_id);
    if (existing) {
      throw new Error('Avaliador já registrou nota para este trabalho.');
    }

    const stmt = db.prepare(`
      INSERT INTO avaliacoes (trabalho_id, avaliador_id, nota, observacoes)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(trabalho_id, avaliador_id, nota, observacoes || null);

    // Verificar se todas as atribuições foram avaliadas
    this._checkAllEvaluationsComplete(trabalho_id);

    return this.findById(info.lastInsertRowid);
  }

  static _checkAllEvaluationsComplete(trabalho_id) {
    const db = getDb();
    const totalAtribuicoes = db.prepare('SELECT COUNT(*) as total FROM atribuicoes WHERE trabalho_id = ?').get(trabalho_id).total;
    const totalAvaliacoes = db.prepare('SELECT COUNT(*) as total FROM avaliacoes WHERE trabalho_id = ?').get(trabalho_id).total;

    if (totalAtribuicoes > 0 && totalAvaliacoes >= totalAtribuicoes) {
      Work.updateStatus(trabalho_id, 'AVALIADO');
    }
  }

  static isEvaluatorAssigned(trabalho_id, avaliador_id) {
    const db = getDb();
    const row = db.prepare('SELECT id FROM atribuicoes WHERE trabalho_id = ? AND avaliador_id = ?').get(trabalho_id, avaliador_id);
    return !!row;
  }

  static findById(id) {
    const db = getDb();
    return db.prepare(`
      SELECT av.*, u.nome as avaliador_nome, t.titulo as trabalho_titulo
      FROM avaliacoes av
      JOIN usuarios u ON av.avaliador_id = u.id
      JOIN trabalhos t ON av.trabalho_id = t.id
      WHERE av.id = ?
    `).get(id);
  }

  static findByWork(trabalho_id) {
    const db = getDb();
    return db.prepare(`
      SELECT av.*, u.nome as avaliador_nome
      FROM avaliacoes av
      JOIN usuarios u ON av.avaliador_id = u.id
      WHERE av.trabalho_id = ?
      ORDER BY av.created_at
    `).all(trabalho_id);
  }

  static getWorkAverage(trabalho_id) {
    const db = getDb();
    const result = db.prepare(`
      SELECT AVG(nota) as media, COUNT(*) as total
      FROM avaliacoes
      WHERE trabalho_id = ?
    `).get(trabalho_id);
    return {
      media: result.media ? Number(result.media.toFixed(2)) : null,
      total: result.total
    };
  }
}

module.exports = Evaluation;