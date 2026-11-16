const jwt = require('jsonwebtoken');
const User = require('../models/User');

class AuthController {
  // Verifica se já existe admin cadastrado (público)
  static async hasAdmin(req, res) {
    return res.json({ hasAdmin: User.hasAdmin() });
  }

  static async login(req, res) {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    const user = User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    if (!user.ativo) {
      return res.status(403).json({ error: 'Conta desativada. Contate a direção.' });
    }

    if (!User.verifyPassword(senha, user.senha)) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        nome: user.nome,
        perfil: user.perfil,
        must_change_password: !!user.must_change_password
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        perfil: user.perfil,
        cpf: user.cpf,
        must_change_password: !!user.must_change_password
      }
    });
  }

  static async me(req, res) {
    const user = User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    return res.json({ user });
  }

  static async changePassword(req, res) {
    const { senhaAtual, novaSenha } = req.body;

    if (!senhaAtual || !novaSenha) {
      return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias.' });
    }

    if (novaSenha.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
    }

    if (novaSenha === '123456') {
      return res.status(400).json({ error: 'A nova senha não pode ser a senha padrão.' });
    }

    const user = User.findByEmail(req.user.email);
    if (!user || !User.verifyPassword(senhaAtual, user.senha)) {
      return res.status(401).json({ error: 'Senha atual incorreta.' });
    }

    User.update(req.user.id, { senha: novaSenha, must_change_password: false });
    return res.json({ message: 'Senha alterada com sucesso.' });
  }

  // Troca forçada no primeiro acesso — não exige senha atual
  static async forceChangePassword(req, res) {
    const { novaSenha } = req.body;

    if (!novaSenha) {
      return res.status(400).json({ error: 'Nova senha é obrigatória.' });
    }

    if (novaSenha.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres.' });
    }

    if (novaSenha === '123456') {
      return res.status(400).json({ error: 'A nova senha não pode ser igual à senha padrão.' });
    }

    const updatedUser = User.clearMustChangePassword(req.user.id);
    User.update(req.user.id, { senha: novaSenha, must_change_password: false });

    // Emitir novo token sem a flag must_change_password
    const token = jwt.sign(
      {
        id: updatedUser.id,
        email: updatedUser.email,
        nome: updatedUser.nome,
        perfil: updatedUser.perfil,
        must_change_password: false
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    return res.json({
      message: 'Senha alterada com sucesso!',
      token,
      user: {
        id: updatedUser.id,
        nome: updatedUser.nome,
        email: updatedUser.email,
        perfil: updatedUser.perfil,
        cpf: updatedUser.cpf,
        must_change_password: false
      }
    });
  }

  // Setup inicial — cria o primeiro ADMIN
  static async setup(req, res) {
    const { nome, email, senha } = req.body;

    if (User.count() > 0) {
      return res.status(403).json({ error: 'Sistema já configurado. Use o login normal.' });
    }

    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
    }

    if (senha.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres.' });
    }

    const user = User.create({ nome, email, senha, perfil: 'ADMIN' });
    // O admin de setup não precisa trocar senha
    User.update(user.id, { must_change_password: false });

    return res.status(201).json({
      message: 'Conta administrador criada com sucesso! Faça login para continuar.',
      user
    });
  }
}

module.exports = AuthController;