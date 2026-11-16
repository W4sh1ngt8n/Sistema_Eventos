const jwt = require('jsonwebtoken');

// Rotas que não exigem troca de senha obrigatória
const EXEMPT_PATHS = [
  '/auth/force-change-password',
  '/auth/me',
  '/auth/login',
  '/auth/setup',
  '/auth/has-admin'
];

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Formato de token inválido.' });
  }

  const token = parts[1];

  try {
    // Sem fallback: server.js valida JWT_SECRET no boot e encerra se ausente
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Bloqueia acesso se deve trocar senha (exceto rotas isentas)
    if (decoded.must_change_password) {
      const isExempt = EXEMPT_PATHS.some(p => req.path.includes(p));
      if (!isExempt) {
        return res.status(403).json({
          error: 'É necessário trocar a senha antes de continuar.',
          must_change_password: true
        });
      }
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

module.exports = authMiddleware;