const { getDb } = require('../config/database');
const bcrypt = require('bcryptjs');

const DEFAULT_PASSWORD = '123456';

class User {
  static create({ nome, email, senha, perfil, cpf, ativo = true }) {
    const db = getDb();
    const passwordToUse = senha || DEFAULT_PASSWORD;
    const hashedPassword = bcrypt.hashSync(passwordToUse, 10);

    const stmt = db.prepare(`
      INSERT INTO usuarios (nome, email, senha, perfil, cpf, ativo, must_change_password)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);
    const info = stmt.run(nome, email, hashedPassword, perfil, cpf || null, ativo ? 1 : 0);
    return this.findById(info.lastInsertRowid);
  }

  static findById(id) {
    const db = getDb();
    return db.prepare(`
      SELECT id, nome, email, perfil, cpf, ativo, must_change_password, created_at
      FROM usuarios WHERE id = ?
    `).get(id);
  }

  static findByEmail(email) {
    const db = getDb();
    return db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
  }

  static findAll() {
    const db = getDb();
    return db.prepare(`
      SELECT id, nome, email, perfil, cpf, ativo, must_change_password, created_at
      FROM usuarios ORDER BY nome
    `).all();
  }

  static findByPerfil(perfil) {
    const db = getDb();
    return db.prepare(`
      SELECT id, nome, email, perfil, cpf
      FROM usuarios WHERE perfil = ? AND ativo = 1 ORDER BY nome
    `).all(perfil);
  }

  static update(id, { nome, email, perfil, cpf, ativo, senha, must_change_password }) {
    const db = getDb();
    const user = this.findById(id);
    if (!user) return null;

    const updates = [];
    const values = [];

    if (nome !== undefined) { updates.push('nome = ?'); values.push(nome); }
    if (email !== undefined) { updates.push('email = ?'); values.push(email); }
    if (perfil !== undefined) { updates.push('perfil = ?'); values.push(perfil); }
    if (cpf !== undefined) { updates.push('cpf = ?'); values.push(cpf); }
    if (ativo !== undefined) { updates.push('ativo = ?'); values.push(ativo ? 1 : 0); }
    if (senha) {
      updates.push('senha = ?');
      values.push(bcrypt.hashSync(senha, 10));
    }
    if (must_change_password !== undefined) {
      updates.push('must_change_password = ?');
      values.push(must_change_password ? 1 : 0);
    }

    if (updates.length === 0) return user;

    updates.push("updated_at = datetime('now', 'localtime')");
    values.push(id);

    db.prepare(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  static delete(id) {
    const db = getDb();
    const info = db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
    return info.changes > 0;
  }

  static verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compareSync(plainPassword, hashedPassword);
  }

  static count() {
    const db = getDb();
    return db.prepare('SELECT COUNT(*) as total FROM usuarios').get().total;
  }

  static hasAdmin() {
    const db = getDb();
    const result = db.prepare("SELECT COUNT(*) as total FROM usuarios WHERE perfil = 'ADMIN'").get();
    return result.total > 0;
  }

  static clearMustChangePassword(id) {
    const db = getDb();
    db.prepare("UPDATE usuarios SET must_change_password = 0, updated_at = datetime('now', 'localtime') WHERE id = ?").run(id);
    return this.findById(id);
  }
}

module.exports = User;