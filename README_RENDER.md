# 🦷 DentCarePro - Backend

Sistema de gestão para clínicas odontológicas - API REST + tRPC.

## 🚀 Deploy no Render

Este projeto está otimizado para deploy no **Render.com**.

### 📋 Pré-requisitos

1. **Conta no Render:** [render.com](https://render.com)
2. **Banco de dados Supabase configurado**
3. **Repositório GitHub com o código**

### 🔧 Configuração Passo a Passo

#### 1. Criar Web Service no Render

1. Acesse [dashboard.render.com](https://dashboard.render.com)
2. Clique em **"New +"** → **"Web Service"**
3. Conecte seu repositório GitHub `dentcarepro-backend`
4. Configure:
   - **Name:** `dentcarepro-backend`
   - **Region:** Frankfurt (ou mais próximo de você)
   - **Branch:** `main` ou `master`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free

#### 2. Configurar Variáveis de Ambiente

No Render Dashboard, vá em **Environment** e adicione:

```bash
# Database (OBRIGATÓRIO)
DATABASE_URL=postgresql://postgres.butvnowpjardfxnqevwv:[SUA_SENHA]@aws-0-us-east-1.pooler.supabase.com:6543/postgres

# JWT Secret (OBRIGATÓRIO - gerar novo)
JWT_SECRET=sua_chave_secreta_jwt_aqui_minimo_64_caracteres

# Server (OBRIGATÓRIO)
PORT=10000
NODE_ENV=production

# Frontend URL (OBRIGATÓRIO - após deploy do frontend)
FRONTEND_URL=https://dentcarepro-frontend.vercel.app
```

#### 3. Gerar JWT_SECRET

Execute um destes comandos no terminal:

```bash
# Opção 1: OpenSSL
openssl rand -hex 64

# Opção 2: Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copie o resultado e cole em `JWT_SECRET` no Render.

#### 4. Obter DATABASE_URL do Supabase

1. Acesse [supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecione projeto **DentCarePro NextGen**
3. Vá em **Settings** → **Database**
4. Copie a **Connection String** (Pooler)
5. Substitua `[YOUR-PASSWORD]` pela senha do banco

#### 5. Deploy

1. Clique em **"Create Web Service"**
2. Aguarde o build (5-10 minutos)
3. Após sucesso, copie a URL: `https://dentcarepro-backend.onrender.com`

### ✅ Verificar Deploy

Acesse no navegador:

```
https://dentcarepro-backend.onrender.com/health
```

Deve retornar:

```json
{
  "status": "ok",
  "timestamp": "2025-11-20T..."
}
```

### 🔄 Deploy Automático

O Render faz deploy automático quando você faz push para a branch configurada:

```bash
git add .
git commit -m "Update backend"
git push origin main
```

### 🗄️ Criar Tabelas no Banco de Dados

Após o primeiro deploy, execute as migrações:

1. No Render Dashboard, vá em **Shell**
2. Execute:

```bash
npm run db:push
```

Ou execute o SQL manualmente no Supabase Dashboard.

## 🛠️ Tecnologias

- **Framework:** Express.js
- **Linguagem:** TypeScript
- **API:** tRPC (type-safe)
- **ORM:** Drizzle ORM
- **Banco de Dados:** PostgreSQL (Supabase)
- **Autenticação:** JWT + bcrypt
- **Validação:** Zod

## 📦 Estrutura do Projeto

```
backend/
├── server/
│   ├── _core/           # Core do servidor
│   │   ├── index.ts     # Entry point
│   │   └── trpc.ts      # Configuração tRPC
│   ├── routers/         # Rotas da API
│   │   ├── auth.ts
│   │   ├── patients.ts
│   │   ├── appointments.ts
│   │   └── ...
│   ├── db/              # Database
│   │   ├── schema.ts    # Schema Drizzle
│   │   └── index.ts     # Conexão
│   └── middleware/      # Middlewares
├── shared/              # Tipos compartilhados
├── drizzle/             # Migrações
├── render.yaml          # Configuração Render
├── package.json
└── tsconfig.json
```

## 🔧 Desenvolvimento Local

### Pré-requisitos

- Node.js 18+
- npm ou pnpm
- PostgreSQL (ou usar Supabase)

### Instalação

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas configurações

# Executar migrações
npm run db:push

# Iniciar servidor de desenvolvimento
npm run dev
```

O backend estará disponível em `http://localhost:3000`

### Scripts Disponíveis

```bash
npm run dev       # Servidor de desenvolvimento com hot-reload
npm run build     # Build para produção
npm start         # Iniciar servidor de produção
npm run db:push   # Executar migrações do banco
```

## 🌐 Variáveis de Ambiente

### Produção (Render)

```bash
DATABASE_URL=postgresql://postgres.butvnowpjardfxnqevwv:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
JWT_SECRET=[64_CHARS_RANDOM]
PORT=10000
NODE_ENV=production
FRONTEND_URL=https://dentcarepro-frontend.vercel.app
```

### Desenvolvimento Local

```bash
DATABASE_URL=postgresql://postgres.butvnowpjardfxnqevwv:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
JWT_SECRET=dev_secret_key_change_in_production
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

## 📡 Endpoints da API

### Health Check

```
GET /health
```

### tRPC Router

```
POST /trpc/{procedure}
```

Exemplos:

- `auth.login`
- `auth.register`
- `patients.list`
- `patients.create`
- `appointments.list`
- `appointments.create`

## 🔒 Segurança

- ✅ Autenticação JWT
- ✅ Senha hash com bcrypt
- ✅ Validação de inputs com Zod
- ✅ CORS configurado
- ✅ Rate limiting (recomendado adicionar)
- ✅ Variáveis de ambiente protegidas

## 🐛 Troubleshooting

### Build falha no Render

**Erro:** `Cannot find module...`

**Solução:**

```bash
# Limpar cache
rm -rf node_modules dist
npm install
npm run build
```

### Banco de dados não conecta

**Erro:** `Connection refused` ou `Authentication failed`

**Soluções:**

1. Verificar se `DATABASE_URL` está correto
2. Verificar senha do Supabase
3. Verificar se IP do Render está permitido (Supabase permite todos por padrão)

### JWT_SECRET não configurado

**Erro:** `JWT_SECRET is not defined`

**Solução:**

1. Gerar novo secret: `openssl rand -hex 64`
2. Adicionar no Render Environment Variables
3. Fazer redeploy

### CORS error

**Erro:** `Access-Control-Allow-Origin`

**Solução:**

1. Verificar se `FRONTEND_URL` está correto no Render
2. Verificar se frontend está usando a URL correta do backend
3. Verificar configuração CORS no código

## 📊 Monitoramento

### Logs

No Render Dashboard:

1. Vá em **Logs**
2. Filtre por tipo: `Deploy`, `Runtime`, `Error`

### Métricas

No Render Dashboard:

1. Vá em **Metrics**
2. Monitore: CPU, Memory, Response Time

### Alertas

Configure alertas no Render:

1. **Settings** → **Notifications**
2. Adicione email ou webhook

## 💰 Custos

### Plano Free do Render

- ✅ **Custo:** $0/mês
- ✅ **Recursos:** 512 MB RAM, 0.1 CPU
- ⚠️ **Limitação:** Dorme após 15 min de inatividade
- ⚠️ **Cold start:** ~30s para acordar

### Plano Starter ($7/mês)

- ✅ Sem cold start
- ✅ 512 MB RAM, 0.5 CPU
- ✅ Melhor performance

## 🔄 Atualizações

### Deploy de nova versão

```bash
git add .
git commit -m "feat: nova funcionalidade"
git push origin main
```

Render fará deploy automático.

### Rollback

No Render Dashboard:

1. Vá em **Events**
2. Selecione deploy anterior
3. Clique em **Rollback**

## 📝 Licença

MIT

## 👥 Suporte

Para dúvidas ou problemas:

1. Verificar logs no Render
2. Verificar documentação: [render.com/docs](https://render.com/docs)
3. Abrir issue no repositório

---

**Última atualização:** 20 de Novembro de 2025
