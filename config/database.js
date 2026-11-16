const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db;

function initDatabase() {
  const dbPath = process.env.DB_PATH || './data/sistema.db';
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createTables();
  migrate();
  criarIndicesUnicos();
  console.log('✅ Banco de dados SQLite inicializado:', dbPath);
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha TEXT NOT NULL,
      perfil TEXT NOT NULL DEFAULT 'MONITOR',
      cpf TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      data TEXT NOT NULL,
      hora_inicio TEXT NOT NULL,
      hora_fim TEXT NOT NULL,
      vagas INTEGER NOT NULL DEFAULT 0,
      local TEXT,
      descricao TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      carga_horaria INTEGER DEFAULT 0,
      is_paid INTEGER NOT NULL DEFAULT 0,
      valor REAL NOT NULL DEFAULT 0,
      pix_key TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS inscricoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evento_id INTEGER NOT NULL,
      cpf TEXT NOT NULL,
      nome TEXT NOT NULL,
      tipo TEXT NOT NULL,
      email TEXT NOT NULL,
      telefone TEXT,
      instituicao TEXT,
      qr_token TEXT NOT NULL UNIQUE,
      comprovante_pix TEXT,
      pagamento_validado INTEGER NOT NULL DEFAULT 0,
      pagamento_validado_por TEXT,
      pagamento_validado_em TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS presencas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evento_id INTEGER NOT NULL,
      inscricao_id INTEGER,
      cpf TEXT NOT NULL,
      nome TEXT NOT NULL,
      data_hora TEXT DEFAULT (datetime('now', 'localtime')),
      metodo TEXT NOT NULL DEFAULT 'QR_CODE',
      credenciado_por TEXT,
      FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE,
      FOREIGN KEY (inscricao_id) REFERENCES inscricoes(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS trabalhos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evento_id INTEGER NOT NULL,
      cpf_autor TEXT NOT NULL,
      titulo TEXT NOT NULL,
      modalidade TEXT NOT NULL,
      link_arquivo TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'SUBMETIDO',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS avaliacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trabalho_id INTEGER NOT NULL,
      avaliador_id INTEGER NOT NULL,
      nota REAL NOT NULL,
      observacoes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (trabalho_id) REFERENCES trabalhos(id) ON DELETE CASCADE,
      FOREIGN KEY (avaliador_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS atribuicoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trabalho_id INTEGER NOT NULL,
      avaliador_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(trabalho_id, avaliador_id),
      FOREIGN KEY (trabalho_id) REFERENCES trabalhos(id) ON DELETE CASCADE,
      FOREIGN KEY (avaliador_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS dispositivos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      chave TEXT NOT NULL UNIQUE,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT DEFAULT (datetime('now', 'localtime')),
      ultimo_uso_em TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_inscricoes_evento ON inscricoes(evento_id);
    CREATE INDEX IF NOT EXISTS idx_inscricoes_cpf ON inscricoes(cpf);
    CREATE INDEX IF NOT EXISTS idx_presencas_evento ON presencas(evento_id);
    CREATE INDEX IF NOT EXISTS idx_presencas_cpf ON presencas(cpf);
    CREATE INDEX IF NOT EXISTS idx_trabalhos_evento ON trabalhos(evento_id);
    CREATE INDEX IF NOT EXISTS idx_trabalhos_status ON trabalhos(status);
    CREATE INDEX IF NOT EXISTS idx_atribuicoes_avaliador ON atribuicoes(avaliador_id);
  `);
}

// Adiciona colunas que podem faltar em bancos criados por versões antigas (idempotente)
function migrate() {
  const adicionarColuna = (tabela, coluna, definicao) => {
    const cols = db.prepare(`PRAGMA table_info(${tabela})`).all().map(c => c.name);
    if (!cols.includes(coluna)) {
      db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
      console.log(`   Coluna adicionada: ${tabela}.${coluna}`);
    }
  };

  adicionarColuna('eventos', 'carga_horaria', 'INTEGER DEFAULT 0');
  adicionarColuna('eventos', 'is_paid', 'INTEGER NOT NULL DEFAULT 0');
  adicionarColuna('eventos', 'valor', 'REAL NOT NULL DEFAULT 0');
  adicionarColuna('eventos', 'pix_key', 'TEXT');

  adicionarColuna('inscricoes', 'comprovante_pix', 'TEXT');
  adicionarColuna('inscricoes', 'pagamento_validado', 'INTEGER NOT NULL DEFAULT 0');
  adicionarColuna('inscricoes', 'pagamento_validado_por', 'TEXT');
  adicionarColuna('inscricoes', 'pagamento_validado_em', 'TEXT');

  adicionarColuna('usuarios', 'cpf', 'TEXT');
  adicionarColuna('usuarios', 'must_change_password', 'INTEGER NOT NULL DEFAULT 0');

  // Nome de quem fez o credenciamento (operador via JWT ou nome do leitor físico)
  adicionarColuna('presencas', 'credenciado_por', 'TEXT');
}

// Índices únicos com verificação de duplicatas (avisa no boot se houver)
function criarIndicesUnicos() {
  const dupInscricoes = db.prepare(`
    SELECT evento_id, cpf, COUNT(*) as total
    FROM inscricoes GROUP BY evento_id, cpf HAVING total > 1
  `).all();
  if (dupInscricoes.length > 0) {
    console.warn('⚠️ Duplicatas em inscricoes (evento_id + cpf) — índice único não criado:');
    dupInscricoes.forEach(d =>
      console.warn(`   evento ${d.evento_id}, cpf ${d.cpf}: ${d.total} registros — remova manualmente`)
    );
  } else {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_inscricoes_evento_cpf ON inscricoes(evento_id, cpf)`);
  }

  const dupPresencas = db.prepare(`
    SELECT evento_id, cpf, COUNT(*) as total
    FROM presencas GROUP BY evento_id, cpf HAVING total > 1
  `).all();
  if (dupPresencas.length > 0) {
    console.warn('⚠️ Duplicatas em presencas (evento_id + cpf) — índice único não criado');
  } else {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_presencas_evento_cpf ON presencas(evento_id, cpf)`);
  }
}

function getDb() {
  if (!db) throw new Error('Banco de dados não inicializado');
  return db;
}

module.exports = { initDatabase, getDb };