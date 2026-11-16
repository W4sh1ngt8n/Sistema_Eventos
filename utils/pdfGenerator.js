const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { getDb } = require('../config/database');
const { formatarCPF } = require('./cpfValidator');
const CONFIG = require('../config/certificado');

function formatarDataExtenso(dataStr) {
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const partes = dataStr.split('-');
  if (partes.length !== 3) return dataStr;
  const dia = parseInt(partes[2]);
  const mes = parseInt(partes[1]) - 1;
  const ano = parseInt(partes[0]);
  return `${dia} de ${meses[mes]} de ${ano}`;
}

// Data de emissão do certificado por extenso (hoje)
function dataHojeExtenso() {
  const agora = new Date();
  const iso = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
  return formatarDataExtenso(iso);
}

// Resolve o caminho de uma imagem e AVISA claramente se o arquivo não existir
function resolverImagem(caminho, rotulo) {
  if (!caminho) return null;
  const p = path.isAbsolute(caminho) ? caminho : path.resolve(process.cwd(), caminho);
  if (fs.existsSync(p)) return p;
  console.warn(
    `⚠️ ${rotulo}: arquivo não encontrado em "${p}".\n` +
    `   O certificado será gerado sem esta imagem. ` +
    `Verifique o nome e a pasta do arquivo (ou desative em config/certificado.js).`
  );
  return null;
}

// Retorna o caminho da imagem de assinatura conforme o token configurado
function caminhoImagemAssinatura(token) {
  if (token === 'comissao') return CONFIG.assinaturaComissaoPath;
  if (token === 'direcao') return CONFIG.assinaturaDirecaoPath;
  if (token === 'academica') return CONFIG.assinaturaAcademicaPath;
  return null;
}

// Desenha um certificado completo no documento informado.
// Usado tanto pelo certificado individual quanto pelo lote (uma página por participante).
function desenharCertificado(doc, { nome, cpf, eventoNome, eventoData, cargaHoraria, textoAtividade, registro }) {
  const pageWidth = doc.page.width;
  const centerX = pageWidth / 2;

  // Borda institucional
  doc.rect(20, 20, pageWidth - 40, doc.page.height - 40).strokeColor('#1a237e').lineWidth(3).stroke();
  doc.rect(30, 30, pageWidth - 60, doc.page.height - 60).strokeColor('#1a237e').lineWidth(1).stroke();

  // ===== LOGO (com diagnóstico e dimensionamento automático) =====
  const logoPath = resolverImagem(CONFIG.logoPath, 'Logo institucional');
  let alturaLogo = 0;
  if (logoPath) {
    try {
      const img = doc.openImage(logoPath);
      let larguraLogo = 140;
      alturaLogo = larguraLogo * img.height / img.width;
      if (alturaLogo > 90) {
        alturaLogo = 90;
        larguraLogo = 90 * img.width / img.height;
      }
      doc.image(logoPath, centerX - larguraLogo / 2, 45, { width: larguraLogo });
    } catch (err) {
      console.error('Erro ao inserir logo no certificado:', err);
      alturaLogo = 0;
    }
  }

  // Posiciona o cursor abaixo do logo (ou no topo, se não houver logo)
  doc.y = 45 + alturaLogo + (logoPath ? 24 : 30);

  // ===== ABERTURA =====
  doc.fontSize(16).fillColor('#000000').font('Helvetica')
    .text(`O ${CONFIG.instituicao} certifica que`, { align: 'center' });

  doc.moveDown(1.5);

  // ===== NOME DO PARTICIPANTE =====
  doc.fontSize(26).font('Helvetica-Bold').fillColor('#1a237e')
    .text(nome, { align: 'center' });

  doc.moveDown(1);

  // ===== TEXTO DA ATIVIDADE =====
  const atividade = textoAtividade ||
    `participou do evento "${eventoNome}", realizado em ${formatarDataExtenso(eventoData)}, ` +
    `com carga horária de ${cargaHoraria} hora(s).`;

  doc.fontSize(14).font('Helvetica').fillColor('#000000')
    .text(atividade, { align: 'center' });

  doc.moveDown(1);

  // ===== CPF =====
  doc.fontSize(12).font('Helvetica').fillColor('#000000')
    .text(`CPF: ${formatarCPF(cpf)}`, { align: 'center' });

  // ===== LOCAL E DATA POR EXTENSO =====
  doc.moveDown(2);
  doc.fontSize(13).font('Helvetica')
    .text(`${CONFIG.cidade}, ${dataHojeExtenso()}.`, { align: 'center' });

  // ===== REGISTRO CEC =====
  if (registro) {
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica')
      .text(`Registro CEC: ${registro}`, { align: 'center' });
  }

  // ===== ASSINATURAS (com imagens opcionais de comissão e direção) =====
  doc.moveDown(2);
  const assinaturas = CONFIG.assinaturas;
  const n = assinaturas.length;
  const larguraColuna = (pageWidth - 120) / n;

  const imagens = assinaturas.map(a => {
    const p = resolverImagem(caminhoImagemAssinatura(a.assinatura), `Imagem de assinatura (${a.assinatura || 'não configurada'})`);
    if (!p) return null;
    try {
      const img = doc.openImage(p);
      let largura = Math.min(150, larguraColuna - 24);
      let altura = largura * img.height / img.width;
      if (altura > 60) {
        altura = 60;
        largura = 60 * img.width / img.height;
      }
      return { path: p, largura, altura };
    } catch (err) {
      console.error('Erro ao ler imagem de assinatura:', err);
      return null;
    }
  });

  const maiorAlturaImagem = Math.max(0, ...imagens.map(i => (i ? i.altura : 0)));
  const yLinha = doc.y + maiorAlturaImagem + (maiorAlturaImagem > 0 ? 14 : 40);

  assinaturas.forEach((a, i) => {
    const xCentro = 60 + larguraColuna * i + larguraColuna / 2;
    const larguraNome = larguraColuna - 20;

    const im = imagens[i];
    if (im) {
      doc.image(im.path, xCentro - im.largura / 2, yLinha - im.altura - 4, { width: im.largura });
    }

    doc.moveTo(xCentro - larguraNome / 2, yLinha)
      .lineTo(xCentro + larguraNome / 2, yLinha)
      .strokeColor('#000000').lineWidth(1).stroke();

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000')
      .text(a.nome, xCentro - larguraNome / 2, yLinha + 8, { width: larguraNome, align: 'center' });

    doc.fontSize(10).font('Helvetica')
      .text(a.cargo, xCentro - larguraNome / 2, yLinha + 24, { width: larguraNome, align: 'center' });
  });
}

