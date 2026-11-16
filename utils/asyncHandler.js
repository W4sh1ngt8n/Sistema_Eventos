// Envolve handlers async e encaminha erros ao middleware de erro global do Express.
// Sem isso, uma rejeição em um controller async derruba o processo no Node 18.
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);