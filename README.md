Sistema de Gestão de Eventos Acadêmicos do Centro Universitário de Goianésia (UNIEGO). Plataforma completa para criação de eventos, inscrições com QR Code, credenciamento via leitor USB, submissão e avaliação de trabalhos, geração de certificados em PDF e relatórios. Suporta eventos gratuitos e pagos com pagamento via Pix.

---

## 📋 Sumário

- [Visão Geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Arquitetura MVC](#arquitetura-mvc)
- [Estrutura de Diretórios](#estrutura-de-diretórios)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Primeiro Acesso](#primeiro-acesso)
- [Perfis de Acesso](#perfis-de-acesso)
- [Matriz de Permissões](#matriz-de-permissões)
- [Endpoints da API](#endpoints-da-api)
- [Banco de Dados](#banco-de-dados)
- [Fluxo de Pagamento Pix](#fluxo-de-pagamento-pix)
- [Credenciamento via Leitor USB](#credenciamento-via-leitor-usb)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Backup e Restauração](#backup-e-restauração)
- [Solução de Problemas](#solução-de-problemas)

---

## Visão Geral

O UNIEGO Eventos é um sistema web autônomo, construído em **Node.js + Express + SQLite**, que substituiu completamente a dependência anterior de Google Apps Script e Firebase. O sistema opera localmente sem necessidade de serviços externos pagos, mantendo total soberania sobre os dados institucionais.

A autenticação é própria (sem Google/Firebase), utilizando **JWT** para sessões stateless e **bcrypt** para hash de senhas. O frontend é vanilla (HTML/CSS/JS puro, sem frameworks), garantindo compatibilidade universal e performance em hardware modesto.

---

## Funcionalidades

### Gestão de Eventos
- Criar, editar e excluir eventos
- Eventos **gratuitos** ou **pagos** (com Pix)
- Controle de vagas em tempo real
- Detecção de conflito de horários na inscrição
- Carga horária configurável por evento

### Inscrições
- Inscrição pública (sem login obrigatório)
- Validação de CPF (algoritmo de dígitos verificadores)
- Geração de QR Code único por inscrição
- Para eventos pagos: exibição de QR Code da chave Pix + campo de comprovante

### Credenciamento
- Leitor de QR Code **USB** (funciona como teclado HID)
- Credenciamento manual por CPF
- **Bloqueio automático** de credenciamento para pagamentos não validados
- Seleção do evento ativo na portaria
- Lista de presenças em tempo real

### Validação de Pagamentos
- Aba dedicada na portaria para validação
- Monitores, Organização e Direção podem validar
- Trilha de auditoria (quem validou e quando)
- Botão de reset de senha para 123456

### Trabalhos Acadêmicos
- Submissão pública de trabalhos (4 modalidades)
- Atribuição de avaliadores pela Organização/Direção
- Avaliadores veem apenas trabalhos delegados a eles
- Notas de 0,0 a 10,0 com parecer técnico
- Status automático: SUBMETIDO → EM_AVALIACAO → AVALIADO
- Cálculo automático de média quando todas as avaliações são concluídas

### Certificados e Relatórios
- Certificados individuais e em lote (PDF A4 paisagem)
- Só gerados para participantes credenciados
- Relatório de evento (inscritos, presenças, trabalhos)
- Relatório semestral consolidado (para Atividades Complementares)

### Segurança
- Sistema de login próprio com email + senha
- Senhas hasheadas com bcrypt (10 rounds)
- Troca obrigatória de senha no primeiro acesso
- Senha padrão 123456 para novos cadastros
- Controle de acesso por perfil (RBAC)
- Bloqueio de todas as rotas até trocar senha padrão

---

## Tecnologias Utilizadas

| Tecnologia | Versão | Papel no Projeto |
|-----------|--------|-----------------|
| **Node.js** | 18+ | Runtime JavaScript para o servidor backend |
| **Express** | 4.x | Framework web para roteamento e middlewares |
| **better-sqlite3** | 11.x | Driver SQLite síncrono — alta performance local |
| **jsonwebtoken** | 9.x | Geração e validação de tokens JWT |
| **bcryptjs** | 2.x | Hash de senhas com salt |
| **pdfkit** | 0.15.x | Geração de PDFs (certificados e relatórios) |
| **qrcode** | 1.5.x | Geração de QR Codes (inscrição e chave Pix) |
| **dotenv** | 16.x | Carregamento de variáveis de ambiente |
| **cors** | 2.x | Middleware CORS |
| **HTML5/CSS3/JS** | — | Frontend vanilla, sem framework |

---

## Arquitetura MVC

O projeto segue o padrão **Model-View-Controller** com separação clara de responsabilidades:
```
Cliente (Navegador)
    │
    ▼ fetch HTTP
Express (server.js)
    │
    ▼ roteamento
routes/index.js ──── middlewares (auth + role)
    │
    ▼
Controllers (validação de entrada, formatação de resposta)
    │
    ▼
Models (regras de negócio, queries SQL)
    │
    ▼
SQLite (config/database.js)
```

- **Model**: Encapsula queries SQL e regras de negócio (vagas, conflitos, bloqueios)
- **View**: HTML/CSS/JS puro servido como estático, comunicação via fetch API
- **Controller**: Recebe requisições, valida dados, chama models, retorna JSON
- **Middlewares**: Interceptam requisições para autenticação JWT e controle de perfil
- **Utils**: Funções reutilizáveis (CPF, QR Code, PDF)

---

## Estrutura de Diretórios
```
uniego-eventos/
├── package.json
├── .env.example
├── .gitignore
├── server.js                      # Entry point
├── README.md
├── config/
│   └── database.js                # SQLite + tabelas + migrações
├── models/
│   ├── User.js
│   ├── Event.js
│   ├── Registration.js
│   ├── Attendance.js
│   ├── Work.js
│   └── Evaluation.js
├── controllers/
│   ├── AuthController.js
│   ├── UserController.js
│   ├── EventController.js
│   ├── RegistrationController.js
│   ├── AttendanceController.js
│   ├── WorkController.js
│   ├── EvaluationController.js
│   └── ReportController.js
├── middlewares/
│   ├── authMiddleware.js          # Valida JWT + bloqueia troca de senha
│   └── roleMiddleware.js          # Controle de perfil
├── routes/
│   └── index.js                   # Todos os endpoints
├── utils/
│   ├── cpfValidator.js
│   ├── qrToken.js
│   └── pdfGenerator.js
├── public/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── app.js
│   │   ├── login.js
│   │   ├── portal.js
│   │   ├── admin.js
│   │   ├── attendance.js
│   │   ├── registration.js
│   │   ├── evaluation.js
│   │   ├── userManagement.js
│   │   ├── workSubmission.js
│   │   └── changePassword.js
│   └── pages/
│       ├── login.html
│       ├── portal.html
│       ├── publicPortal.html
│       ├── admin.html
│       ├── monitor.html
│       ├── attendance.html
│       ├── registration.html
│       ├── evaluation.html
│       ├── userManagement.html
│       ├── workSubmission.html
│       └── changePassword.html
└── data/                          # Gerado automaticamente
    └── uniego.db                  # Banco SQLite (NÃO versionar)
```

---

## Pré-requisitos

- **Node.js** 18 ou superior — [https://nodejs.org](https://nodejs.org)
- **NPM** (instalado junto com Node.js)
- Sistema operacional: Linux, Windows ou macOS

Verificar instalação:
```bash
node -v   # deve mostrar v18.x.x ou superior
npm -v    # deve mostrar 9.x.x ou superior
```

---

## Instalação

### 1. Clonar ou criar o projeto
```bash
# Se vier do Git
git clone https://github.com/SEU-USUARIO/uniego-eventos.git
cd uniego-eventos

# Ou criar do zero — criar a estrutura de pastas e arquivos manualmente
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar ambiente
```bash
cp .env.example .env
```

Editar o arquivo `.env` e **alterar obrigatoriamente** a variável `JWT_SECRET`:
```env
PORT=3000
NODE_ENV=production
JWT_SECRET=sua-chave-secreta-muito-longa-e-aleatoria-aqui
JWT_EXPIRES_IN=8h
DB_PATH=./data/uniego.db
APP_NAME=UNIEGO Eventos
APP_URL=http://localhost:3000
```

### 4. Iniciar o servidor
```bash
# Produção
npm start

# Desenvolvimento (reinicia automaticamente ao salvar arquivos)
npm run dev
```

### 5. Acessar o sistema

Abrir no navegador: **http://localhost:3000**

---

## Configuração

### Arquivo `.env`

| Variável | Obrigatório | Default | Descrição |
|----------|:-----------:|---------|-----------|
| `PORT` | ❌ | `3000` | Porta HTTP do servidor |
| `NODE_ENV` | ❌ | `production` | Ambiente de execução |
| `JWT_SECRET` | ✅ | — | Chave criptográfica para assinar tokens JWT |
| `JWT_EXPIRES_IN` | ❌ | `8h` | Tempo de validade do token |
| `DB_PATH` | ❌ | `./data/uniego.db` | Caminho do arquivo SQLite |
| `APP_NAME` | ❌ | `UNIEGO Eventos` | Nome da aplicação |
| `APP_URL` | ❌ | `http://localhost:3000` | URL base |

> ⚠️ **Nunca** versionar o arquivo `.env` no Git. Ele está no `.gitignore`.

### Gerar uma chave JWT segura
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copie o resultado e cole em `JWT_SECRET`.

---

## Primeiro Acesso

Ao iniciar o sistema pela primeira vez:

1. Acesse **http://localhost:3000**
2. A landing page exibirá 5 botões de acesso
3. Clique em qualquer botão de perfil (ex: "Direção")
4. No modal de login, clique em **"Primeiro acesso? Configurar sistema"**
5. Preencha: nome, email e senha (mín. 6 caracteres) do administrador
6. O sistema criará a conta **ADMIN** e ocultará o link de setup
7. Faça login com as credenciais criadas
8. Comece a cadastrar eventos e usuários

> O link de setup só aparece quando **não existe nenhum usuário** no banco. Após criar o primeiro admin, ele desaparece automaticamente.

---

## Perfis de Acesso

O sistema possui 5 perfis de usuário, cada um com permissões específicas:

### ADMIN
- Acesso **total e irrestrito** a todos os módulos
- Pode criar, editar, excluir eventos e usuários
- Pode avaliar trabalhos e gerar todos os relatórios

### DIRECAO
- Gestão de eventos, usuários (cadastro), certificados e relatórios
- Pode validar pagamentos e credenciar
- Pode atribuir avaliadores a trabalhos
- Não pode excluir eventos ou usuários (apenas ADMIN)

### ORGANIZACAO
- Gestão de eventos e credenciamento
- Pode validar pagamentos e atribuir avaliadores
- Pode gerar certificados e relatórios de evento
- Não acessa gestão de usuários nem relatório semestral

### MONITOR
- Credenciamento via QR Code USB e CPF
- Validação de pagamentos
- Submissão de trabalhos
- **Não** tem acesso à lista de trabalhos submetidos
- **Não** pode atribuir avaliadores

### AVALIADOR
- Visualiza **apenas** os trabalhos delegados a ele
- Registra notas (0-10) e pareceres técnicos
- Não acessa outras funcionalidades do sistema

---

## Matriz de Permissões

| Funcionalidade | Público | MONITOR | AVALIADOR | ORGANIZACAO | DIRECAO | ADMIN |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Inscrever-se em evento | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| Submeter trabalho | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| Ver lista de trabalhos | ❌ | ❌ | ✅ (delegados) | ✅ | ✅ | ✅ |
| Credenciamento | ❌ | ✅ | — | ✅ | ✅ | ✅ |
| Validar pagamento | ❌ | ✅ | — | ✅ | ✅ | ✅ |
| Reverter validação | ❌ | ❌ | — | ✅ | ✅ | ✅ |
| Avaliar trabalhos | ❌ | — | ✅ | — | — | ✅ |
| Atribuir avaliador | ❌ | — | — | ✅ | ✅ | ✅ |
| Criar/editar eventos | ❌ | — | — | ✅ | ✅ | ✅ |
| Excluir eventos | ❌ | — | — | — | — | ✅ |
| Cadastrar usuários | ❌ | — | — | — | ✅ | ✅ |
| Excluir usuários | ❌ | — | — | — | — | ✅ |
| Gerar certificados | ❌ | — | — | ✅ | ✅ | ✅ |
| Relatório semestral | ❌ | — | — | — | ✅ | ✅ |

---

## Endpoints da API

Todas as rotas estão sob o prefixo `/api`.

### Autenticação

| Método | Rota | Auth | Descrição |
|--------|------|:----:|-----------|
| GET | `/auth/has-admin` | ❌ | Verifica se já existe admin |
| POST | `/auth/setup` | ❌ | Cria primeiro admin (uma vez) |
| POST | `/auth/login` | ❌ | Login com email + senha |
| GET | `/auth/me` | ✅ | Dados do usuário logado |
| PUT | `/auth/password` | ✅ | Troca de senha (exige senha atual) |
| PUT | `/auth/force-change-password` | ✅ | Troca forçada no primeiro acesso |

### Usuários (DIRECAO + ADMIN)

| Método | Rota | Perfis | Descrição |
|--------|------|--------|-----------|
| GET | `/users` | DIRECAO, ADMIN | Lista todos os usuários |
| POST | `/users` | DIRECAO, ADMIN | Cria usuário (senha padrão 123456) |
| PUT | `/users/:id` | DIRECAO, ADMIN | Atualiza usuário |
| DELETE | `/users/:id` | ADMIN | Exclui usuário |
| PUT | `/users/:id/reset-password` | DIRECAO, ADMIN | Reseta senha para 123456 |

### Eventos

| Método | Rota | Auth | Descrição |
|--------|------|:----:|-----------|
| GET | `/events/active` | ❌ | Eventos ativos (inscrição pública) |
| GET | `/events` | ✅ | Todos os eventos |
| GET | `/events/:id` | ✅ | Busca evento por ID |
| POST | `/events` | ORG, DIR, ADMIN | Cria evento |
| PUT | `/events/:id` | ORG, DIR, ADMIN | Atualiza evento |
| DELETE | `/events/:id` | ADMIN | Exclui evento |
| GET | `/events/:id/metrics` | ✅ | KPIs do evento |

### Inscrições

| Método | Rota | Auth | Descrição |
|--------|------|:----:|-----------|
| POST | `/registrations` | ❌ | Cria inscrição (público) |
| GET | `/registrations/cpf/:cpf` | ❌ | Inscrições por CPF |
| GET | `/registrations/event/:evento_id` | ✅ | Inscrições de um evento |
| PUT | `/registrations/:id/validate-payment` | MON, ORG, DIR, ADMIN | Valida pagamento |
| PUT | `/registrations/:id/invalidate-payment` | ORG, DIR, ADMIN | Reverte validação |
| POST | `/registrations/pix-qr` | ❌ | Gera QR Code da chave Pix |

### Credenciamento

| Método | Rota | Perfis | Descrição |
|--------|------|--------|-----------|
| POST | `/attendance/qr` | MON, ORG, DIR, ADMIN | Registra presença via QR Code |
| POST | `/attendance/cpf` | MON, ORG, DIR, ADMIN | Registra presença via CPF |
| GET | `/attendance/event/:evento_id` | ✅ | Lista presenças do evento |

### Trabalhos

| Método | Rota | Auth | Descrição |
|--------|------|:----:|-----------|
| POST | `/works` | ❌ | Submete trabalho (público) |
| GET | `/works/event/:evento_id` | ORG, DIR, ADMIN | Trabalhos de um evento |
| GET | `/works/my-evaluations` | AVAL, ADMIN | Trabalhos delegados ao avaliador |
| POST | `/works/:id/assign` | ORG, DIR, ADMIN | Atribui avaliador |
| GET | `/works/:id/evaluators` | ORG, DIR, ADMIN | Avaliadores de um trabalho |

### Avaliações

| Método | Rota | Perfis | Descrição |
|--------|------|--------|-----------|
| POST | `/evaluations` | AVAL, ADMIN | Registra avaliação |
| GET | `/evaluations/work/:trabalho_id` | AVAL, ORG, DIR, ADMIN | Avaliações de um trabalho |

### Relatórios

| Método | Rota | Perfis | Descrição |
|--------|------|--------|-----------|
| POST | `/reports/certificate` | ORG, DIR, ADMIN | Certificado individual (PDF) |
| POST | `/reports/certificates/batch` | ORG, DIR, ADMIN | Certificados em lote (PDF) |
| GET | `/reports/event/:evento_id` | ORG, DIR, ADMIN | Relatório de evento (PDF) |
| POST | `/reports/semester` | DIR, ADMIN | Relatório semestral (PDF) |

---

## Banco de Dados

O sistema utiliza **SQLite** (arquivo único em `data/uniego.db`). O banco é criado automaticamente na primeira execução, incluindo tabelas e migrações.

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `usuarios` | Operadores autenticados (id, nome, email, senha, perfil, cpf, ativo, must_change_password) |
| `eventos` | Eventos acadêmicos (id, nome, data, horários, vagas, is_paid, valor, pix_key) |
| `inscricoes` | Inscrições (id, evento_id, cpf, nome, qr_token, comprovante_pix, pagamento_validado) |
| `presencas` | Credenciamentos (id, evento_id, cpf, nome, data_hora, metodo) |
| `trabalhos` | Submissões acadêmicas (id, evento_id, cpf_autor, titulo, modalidade, status) |
| `avaliacoes` | Notas e pareceres (id, trabalho_id, avaliador_id, nota, observacoes) |
| `atribuicoes` | Relação N:N trabalhos ↔ avaliadores (UNIQUE) |

### Migrações Automáticas

A função `migrate()` em `config/database.js` verifica se colunas novas existem e as adiciona via `ALTER TABLE` se necessário. Isso permite atualizar bancos existentes sem perda de dados.

---

## Fluxo de Pagamento Pix
```
1. DIRECAO/ADMIN cria evento
   ├── Marca "Pago (com Pix)"
   ├── Informa valor (ex: R$ 50,00)
   └── Informa chave Pix

2. Participante acessa formulário de inscrição
   ├── Seleciona evento pago
   ├── Vê QR Code da chave Pix + valor + chave em texto
   ├── Copia a chave e paga via app do banco
   ├── Cola link/ID do comprovante no campo
   └── Confirma inscrição
       → pagamento_validado = 0 (pendente)

3. MONITOR/ORGANIZACAO/ADMIN na aba "Validação de Pagamentos"
   ├── Vê lista de pendentes
   ├── Verifica comprovante
   └── Clica "✅ Validar"
       → pagamento_validado = 1 (liberado)

4. Credenciamento (QR Code ou CPF)
   ├── Sistema verifica: evento.is_paid && !pagamento_validado
   ├── Se pago e NÃO validado → BLOQUEIA (HTTP 403)
   └── Se gratuito OU pago e validado → Registra presença
```

> O bloqueio de credenciamento é aplicado no **backend** (Model), tornando impossível bypassar via frontend.

---

## Credenciamento via Leitor USB

O sistema substituiu o uso de câmera (`getUserMedia`) por um **leitor de QR Code USB**. Estes leitores funcionam como dispositivos HID (teclado):

1. Conecte o leitor USB ao computador
2. Na tela de Portaria, o campo de input está sempre focado
3. Posicione o leitor sobre o QR Code do crachá/inscrição
4. O leitor envia o código + Enter automaticamente
5. O sistema processa a presença instantaneamente

**Modelos compatíveis**: Qualquer leitor HID USB (Honeywell, Zebra, Netum, Sunzontech, etc.)

**Como funciona tecnicamente**: O leitor emula um teclado. Ao escanear um QR Code, ele "digita" a string do código rapidamente seguida de um Enter. O JavaScript detecta o Enter e submete o formulário automaticamente, sem necessidade de clique no mouse.

---

## Variáveis de Ambiente

### Arquivo `.env.example`
```env
# Servidor
PORT=3000
NODE_ENV=production

# JWT
JWT_SECRET=uniego-super-secret-key-change-this-2026
JWT_EXPIRES_IN=8h

# Database
DB_PATH=./data/uniego.db

# App
APP_NAME=UNIEGO Eventos
APP_URL=http://localhost:3000
```

> ⚠️ **Sempre alterar `JWT_SECRET`** em produção. Use uma string aleatória de no mínimo 32 caracteres.

---

## Backup e Restauração

### Backup

O SQLite armazena todos os dados em um único arquivo. Para fazer backup:
```bash
# Backup simples (copiar o arquivo)
cp data/uniego.db data/backup/uniego_$(date +%Y%m%d_%H%M%S).db

# Backup recomendado (usa .backup do SQLite para consistência)
sqlite3 data/uniego.db ".backup data/backup/uniego_$(date +%Y%m%d).db"
```

Recomenda-se um cron job diário:
```bash
# Edita crontab
crontab -e

# Adiciona backup diário às 2h da manhã
0 2 * * * sqlite3 /home/ton/uniego-eventos/data/uniego.db ".backup /home/ton/uniego-eventos/data/backup/uniego_$(date +\%Y\%m\%d).db"
```

### Restauração
```bash
# Parar o servidor
# Copiar o backup de volta
cp data/backup/uniego_20260801.db data/uniego.db

# Reiniciar o servidor
npm start
```

---

## Solução de Problemas

### Erro: `SyntaxError: Unexpected end of input`

**Causa**: Um arquivo JavaScript foi copiado incompleto (cortado antes de fechar chaves).

**Solução**: Verificar qual arquivo aparece no erro e recopiá-lo integralmente.

---

### Erro: `ReferenceError: router is not defined`

**Causa**: A rota `pix-qr` foi colada antes da declaração `const router = express.Router()`.

**Solução**: Garantir que `routes/index.js` tenha `const router = express.Router();` antes de qualquer `router.post(...)`.

---

### Erro: `npm WARN EBADENGINE`

**Causa**: Algumas dependências pedem Node 20+, mas você está com Node 18.

**Solução**: É apenas um **warning**, não impede o funcionamento. Se quiser eliminar:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

---

### CSS desconfigurado (página sem estilo)

**Causa**: O arquivo `public/css/style.css` está incompleto ou corrompido.

**Solução**: Recopiar o arquivo `style.css` integralmente e forçar refresh no navegador com `Ctrl+Shift+R`.

---

### Eventos não cadastram / dropdown "Carregando..." travado

**Causa**: Erro no `admin.js` impedindo a chamada à API, ou backend não está rodando.

**Solução**:
1. Verificar se o servidor está rodando (`npm start`)
2. Abrir o Console do navegador (F12) e verificar erros em `admin.js`
3. Verificar se a rota `GET /api/events` retorna dados (testar no navegador: `http://localhost:3000/api/events`)

---

### Leitor USB não registra presença

**Causa**: O campo de input perdeu o foco.

**Solução**: Clicar no campo de input QR Code. O sistema restaura o foco automaticamente, mas um clique manual resolve imediatamente.

---

### Login funciona mas redireciona para troca de senha

**Comportamento esperado**: Se o usuário foi cadastrado pela Direção, recebe a senha padrão `123456` e **deve** trocá-la no primeiro acesso. O sistema bloqueia todas as funcionalidades até a troca.

**Solução**: Definir uma nova senha (mín. 6 caracteres, não pode ser 123456) na tela de troca obrigatória.

---

### Esqueci a senha do admin

**Solução**: Não há recuperação por email. Opções:

1. Se há outro admin/DIRECAO: eles podem resetar sua senha para 123456
2. Se é o único admin: resetar o banco (perde todos os dados):
```bash
   rm data/uniego.db
   npm start
   # Fazer o setup inicial novamente
```

---

## Desenvolvimento

### Modo desenvolvimento
```bash
npm run dev
```

Usa `nodemon` para reiniciar o servidor automaticamente quando arquivos são salvos.

### Estrutura de um novo endpoint

Para adicionar uma nova funcionalidade:

1. **Model**: Adicionar método em `models/Entidade.js`
2. **Controller**: Adicionar método em `controllers/EntidadeController.js`
3. **Route**: Adicionar rota em `routes/index.js` com middlewares apropriados
4. **Frontend**: Criar/modificar HTML e JS em `public/`

### Convenções de Código

- Models usam métodos `static` (não requerem `new`)
- Controllers são `async` e retornam `res.json()` ou `res.status().json()`
- Booleanos no SQLite são `INTEGER` (0/1), convertidos com `!!` no model
- Senhas nunca são retornadas em queries (SELECT sem `*` ou sem campo `senha`)
- Validações de negócio ficam nos Models (não nos Controllers)
- Validações de entrada ficam nos Controllers

---

## Licença

Projeto institucional do Centro Universitário de Goianésia (UNIEGO). Uso interno.

---

## Suporte

Para dúvidas técnicas ou problemas:

- Verificar a seção [Solução de Problemas](#solução-de-problemas)
- Consultar a Documentação Técnica completa (PDF)
- Verificar o Console do navegador (F12) para erros de frontend
- Verificar o terminal do servidor para erros de backend

---

**UNIEGO Eventos** — Sistema de Gestão de Eventos Acadêmicos
Arquitetura MVC | Node.js + Express + SQLite + JWT
Agosto de 2026
