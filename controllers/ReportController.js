const { getDb } = require('../config/database');
const Event = require('../models/Event');
const Attendance = require('../models/Attendance');
const { gerarCertificadoPDF, desenharCertificado, gerarRelatorioEventoPDF, gerarRelatorioSemestralPDF } = require('../utils/pdfGenerator');
const { formatarCPF } = require('../utils/cpfValidator');

class ReportController {
  static async generateCertificate(req, res) {
    const { evento_id, cpf } = req.body;

    if (!evento_id || !cpf) {
      return res.status(400).json({ error: 'evento_id e cpf são obrigatórios.' });
    }

    const db = getDb();
    const inscricao = db.prepare(`
      SELECT i.*, e.nome as evento_nome, e.data as evento_data,
        e.carga_horaria as evento_carga
      FROM inscricoes i
      JOIN eventos e ON i.evento_id = e.id
      WHERE i.evento_id = ? AND i.cpf = ?
    `).get(evento_id, formatarCPF(cpf.replace(/\D/g, '')));

    if (!inscricao) {
      return res.status(404).json({ error: 'Inscrição não encontrada.' });
    }

    const presence = Attendance.findByEventAndCpf(evento_id, inscricao.cpf);
    if (!presence) {
      return res.status(400).json({ error: 'Participante não credenciado neste evento.' });
    }

    // Carga horária vem SEMPRE do evento cadastrado
    gerarCertificadoPDF(res, {
      nome: inscricao.nome,
      cpf: inscricao.cpf,
      eventoNome: inscricao.evento_nome,
      eventoData: inscricao.evento_data,
      cargaHoraria: inscricao.evento_carga || 0
    });
  }

  static async generateBatchCertificates(req, res) {
    const { evento_id } = req.body;

    if (!evento_id) {
      return res.status(400).json({ error: 'evento_id é obrigatório.' });
    }

    const event = Event.findById(evento_id);
    if (!event) {
      return res.status(404).json({ error: 'Evento não encontrado.' });
    }

    const presentes = Attendance.findByEvent(evento_id);
    if (presentes.length === 0) {
      return res.status(400).json({ error: 'Nenhum participante credenciado neste evento.' });
    }

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ layout: 'landscape', size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=certificados_${evento_id}.pdf`);
    doc.pipe(res);

    presentes.forEach((p, index) => {
      if (index > 0) doc.addPage();
      desenharCertificado(doc, {
        nome: p.nome,
        cpf: p.cpf,
        eventoNome: event.nome,
        eventoData: event.data,
        cargaHoraria: event.carga_horaria || 0
      });
    });

    doc.end();
  }

  static async generateEventReport(req, res) {
    const { evento_id } = req.params;
    const event = Event.findById(evento_id);
    if (!event) {
      return res.status(404).json({ error: 'Evento não encontrado.' });
    }

    const db = getDb();
    const inscritos = db.prepare(`
      SELECT i.*, CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END as presente
      FROM inscricoes i
      LEFT JOIN presencas p ON p.inscricao_id = i.id AND p.evento_id = i.evento_id
      WHERE i.evento_id = ?
      ORDER BY i.nome
    `).all(evento_id);

    const trabalhos = db.prepare(`
      SELECT t.*,
        GROUP_CONCAT(u.nome) as avaliadores_nomes,
        GROUP_CONCAT(av.nota) as notas
      FROM trabalhos t
      LEFT JOIN atribuicoes a ON a.trabalho_id = t.id
      LEFT JOIN usuarios u ON a.avaliador_id = u.id
      LEFT JOIN avaliacoes av ON av.trabalho_id = t.id
      WHERE t.evento_id = ?
      GROUP BY t.id
      ORDER BY t.created_at
    `).all(evento_id);

    trabalhos.forEach(t => {
      const avg = require('../models/Evaluation').getWorkAverage(t.id);
      t.media = avg.media;
    });

    gerarRelatorioEventoPDF(res, event, {
      totalInscritos: inscritos.length,
      totalPresentes: inscritos.filter(i => i.presente).length,
      totalTrabalhos: trabalhos.length,
      inscritos,
      trabalhos
    });
  }

  static async generateSemesterReport(req, res) {
    const { ano, semestre } = req.body;

    if (!ano || !semestre) {
      return res.status(400).json({ error: 'Ano e semestre são obrigatórios.' });
    }

    const db = getDb();
    const inicioMes = semestre === 1 ? '01' : '07';
    const fimMes = semestre === 1 ? '06' : '12';

    const alunos = db.prepare(`
      SELECT i.cpf, i.nome,
        COUNT(DISTINCT i.evento_id) as total_eventos,
        SUM(e.carga_horaria) as total_horas,
        COUNT(DISTINCT p.id) as total_presencas
      FROM inscricoes i
      JOIN eventos e ON i.evento_id = e.id
      LEFT JOIN presencas p ON p.inscricao_id = i.id
      WHERE substr(e.data, 1, 4) = ?
        AND substr(e.data, 6, 2) BETWEEN ? AND ?
      GROUP BY i.cpf, i.nome
      ORDER BY i.nome
    `).all(String(ano), inicioMes, fimMes);

    gerarRelatorioSemestralPDF(res, { ano, semestre, alunos });
  }
}

module.exports = ReportController;