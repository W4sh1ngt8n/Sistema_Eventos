function roleMiddleware(...perfisPermitidos) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    if (!perfisPermitidos.includes(req.user.perfil)) {
      return res.status(403).json({
        error: `Acesso negado. Perfis permitidos: ${perfisPermitidos.join(', ')}`
      });
    }

    next();
  };
}

module.exports = roleMiddleware;