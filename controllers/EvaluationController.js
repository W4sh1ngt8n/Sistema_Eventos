const Evaluation = require('../models/Evaluation');

class EvaluationController {
  static async create(req, res) {
    const { trabalho_id, nota, observacoes } = req.body;

    if (!trabalho_id || nota === undefined) {
      return res.status(400).json({ error: 'trabalho_id e nota são obrigatórios.' });
    }

    // Rejeita NaN, null, strings não numéricas e valores fora do intervalo
    const notaNum = Number(nota);
    if (!Number.isFinite(notaNum) || notaNum < 0 || notaNum > 10) {
      return res.status(400).json({ error: 'Nota deve estar entre 0,0 e 10,0.' });
    }

    try {
      const evaluation = Evaluation.create({
        trabalho_id: parseInt(trabalho_id),
        avaliador_id: req.user.id,
        nota: notaNum,
        observacoes
      });
      return res.status(201).json(evaluation);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  static async findByWork(req, res) {
    const trabalhoId = parseInt(req.params.trabalho_id);

    // AVALIADOR só consulta avaliações de trabalhos delegados a ele
    if (req.user.perfil === 'AVALIADOR' && !Evaluation.isEvaluatorAssigned(trabalhoId, req.user.id)) {
      return res.status(403).json({ error: 'Você não está atribuído a este trabalho.' });
    }

    const evaluations = Evaluation.findByWork(trabalhoId);
    const avg = Evaluation.getWorkAverage(trabalhoId);
    return res.json({ evaluations, media: avg.media, total: avg.total });
  }
}

module.exports = EvaluationController;