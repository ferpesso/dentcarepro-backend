# Dockerfile para DentCarePro Backend
# Node.js 22 Alpine (leve e rápido)
FROM node:22-alpine AS base

# Instalar dependências do sistema
RUN apk add --no-cache libc6-compat

# Definir diretório de trabalho
WORKDIR /app

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar o código fonte
COPY . .

# Expor a porta 8080
EXPOSE 8080

# Variável de ambiente para porta
ENV PORT=8080
ENV NODE_ENV=production

# Comando para iniciar o servidor
CMD ["npm", "start"]
