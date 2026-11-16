const path = require('path');

module.exports = {
  // Nome da instituição exatamente como no template oficial
  instituicao: 'Centro Universitário Evangélico de Goianésia',

  // Cidade usada na linha "Goianésia, 17 de novembro de 2026."
  cidade: 'Goianésia',

  // Logo institucional no topo do certificado.
  // Pode ser sobrescrito pela variável de ambiente LOGO_PATH.
  // Para desativar, troque por null.
  logoPath: process.env.LOGO_PATH || path.join(__dirname, '../public/img/logo-sistema.png'),

  // Imagens de assinatura (opcional).
  // assinatura-comissao.png  → aparece na assinatura marcada como 'comissao'
  // assinatura-direcao.png   → aparece na assinatura marcada como 'direcao'
  // Para desativar uma, troque o caminho por null.
  assinaturaComissaoPath: process.env.ASSINATURA_COMISSAO_PATH || path.join(__dirname, '../public/img/assinatura-comissao.png'),
  assinaturaDirecaoPath: process.env.ASSINATURA_DIRECAO_PATH || path.join(__dirname, '../public/img/assinatura-direcao.png'),

  // Assinaturas do template oficial, na ordem do documento.
  // assinatura: 'comissao' | 'direcao' | null → define qual imagem aparece acima da linha
  assinaturas: [
    { nome: 'Dr. José Mateus dos Santos', cargo: 'Reitor', assinatura: 'direcao' },
    { nome: 'Dr. Rodrigo Fernandes de Souza', cargo: 'Diretor Acadêmico', assinatura: null },
    { nome: 'Me. Joaquim Orlando Parada', cargo: 'Coord. do Curso de Eng. Civil', assinatura: 'comissao' }
  ]
};