if (!App.requireAuth()) throw new Error('Unauthorized');

App.renderHeader('Portal de Eventos');

const user = App.getUser();
const grid = document.getElementById('portal-grid');

const modulos = [
  { icon: '📊', title: 'Painel Administrativo', desc: 'Gestão de eventos, relatórios e certificados', roles: ['ADMIN', 'DIRECAO', 'ORGANIZACAO'], url: '/pages/admin.html' },
  { icon: '📋', title: 'Espaço do Monitor', desc: 'Credenciamento e submissão de trabalhos', roles: ['MONITOR', 'ADMIN'], url: '/pages/monitor.html' },
  { icon: '✅', title: 'Portaria / Credenciamento', desc: 'Leitor de QR Code USB e CPF', roles: ['MONITOR', 'ORGANIZACAO', 'ADMIN', 'DIRECAO'], url: '/pages/attendance.html' },
  { icon: '🎓', title: 'Avaliação de Trabalhos', desc: 'Avaliar e emitir parecer de trabalhos', roles: ['AVALIADOR', 'ADMIN'], url: '/pages/evaluation.html' },
  // Cadastro de usuários — somente DIRECAO e ADMIN
  { icon: '👥', title: 'Gestão de Usuários', desc: 'Cadastrar e gerenciar operadores', roles: ['ADMIN', 'DIRECAO'], url: '/pages/userManagement.html' },
  { icon: '📄', title: 'Submissão de Trabalho', desc: 'Submeter trabalho acadêmico', roles: ['MONITOR', 'ORGANIZACAO', 'ADMIN', 'DIRECAO'], url: '/pages/workSubmission.html' }
];

const modulosDisponiveis = modulos.filter(m => m.roles.includes(user.perfil));

grid.innerHTML = modulosDisponiveis.map(m => `
  <a href="${m.url}" class="portal-btn">
    <div class="icon">${m.icon}</div>
    <div class="title">${m.title}</div>
    <div class="desc">${m.desc}</div>
  </a>
`).join('');