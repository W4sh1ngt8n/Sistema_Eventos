const Work = require('../models/Work');
const Evaluation = require('../models/Evaluation');
const Event = require('../models/Event');
const User = require('../models/User');
const { limparCPF, formatarCPF, validarCPF } = require('../utils/cpfValidator');

class WorkController {
  static async submit(req, res) {
    const { evento_id, cpf_autor, titulo, modalidade, link_arquivo } = req.body;

    if (!evento_id || !cpf_autor || !titulo || !modalidade || !link_arquivo) {
      return res.status(400).json({ error: 'Evento, CPF, título, modalidade e link do arquivo são obrigatórios.' });
    }

    // Valida evento existente e ativo
    const event = Event.findById(evento_id);
    if (!event) {
      return res.status(404).json({ error: 'Evento não encontrado.' });
    }
    if (!event.ativo) {
      return res.status(400).json({ error: 'Este evento não está ativo para submissão de trabalhos.' });
    }

    const cpfLimpo = limparCPF(cpf_autor);
    if (!validarCPF(cpfLimpo)) {
      return res.status(400).json({ error: 'CPF inválido.' });
    }

    const modalidades = ['RESUMO_EXPANDIDO', 'ARTIGO_COMPLETO', 'POSTER_BANNER', 'INICIACAO_CIENTIFICA'];
    if (!modalidades.includes(modalidade)) {
      return res.status(400).json({ error: `Modalidade inválida. Use: ${modalidades.join(', ')}` });
    }

    try {
      const work = Work.create({
        evento_id,
        cpf_autor: formatarCPF(cpfLimpo),
        titulo,
        modalidade,
        link_arquivo
      });
      return res.status(201).json(work);
    } catch (err) {
      console.error('Erro ao submeter trabalho:', err);
      return res.status(500).json({ error: 'Erro ao submeter trabalho. Tente novamente.' });
    }
  }

  static async findByEvent(req, res) {
    const works = Work.findByEvent(req.params.evento_id);
    // Adiciona média para cada trabalho
    works.forEach(w => {
      const avg = Evaluation.getWorkAverage(w.id);
      w.media = avg.media;
      w.total_avaliacoes = avg.total;
    });
    return res.json(works);
  }

  static async findByEvaluator(req, res) {
    const works = Work.findByEvaluator(req.user.id);
    return res.json(works);
  }

  static async assignEvaluator(req, res) {
    const { id } = req.params;
    const { avaliador_id } = req.body;

    if (!avaliador_id) {
      return res.status(400).json({ error: 'avaliador_id é obrigatório.' });
    }

    // Valida que o usuário existe, está ativo e tem perfil AVALIADOR
    const avaliador = User.findById(avaliador_id);
    if (!avaliador || !avaliador.ativo) {
      return res.status(404).json({ error: 'Avaliador não encontrado ou inativo.' });
    }
    if (avaliador.perfil !== 'AVALIADOR') {
      return res.status(400).json({ error: 'O usuário selecionado não possui o perfil AVALIADOR.' });
    }

    try {
      const work = Work.assignEvaluator(parseInt(id), avaliador_id);
      return res.json(work);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  static async getEvaluators(req, res) {
    const evaluators = Work.getAssignedEvaluators(req.params.id);
    return res.json(evaluators);
  }
}

module.exports = WorkController;