// Certificado individual — um PDF com uma página
function gerarCertificadoPDF(res, dados) {
  const doc = new PDFDocument({
    layout: 'landscape',
    size: 'A4',
    margin: 50
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename=certificado.pdf');

  doc.pipe(res);
  desenharCertificado(doc, dados);
  doc.end();
}

function gerarRelatorioEventoPDF(res, evento, dados) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=relatorio_${evento.id}.pdf`);
  doc.pipe(res);

  // Título
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#1a237e')
    .text('RELATÓRIO DE EVENTO', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(14).font('Helvetica').fillColor('#000000')
    .text(evento.nome, { align: 'center' });
  doc.text(`Data: ${evento.data} | Local: ${evento.local || 'N/A'}`);
  doc.text(`Inscritos: ${dados.totalInscritos} | Presentes: ${dados.totalPresentes} | Trabalhos: ${dados.totalTrabalhos}`);
  doc.moveDown(1.5);

  // Seção 1: Inscritos
  doc.fontSize(14).font('Helvetica-Bold').text('1. Inscritos', { underline: true });
  doc.moveDown(0.3);

  if (dados.inscritos.length === 0) {
    doc.fontSize(11).font('Helvetica').text('Nenhum inscrito registrado.');
  } else {
    dados.inscritos.forEach((p, i) => {
      doc.fontSize(10).font('Helvetica')
        .text(`${i + 1}. ${p.nome} — CPF: ${formatarCPF(p.cpf)} — Tipo: ${p.tipo}${p.presente ? ' ✅ Presente' : ' ❌ Ausente'}`);
    });
  }

  doc.moveDown(1.5);

  // Seção 2: Trabalhos Submetidos
  doc.fontSize(14).font('Helvetica-Bold').text('2. Trabalhos Submetidos', { underline: true });
  doc.moveDown(0.3);

  if (dados.trabalhos.length === 0) {
    doc.fontSize(11).font('Helvetica').text('Nenhum trabalho submetido.');
  } else {
    dados.trabalhos.forEach((t, i) => {
      // Quebra de página se estiver perto do fim da folha
      if (doc.y > doc.page.height - 120) {
        doc.addPage();
      }

      doc.fontSize(10).font('Helvetica-Bold')
        .text(`${i + 1}. ${t.titulo}`);
      doc.fontSize(9).font('Helvetica')
        .text(`   Autor: ${formatarCPF(t.cpf_autor)} — Modalidade: ${(t.modalidade || '').replace(/_/g, ' ')} — Status: ${(t.status || '').replace(/_/g, ' ')}`);

      if (t.avaliadores_nomes) {
        doc.text(`   Avaliadores: ${t.avaliadores_nomes}`);
      }
      if (t.media !== null && t.media !== undefined) {
        doc.text(`   Média: ${t.media}`);
      } else if (t.notas) {
        doc.text(`   Notas: ${t.notas}`);
      }
      doc.moveDown(0.3);
    });
  }

  doc.end();
}

function gerarRelatorioSemestralPDF(res, dados) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=relatorio_semestral_${dados.ano}_${dados.semestre}.pdf`);
  doc.pipe(res);

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#1a237e')
    .text('RELATÓRIO SEMESTRAL DE PARTICIPAÇÃO', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(14).font('Helvetica').fillColor('#000000')
    .text(`${dados.ano} — ${dados.semestre}º Semestre`, { align: 'center' });
  doc.moveDown(2);

  if (dados.alunos.length === 0) {
    doc.text('Nenhum registro encontrado para o período.');
  } else {
    // Tabela
    const tableTop = doc.y;
    const colX = [50, 200, 320, 420, 480];

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Nome', colX[0], tableTop);
    doc.text('CPF', colX[1], tableTop);
    doc.text('Eventos', colX[2], tableTop);
    doc.text('Horas', colX[3], tableTop);
    doc.text('Presenças', colX[4], tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
    doc.moveDown(1);

    dados.alunos.forEach((aluno, i) => {
      const y = tableTop + 25 + (i * 20);
      doc.fontSize(9).font('Helvetica');
      doc.text(aluno.nome, colX[0], y);
      doc.text(formatarCPF(aluno.cpf), colX[1], y);
      doc.text(String(aluno.total_eventos), colX[2], y);
      doc.text(String(aluno.total_horas), colX[3], y);
      doc.text(String(aluno.total_presencas), colX[4], y);
    });
  }

  doc.end();
}

module.exports = { gerarCertificadoPDF, desenharCertificado, gerarRelatorioEventoPDF, gerarRelatorioSemestralPDF };
