# DentCarePro Backend

Backend do sistema DentCarePro SaaS - API REST com tRPC, Express e PostgreSQL.

## 🚀 Tecnologias

- **Node.js** + **Express**
- **tRPC** - Type-safe API
- **Drizzle ORM** - Database ORM
- **PostgreSQL** - Database (Supabase)
- **TypeScript**

## 📦 Instalação

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais
```

## 🔧 Configuração

### Variáveis de Ambiente Obrigatórias

```env
DATABASE_URL=postgresql://user:password@host:5432/database
PORT=5000
NODE_ENV=production
SESSION_SECRET=your_secret_here
```

### Obter DATABASE_URL do Supabase

1. Acesse [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá em **Settings** > **Database**
4. Copie a **Connection String** (modo Pooler)
5. Cole no `.env` como `DATABASE_URL`

## 🏃 Executar

### Desenvolvimento

```bash
npm run dev
```

### Produção

```bash
npm run build
npm start
```

## 🌐 Deploy no Render

### Passo 1: Criar Conta

1. Acesse [Render.com](https://render.com)
2. Faça login com GitHub

### Passo 2: Criar Web Service

1. Clique em **New +** > **Web Service**
2. Conecte seu repositório do GitHub
3. Configure:
   - **Name**: `dentcarepro-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: `Free`

### Passo 3: Adicionar Variáveis de Ambiente

No painel do Render, vá em **Environment** e adicione:

```
DATABASE_URL=sua_url_do_supabase
PORT=5000
NODE_ENV=production
SESSION_SECRET=seu_secret_aqui
```

### Passo 4: Deploy

1. Clique em **Create Web Service**
2. Aguarde o deploy (5-10 minutos)
3. Copie a URL gerada (ex: `https://dentcarepro-backend.onrender.com`)

## 📡 Endpoints

Após o deploy, a API estará disponível em:

```
https://seu-backend.onrender.com/trpc
```

## 🔒 Segurança

- ✅ Variáveis de ambiente protegidas
- ✅ Senhas hasheadas com bcrypt
- ✅ Sessões com JWT
- ✅ CORS configurado

## 📝 Estrutura

```
backend/
├── server/
│   ├── _core/          # Configuração do servidor
│   ├── routers/        # Rotas tRPC
│   └── integrations/   # Integrações externas
├── shared/             # Tipos compartilhados
├── drizzle/            # Migrações do banco
└── package.json
```

## 🐛 Troubleshooting

### Erro de Conexão com Database

- Verifique se o `DATABASE_URL` está correto
- Certifique-se que o Supabase está ativo
- Teste a conexão com `psql`

### Erro no Deploy do Render

- Verifique os logs no painel do Render
- Confirme que todas as variáveis de ambiente estão configuradas
- Teste localmente com `npm run build && npm start`

## 📞 Suporte

Para problemas ou dúvidas, abra uma issue no repositório.
