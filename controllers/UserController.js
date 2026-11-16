const User = require('../models/User');
const { validarCPF, formatarCPF } = require('../utils/cpfValidator');

class UserController {
  static async list(req, res) {
    const users = User.findAll();
    return res.json(users);
  }

  static async create(req, res) {
    const { nome, email, perfil, cpf } = req.body;

    if (!nome || !email || !perfil) {
      return res.status(400).json({ error: 'Nome, email e perfil são obrigatórios.' });
    }

    const perfisValidos = ['MONITOR', 'AVALIADOR', 'ORGANIZACAO', 'DIRECAO', 'ADMIN'];
    if (!perfisValidos.includes(perfil)) {
      return res.status(400).json({ error: `Perfil inválido. Use: ${perfisValidos.join(', ')}` });
    }

    // Apenas ADMIN pode criar outros ADMINs
    if (perfil === 'ADMIN' && req.user.perfil !== 'ADMIN') {
      return res.status(403).json({ error: 'Apenas administradores podem criar contas ADMIN.' });
    }

    if (cpf && !validarCPF(cpf)) {
      return res.status(400).json({ error: 'CPF inválido.' });
    }

    const existing = User.findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email já cadastrado.' });
    }

    try {
      // Senha não vem do frontend — usa padrão 123456
      // must_change_password = true é setado no model
      const user = User.create({
        nome,
        email,
        senha: null, // Model usa padrão 123456
        perfil,
        cpf: cpf ? formatarCPF(cpf) : null
      });
      return res.status(201).json({
        ...user,
        message: 'Usuário criado com senha padrão 123456. O usuário deverá alterá-la no primeiro acesso.'
      });
    } catch (err) {
      console.error('Erro ao criar usuário:', err);
      return res.status(500).json({ error: 'Erro ao criar usuário.' });
    }
  }

  static async update(req, res) {
    const { id } = req.params;
    const { nome, email, perfil, cpf, ativo, senha } = req.body;

    const perfisValidos = ['MONITOR', 'AVALIADOR', 'ORGANIZACAO', 'DIRECAO', 'ADMIN'];
    if (perfil !== undefined && !perfisValidos.includes(perfil)) {
      return res.status(400).json({ error: `Perfil inválido. Use: ${perfisValidos.join(', ')}` });
    }

    const target = User.findById(parseInt(id));
    if (!target) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // Apenas ADMIN altera contas ADMIN (bloqueia escalonamento via DIRECAO)
    if (target.perfil === 'ADMIN' && req.user.perfil !== 'ADMIN') {
      return res.status(403).json({ error: 'Apenas administradores podem alterar contas ADMIN.' });
    }

    // Apenas ADMIN promove para ADMIN
    if (perfil === 'ADMIN' && req.user.perfil !== 'ADMIN') {
      return res.status(403).json({ error: 'Apenas administradores podem definir o perfil ADMIN.' });
    }

    if (cpf && !validarCPF(cpf)) {
      return res.status(400).json({ error: 'CPF inválido.' });
    }

    const updateData = {
      nome,
      email,
      perfil,
      cpf: cpf ? formatarCPF(cpf) : undefined,
      ativo,
      senha
    };

    // Se resetar senha, marcar must_change_password
    if (senha) {
      updateData.must_change_password = true;
    }

    try {
      const user = User.update(parseInt(id), updateData);
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }
      return res.json(user);
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Email já cadastrado.' });
      }
      console.error('Erro ao atualizar usuário:', err);
      return res.status(500).json({ error: 'Erro ao atualizar usuário.' });
    }
  }

  static async delete(req, res) {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Você não pode excluir sua própria conta.' });
    }

    const deleted = User.delete(parseInt(id));
    if (!deleted) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    return res.json({ message: 'Usuário excluído com sucesso.' });
  }

  // Resetar senha para padrão 123456
  static async resetPassword(req, res) {
    const { id } = req.params;

    const target = User.findById(parseInt(id));
    if (!target) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // Apenas ADMIN reseta senha de outro ADMIN (bloqueia takeover via DIRECAO)
    if (target.perfil === 'ADMIN' && req.user.perfil !== 'ADMIN') {
      return res.status(403).json({ error: 'Apenas administradores podem resetar a senha de outro administrador.' });
    }

    User.update(parseInt(id), {
      senha: '123456',
      must_change_password: true
    });

    return res.json({
      message: 'Senha resetada para 123456. O usuário deverá alterá-la no próximo acesso.'
    });
  }
}

module.exports = UserController;