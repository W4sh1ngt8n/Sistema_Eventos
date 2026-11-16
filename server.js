require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { initDatabase } = require('./config/database');

const routes = require('./routes/index');

// ===== Validação de configuração crítica (falha rápido no boot) =====
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error(
    '❌ JWT_SECRET ausente ou muito curta (mínimo 32 caracteres).\n' +
    '   Gere uma chave segura e coloque no .env:\n' +
    '   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
  process.exit(1);
}

const app = express();

initDatabase();

// Confia no primeiro proxy à frente (Cloudflare Tunnel / Tailscale / Nginx).
// Necessário para o express-rate-limit identificar o IP real do usuário
// a partir do header X-Forwarded-For.
app.set('trust proxy', 1);

// Helmet com CSP desativado: o frontend vanilla usa scripts/estilos inline
app.use(helmet({ contentSecurityPolicy: false }));

// CORS restrito: defina CORS_ORIGIN no .env (ex.: http://meudominio.com,https://meudominio.com)
// Sem CORS_ORIGIN, mantém o comportamento atual para não quebrar o uso local
app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', routes);

// Rota raiz → landing page com 5 botões
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'login.html'));
});

// Fallback
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint não encontrado' });
  }
  res.sendFile(path.join(__dirname, 'public', 'pages', 'login.html'));
});

// ===== Tratamento de erro global (sempre o ÚLTIMO middleware) =====
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[ERRO NÃO TRATADO]', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: 'Erro interno do servidor.' });
});

// Rede de segurança: erros async fora do Express não derrubam mais o processo
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor UNIEGO rodando em http://localhost:${PORT}`);
});