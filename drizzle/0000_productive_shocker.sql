CREATE TYPE "public"."assinatura_estado" AS ENUM('trial', 'ativo', 'em_atraso', 'cancelado', 'expirado');--> statement-breakpoint
CREATE TYPE "public"."categoria" AS ENUM('lembrete_consulta', 'confirmacao_consulta', 'seguimento', 'pos_tratamento', 'marketing', 'outro');--> statement-breakpoint
CREATE TYPE "public"."cicloFaturacao" AS ENUM('mensal', 'anual');--> statement-breakpoint
CREATE TYPE "public"."consulta_estado" AS ENUM('agendada', 'confirmada', 'em_curso', 'concluida', 'cancelada', 'faltou');--> statement-breakpoint
CREATE TYPE "public"."consumoAlcool" AS ENUM('nunca', 'ocasional', 'regular');--> statement-breakpoint
CREATE TYPE "public"."estadoTabagismo" AS ENUM('nunca', 'ex_fumador', 'fumador');--> statement-breakpoint
CREATE TYPE "public"."fatura_estado" AS ENUM('rascunho', 'enviada', 'paga', 'parcialmente_paga', 'vencida', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."genero" AS ENUM('masculino', 'feminino', 'outro');--> statement-breakpoint
CREATE TYPE "public"."mensagem_estado" AS ENUM('pendente', 'enviada', 'entregue', 'lida', 'falhada');--> statement-breakpoint
CREATE TYPE "public"."metodoPagamento" AS ENUM('dinheiro', 'cartao', 'transferencia', 'mbway', 'multibanco', 'outro');--> statement-breakpoint
CREATE TYPE "public"."notificacao_canal" AS ENUM('email', 'sms', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."pagamento_estado" AS ENUM('pendente', 'sucesso', 'falhado', 'reembolsado');--> statement-breakpoint
CREATE TYPE "public"."registo_estado" AS ENUM('pendente', 'completo', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."tipoDistribuicao" AS ENUM('percentagem', 'fixo', 'hibrido');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin', 'dentista', 'rececionista');--> statement-breakpoint
CREATE TYPE "public"."utilizador_role" AS ENUM('proprietario', 'admin', 'dentista', 'rececionista');--> statement-breakpoint
CREATE TABLE "assinaturas_clinica" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinicaId" integer NOT NULL,
	"planoId" integer NOT NULL,
	"assinatura_estado" "assinatura_estado" DEFAULT 'trial' NOT NULL,
	"cicloFaturacao" "cicloFaturacao" DEFAULT 'mensal' NOT NULL,
	"inicioPeriodoAtual" timestamp NOT NULL,
	"fimPeriodoAtual" timestamp NOT NULL,
	"inicioTrial" timestamp,
	"fimTrial" timestamp,
	"cancelarNoFimPeriodo" boolean DEFAULT false NOT NULL,
	"canceladoEm" timestamp,
	"motivoCancelamento" text,
	"stripeCustomerId" varchar(255),
	"stripeSubscriptionId" varchar(255),
	"stripePaymentMethodId" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categorias_procedimento" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinicaId" integer NOT NULL,
	"nome" varchar(255) NOT NULL,
	"descricao" text,
	"cor" varchar(7),
	"ativo" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinicas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(255) NOT NULL,
	"email" varchar(320),
	"telemovel" varchar(50),
	"morada" text,
	"cidade" varchar(100),
	"codigoPostal" varchar(20),
	"pais" varchar(2) DEFAULT 'PT' NOT NULL,
	"nif" varchar(50),
	"logoUrl" varchar(500),
	"ativo" boolean DEFAULT true NOT NULL,
	"proprietarioId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "configuracoes_financeiras" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinicaId" integer NOT NULL,
	"procedimentoId" integer,
	"dentistaId" integer,
	"tipoDistribuicao" "tipoDistribuicao" DEFAULT 'percentagem' NOT NULL,
	"percentagemDentista" numeric(5, 2),
	"valorFixoDentista" numeric(10, 2),
	"percentagemClinica" numeric(5, 2),
	"valorFixoClinica" numeric(10, 2),
	"custoLaboratorio" numeric(10, 2) DEFAULT '0',
	"custoMateriais" numeric(10, 2) DEFAULT '0',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultas" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinicaId" integer NOT NULL,
	"utenteId" integer NOT NULL,
	"dentistaId" integer NOT NULL,
	"procedimentoId" integer,
	"horaInicio" timestamp NOT NULL,
	"horaFim" timestamp NOT NULL,
	"estado" "consulta_estado" DEFAULT 'agendada' NOT NULL,
	"titulo" varchar(255),
	"observacoes" text,
	"motivoCancelamento" text,
	"confirmadaEm" timestamp,
	"concluidaEm" timestamp,
	"canceladaEm" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dentistas" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinicaId" integer NOT NULL,
	"nome" varchar(255) NOT NULL,
	"email" varchar(320),
	"telemovel" varchar(50),
	"especializacao" varchar(255),
	"numeroCedula" varchar(100),
	"percentagemComissao" numeric(5, 2) DEFAULT '0',
	"ativo" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faturas" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinicaId" integer NOT NULL,
	"utenteId" integer NOT NULL,
	"consultaId" integer,
	"numeroFatura" varchar(50) NOT NULL,
	"dataFatura" timestamp NOT NULL,
	"dataVencimento" timestamp,
	"subtotal" numeric(10, 2) DEFAULT '0' NOT NULL,
	"valorIVA" numeric(10, 2) DEFAULT '0' NOT NULL,
	"percentagemIVA" numeric(5, 2) DEFAULT '0' NOT NULL,
	"valorDesconto" numeric(10, 2) DEFAULT '0' NOT NULL,
	"valorTotal" numeric(10, 2) DEFAULT '0' NOT NULL,
	"valorPago" numeric(10, 2) DEFAULT '0' NOT NULL,
	"estado" "fatura_estado" DEFAULT 'rascunho' NOT NULL,
	"observacoes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historico_medico" (
	"id" serial PRIMARY KEY NOT NULL,
	"utenteId" integer NOT NULL,
	"alergias" text,
	"medicamentos" text,
	"condicoesMedicas" text,
	"cirurgiasPrevias" text,
	"historicoFamiliar" text,
	"estadoTabagismo" "estadoTabagismo",
	"consumoAlcool" "consumoAlcool",
	"tipoSanguineo" varchar(10),
	"contatoEmergenciaNome" varchar(255),
	"contatoEmergenciaTelemovel" varchar(50),
	"observacoes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itens_fatura" (
	"id" serial PRIMARY KEY NOT NULL,
	"faturaId" integer NOT NULL,
	"procedimentoId" integer,
	"descricao" varchar(500) NOT NULL,
	"quantidade" integer DEFAULT 1 NOT NULL,
	"precoUnitario" numeric(10, 2) NOT NULL,
	"precoTotal" numeric(10, 2) NOT NULL,
	"comissaoDentista" numeric(10, 2) DEFAULT '0',
	"valorClinica" numeric(10, 2) DEFAULT '0',
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mensagens_utente" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinicaId" integer NOT NULL,
	"utenteId" integer NOT NULL,
	"templateId" integer,
	"notificacao_canal" "notificacao_canal" NOT NULL,
	"assunto" varchar(500),
	"corpo" text NOT NULL,
	"mensagem_estado" "mensagem_estado" DEFAULT 'pendente' NOT NULL,
	"enviadaEm" timestamp,
	"entregueEm" timestamp,
	"lidaEm" timestamp,
	"mensagemErro" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metricas_uso" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinicaId" integer NOT NULL,
	"inicioPeriodo" timestamp NOT NULL,
	"fimPeriodo" timestamp NOT NULL,
	"totalUtentes" integer DEFAULT 0 NOT NULL,
	"totalConsultas" integer DEFAULT 0 NOT NULL,
	"totalFaturas" integer DEFAULT 0 NOT NULL,
	"receitaTotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"dentistasAtivos" integer DEFAULT 0 NOT NULL,
	"clinicasAtivas" integer DEFAULT 0 NOT NULL,
	"armazenamentoUsadoMB" integer DEFAULT 0 NOT NULL,
	"chamadasAPI" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pagamentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinicaId" integer NOT NULL,
	"assinaturaId" integer,
	"valor" numeric(10, 2) NOT NULL,
	"moeda" varchar(3) DEFAULT 'EUR' NOT NULL,
	"pagamento_estado" "pagamento_estado" NOT NULL,
	"descricao" text,
	"stripePaymentIntentId" varchar(255),
	"stripeInvoiceId" varchar(255),
	"metadata" jsonb,
	"pagoEm" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pagamentos_fatura" (
	"id" serial PRIMARY KEY NOT NULL,
	"faturaId" integer NOT NULL,
	"valor" numeric(10, 2) NOT NULL,
	"metodoPagamento" "metodoPagamento" NOT NULL,
	"dataPagamento" timestamp NOT NULL,
	"referencia" varchar(255),
	"observacoes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planos_assinatura" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(100) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"descricao" text,
	"precoMensal" numeric(10, 2) NOT NULL,
	"precoAnual" numeric(10, 2),
	"maxDentistas" integer DEFAULT 1 NOT NULL,
	"maxUtentes" integer DEFAULT 100 NOT NULL,
	"maxClinicas" integer DEFAULT 1 NOT NULL,
	"maxArmazenamentoGB" integer DEFAULT 1 NOT NULL,
	"funcionalidades" jsonb,
	"ativo" boolean DEFAULT true NOT NULL,
	"popular" boolean DEFAULT false NOT NULL,
	"stripePriceIdMensal" varchar(255),
	"stripePriceIdAnual" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "planos_assinatura_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "procedimentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinicaId" integer NOT NULL,
	"categoriaId" integer,
	"codigo" varchar(50),
	"nome" varchar(255) NOT NULL,
	"descricao" text,
	"precoBase" numeric(10, 2) DEFAULT '0' NOT NULL,
	"duracaoMinutos" integer DEFAULT 30,
	"cor" varchar(7),
	"ativo" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registos_clinica" (
	"id" serial PRIMARY KEY NOT NULL,
	"nomeClinica" varchar(255) NOT NULL,
	"nomeProprietario" varchar(255) NOT NULL,
	"emailProprietario" varchar(320) NOT NULL,
	"telemovel" varchar(50),
	"morada" text,
	"cidade" varchar(100),
	"codigoPostal" varchar(20),
	"pais" varchar(2) DEFAULT 'PT' NOT NULL,
	"planoSelecionadoId" integer,
	"registo_estado" "registo_estado" DEFAULT 'pendente' NOT NULL,
	"tokenVerificacao" varchar(255),
	"verificadoEm" timestamp,
	"clinicaId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"completadoEm" timestamp,
	CONSTRAINT "registos_clinica_emailProprietario_unique" UNIQUE("emailProprietario")
);
--> statement-breakpoint
CREATE TABLE "templates_mensagem" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinicaId" integer NOT NULL,
	"nome" varchar(255) NOT NULL,
	"categoria" "categoria" NOT NULL,
	"assunto" varchar(500),
	"corpo" text NOT NULL,
	"notificacao_canal" "notificacao_canal" DEFAULT 'email' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"nome" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"user_role" "user_role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "utentes" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinicaId" integer NOT NULL,
	"numeroUtente" varchar(50) NOT NULL,
	"nome" varchar(255) NOT NULL,
	"email" varchar(320),
	"telemovel" varchar(50) NOT NULL,
	"dataNascimento" date,
	"genero" "genero",
	"morada" text,
	"cidade" varchar(100),
	"codigoPostal" varchar(20),
	"pais" varchar(2) DEFAULT 'PT',
	"nif" varchar(50),
	"observacoes" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "utilizadores_clinica" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinicaId" integer NOT NULL,
	"userId" integer NOT NULL,
	"role" "utilizador_role" NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"convidadoPor" integer,
	"convidadoEm" timestamp DEFAULT now() NOT NULL,
	"aceiteEm" timestamp
);
--> statement-breakpoint
CREATE TABLE "notificacoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"clinica_id" integer NOT NULL,
	"tipo" text NOT NULL,
	"titulo" text NOT NULL,
	"mensagem" text NOT NULL,
	"link" text,
	"icone" text,
	"cor" text,
	"lida" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"lida_em" timestamp
);
--> statement-breakpoint
CREATE TABLE "preferencias_notificacoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"avaliacoes_negativas" boolean DEFAULT true NOT NULL,
	"custos_altos" boolean DEFAULT true NOT NULL,
	"pagamentos_pendentes" boolean DEFAULT true NOT NULL,
	"novas_avaliacoes" boolean DEFAULT true NOT NULL,
	"limite_avaliacao_negativa" integer DEFAULT 3 NOT NULL,
	"limite_custo_alto" integer DEFAULT 5000 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "preferencias_notificacoes_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "consentimentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"utente_id" integer NOT NULL,
	"clinica_id" integer NOT NULL,
	"tipo" varchar(100) NOT NULL,
	"finalidade" text NOT NULL,
	"consentido" boolean NOT NULL,
	"data_consentimento" timestamp NOT NULL,
	"revogado" boolean DEFAULT false,
	"data_revogacao" timestamp,
	"forma_consentimento" varchar(50),
	"evidencia" jsonb,
	"data_expiracao" timestamp,
	"versao_termos" varchar(20),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "consultas_ortodontia" (
	"id" serial PRIMARY KEY NOT NULL,
	"ortodontiaId" integer NOT NULL,
	"dataConsulta" date NOT NULL,
	"arcoSuperior" varchar(100),
	"arcoInferior" varchar(100),
	"trocaBrackets" jsonb,
	"elasticos" varchar(255),
	"medicoes" jsonb,
	"observacoes" text,
	"proximaConsulta" date,
	"registadoPor" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "endodontia" (
	"id" serial PRIMARY KEY NOT NULL,
	"utenteId" integer NOT NULL,
	"clinicaId" integer NOT NULL,
	"numeroDente" integer NOT NULL,
	"diagnostico" varchar(50) NOT NULL,
	"numeroCanais" integer NOT NULL,
	"canais" jsonb,
	"numeroSessoes" integer DEFAULT 1,
	"dataInicio" date NOT NULL,
	"dataConclusao" date,
	"estado" varchar(50) DEFAULT 'em_andamento' NOT NULL,
	"materiaisUtilizados" text,
	"tecnicaObturacao" varchar(100),
	"observacoes" text,
	"complicacoes" text,
	"registadoPor" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historico_odontograma" (
	"id" serial PRIMARY KEY NOT NULL,
	"odontogramaId" integer NOT NULL,
	"estadoAnterior" varchar(50),
	"estadoNovo" varchar(50) NOT NULL,
	"procedimentoRealizado" text,
	"observacoes" text,
	"registadoPor" integer,
	"dataAlteracao" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ia_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"utenteId" integer NOT NULL,
	"clinicaId" integer NOT NULL,
	"tipo" varchar(50) NOT NULL,
	"titulo" varchar(255) NOT NULL,
	"descricao" text NOT NULL,
	"confianca" numeric(5, 2),
	"prioridade" varchar(50),
	"dados" jsonb,
	"recomendacoes" jsonb,
	"baseadoEm" jsonb,
	"visualizado" boolean DEFAULT false,
	"dataVisualizacao" timestamp,
	"acao_tomada" text,
	"geradoEm" timestamp DEFAULT now() NOT NULL,
	"expiradoEm" timestamp
);
--> statement-breakpoint
CREATE TABLE "imagens_utente" (
	"id" serial PRIMARY KEY NOT NULL,
	"utenteId" integer NOT NULL,
	"clinicaId" integer NOT NULL,
	"tipo" varchar(50) NOT NULL,
	"titulo" varchar(255),
	"descricao" text,
	"urlImagem" varchar(500) NOT NULL,
	"urlThumbnail" varchar(500),
	"tamanhoBytes" integer,
	"formato" varchar(20),
	"largura" integer,
	"altura" integer,
	"denteRelacionado" integer,
	"consultaRelacionada" integer,
	"tratamentoRelacionado" varchar(100),
	"analisadoPorIA" boolean DEFAULT false,
	"resultadoIA" jsonb,
	"tags" jsonb,
	"uploadPor" integer,
	"dataUpload" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "implantes" (
	"id" serial PRIMARY KEY NOT NULL,
	"utenteId" integer NOT NULL,
	"clinicaId" integer NOT NULL,
	"posicao" integer NOT NULL,
	"fabricante" varchar(100),
	"modelo" varchar(100),
	"lote" varchar(100),
	"diametro" numeric(4, 2),
	"comprimento" numeric(4, 2),
	"dataColocacao" date NOT NULL,
	"tipoCirurgia" varchar(50),
	"enxertoOsseo" boolean DEFAULT false,
	"tipoEnxerto" varchar(100),
	"dataPilar" date,
	"dataProtese" date,
	"tipoProtese" varchar(100),
	"estado" varchar(50) DEFAULT 'planejado' NOT NULL,
	"torqueInsercao" integer,
	"estabilidadePrimaria" varchar(50),
	"observacoes" text,
	"complicacoes" text,
	"registadoPor" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notas_utente" (
	"id" serial PRIMARY KEY NOT NULL,
	"utenteId" integer NOT NULL,
	"clinicaId" integer NOT NULL,
	"tipo" varchar(50) NOT NULL,
	"titulo" varchar(255),
	"conteudo" text NOT NULL,
	"importante" boolean DEFAULT false,
	"privada" boolean DEFAULT false,
	"tags" jsonb,
	"criadoPor" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "odontograma" (
	"id" serial PRIMARY KEY NOT NULL,
	"utenteId" integer NOT NULL,
	"clinicaId" integer NOT NULL,
	"numeroDente" integer NOT NULL,
	"estado" varchar(50) DEFAULT 'sadio' NOT NULL,
	"faces" jsonb,
	"observacoes" text,
	"cor" varchar(7),
	"registadoPor" integer,
	"dataRegisto" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ortodontia" (
	"id" serial PRIMARY KEY NOT NULL,
	"utenteId" integer NOT NULL,
	"clinicaId" integer NOT NULL,
	"classificacaoAngle" varchar(50),
	"tipoMordida" jsonb,
	"apinhamento" varchar(50),
	"diastemas" boolean DEFAULT false,
	"tipoAparelho" varchar(50) NOT NULL,
	"dataInicio" date NOT NULL,
	"dataPrevisaoConclusao" date,
	"dataConclusao" date,
	"extracoesNecessarias" jsonb,
	"usoBandas" boolean DEFAULT false,
	"usoElasticos" boolean DEFAULT false,
	"usoMiniImplantes" boolean DEFAULT false,
	"estado" varchar(50) DEFAULT 'planejamento' NOT NULL,
	"duracaoEstimadaMeses" integer,
	"observacoes" text,
	"planoTratamento" text,
	"registadoPor" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "periodontograma" (
	"id" serial PRIMARY KEY NOT NULL,
	"utenteId" integer NOT NULL,
	"clinicaId" integer NOT NULL,
	"dataAvaliacao" date NOT NULL,
	"medicoes" jsonb,
	"indicePlaca" numeric(5, 2),
	"indiceSangramento" numeric(5, 2),
	"indiceProfundidade" numeric(5, 2),
	"diagnostico" text,
	"planoTratamento" text,
	"observacoes" text,
	"registadoPor" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prescricoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"utenteId" integer NOT NULL,
	"clinicaId" integer NOT NULL,
	"consultaId" integer,
	"dataPrescricao" date NOT NULL,
	"medicamentos" jsonb NOT NULL,
	"diagnostico" text,
	"indicacao" text,
	"observacoes" text,
	"contraindicacoes" text,
	"validadeDias" integer DEFAULT 30,
	"dataValidade" date,
	"dispensada" boolean DEFAULT false,
	"dataDispensacao" date,
	"prescritoPor" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trabalhos_laboratorio" (
	"id" serial PRIMARY KEY NOT NULL,
	"utenteId" integer NOT NULL,
	"clinicaId" integer NOT NULL,
	"tipo" varchar(50) NOT NULL,
	"descricao" text NOT NULL,
	"dentes" jsonb,
	"laboratorio" varchar(255),
	"protesicoResponsavel" varchar(255),
	"material" varchar(100),
	"cor" varchar(50),
	"dataEnvio" date NOT NULL,
	"dataPrevisaoEntrega" date,
	"dataEntrega" date,
	"dataInstalacao" date,
	"estado" varchar(50) DEFAULT 'planejado' NOT NULL,
	"custoLaboratorio" numeric(10, 2),
	"valorCobrado" numeric(10, 2),
	"garantiaMeses" integer,
	"dataGarantiaFim" date,
	"observacoes" text,
	"ajustesNecessarios" text,
	"solicitadoPor" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"user_name" varchar(255),
	"user_role" varchar(50),
	"clinica_id" integer,
	"action" varchar(50) NOT NULL,
	"entity" varchar(50) NOT NULL,
	"entity_id" integer,
	"description" text,
	"changes" jsonb,
	"metadata" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"data_category" varchar(50),
	"legal_basis" varchar(100),
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_access_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"user_name" varchar(255),
	"user_role" varchar(50),
	"data_type" varchar(50) NOT NULL,
	"data_owner_id" integer NOT NULL,
	"data_owner_name" varchar(255),
	"access_reason" text,
	"access_type" varchar(20) NOT NULL,
	"ip_address" varchar(45),
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exportacoes_dados" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"user_name" varchar(255),
	"tipo_exportacao" varchar(50) NOT NULL,
	"utente_id" integer,
	"clinica_id" integer,
	"formato" varchar(20),
	"filtros" jsonb,
	"numero_registos" integer,
	"tamanho_arquivo" integer,
	"finalidade" varchar(100),
	"ip_address" varchar(45),
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedidos_direitos_rgpd" (
	"id" serial PRIMARY KEY NOT NULL,
	"utente_id" integer NOT NULL,
	"utente_nome" varchar(255),
	"utente_email" varchar(255),
	"clinica_id" integer NOT NULL,
	"tipo_direito" varchar(50) NOT NULL,
	"descricao" text,
	"dados_especificos" jsonb,
	"status" varchar(30) DEFAULT 'pendente' NOT NULL,
	"data_processamento" timestamp,
	"processado_por" integer,
	"processado_por_nome" varchar(255),
	"resposta" text,
	"acao_tomada" text,
	"data_pedido" timestamp DEFAULT now() NOT NULL,
	"data_prazo" timestamp NOT NULL,
	"data_conclusao" timestamp,
	"documentos" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "politicas_retencao" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo_entidade" varchar(50) NOT NULL,
	"categoria" varchar(50),
	"periodo_retencao" integer NOT NULL,
	"motivo_retencao" text,
	"acao_apos_expiracao" varchar(30) NOT NULL,
	"ativo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "violacoes_dados" (
	"id" serial PRIMARY KEY NOT NULL,
	"referencia" varchar(50) NOT NULL,
	"clinica_id" integer NOT NULL,
	"tipo" varchar(50) NOT NULL,
	"descricao" text NOT NULL,
	"data_ocorrencia" timestamp NOT NULL,
	"data_detecao" timestamp NOT NULL,
	"dados_afetados" jsonb,
	"numero_utentes_afetados" integer,
	"utente_ids" jsonb,
	"gravidade" varchar(20) NOT NULL,
	"risco_titulares" text,
	"medidas_imediatas" text,
	"medidas_preventivas" text,
	"notificado_autoridade" boolean DEFAULT false,
	"data_notificacao_autoridade" timestamp,
	"notificados_titulares" boolean DEFAULT false,
	"data_notificacao_titulares" timestamp,
	"reportado_por" integer,
	"reportado_por_nome" varchar(255),
	"status" varchar(30) DEFAULT 'aberto' NOT NULL,
	"data_resolucao" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "violacoes_dados_referencia_unique" UNIQUE("referencia")
);
--> statement-breakpoint
CREATE TABLE "analises_ia" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinicaId" integer NOT NULL,
	"utenteId" integer,
	"tipo" varchar(50) NOT NULL,
	"prompt" text NOT NULL,
	"imagemUrl" varchar(500),
	"contexto" jsonb,
	"resposta" text NOT NULL,
	"confianca" integer,
	"dadosEstruturados" jsonb,
	"modelo" varchar(100),
	"tokens" integer,
	"custoEstimado" integer,
	"tempoProcessamento" integer,
	"aprovado" boolean DEFAULT false,
	"revisadoPor" integer,
	"dataRevisao" timestamp,
	"observacoesRevisao" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "configuracoes_ia" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinicaId" integer NOT NULL,
	"provedor" varchar(50) DEFAULT 'openai' NOT NULL,
	"apiKey" text NOT NULL,
	"apiKeySecundaria" text,
	"modeloTexto" varchar(100) DEFAULT 'gpt-4',
	"modeloVisao" varchar(100) DEFAULT 'gpt-4-vision-preview',
	"modeloChat" varchar(100) DEFAULT 'gpt-4',
	"temperaturaTexto" integer DEFAULT 70,
	"temperaturaAnalise" integer DEFAULT 30,
	"maxTokens" integer DEFAULT 2000,
	"analiseImagens" boolean DEFAULT true,
	"chatAssistente" boolean DEFAULT true,
	"insightsAutomaticos" boolean DEFAULT true,
	"analisePreditiva" boolean DEFAULT true,
	"autoPreenchimento" boolean DEFAULT false,
	"limiteDiario" integer DEFAULT 100,
	"usoDiario" integer DEFAULT 0,
	"dataResetUso" timestamp DEFAULT now(),
	"idiomaIA" varchar(10) DEFAULT 'pt',
	"promptsPersonalizados" jsonb,
	"ativo" boolean DEFAULT true,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversas_ia" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinicaId" integer NOT NULL,
	"usuarioId" integer NOT NULL,
	"titulo" varchar(255),
	"contexto" varchar(50) DEFAULT 'geral',
	"utenteRelacionado" integer,
	"dadosContexto" jsonb,
	"ativa" boolean DEFAULT true,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logs_uso_ia" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinicaId" integer NOT NULL,
	"funcionalidade" varchar(100) NOT NULL,
	"modelo" varchar(100),
	"tokens" integer,
	"custoEstimado" integer,
	"tempoProcessamento" integer,
	"sucesso" boolean DEFAULT true,
	"erro" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mensagens_ia" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversaId" integer NOT NULL,
	"papel" varchar(50) NOT NULL,
	"conteudo" text NOT NULL,
	"anexos" jsonb,
	"tokens" integer,
	"modelo" varchar(100),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sugestoes_ia" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinicaId" integer NOT NULL,
	"utenteId" integer,
	"tipo" varchar(50) NOT NULL,
	"titulo" varchar(255) NOT NULL,
	"descricao" text NOT NULL,
	"prioridade" varchar(50) DEFAULT 'media',
	"confianca" integer,
	"acaoSugerida" jsonb,
	"impactoEstimado" jsonb,
	"visualizada" boolean DEFAULT false,
	"dataVisualizacao" timestamp,
	"aceita" boolean,
	"dataAcao" timestamp,
	"feedback" text,
	"expiradaEm" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assinaturas_clinica" ADD CONSTRAINT "assinaturas_clinica_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assinaturas_clinica" ADD CONSTRAINT "assinaturas_clinica_planoId_planos_assinatura_id_fk" FOREIGN KEY ("planoId") REFERENCES "public"."planos_assinatura"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorias_procedimento" ADD CONSTRAINT "categorias_procedimento_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinicas" ADD CONSTRAINT "clinicas_proprietarioId_users_id_fk" FOREIGN KEY ("proprietarioId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configuracoes_financeiras" ADD CONSTRAINT "configuracoes_financeiras_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configuracoes_financeiras" ADD CONSTRAINT "configuracoes_financeiras_procedimentoId_procedimentos_id_fk" FOREIGN KEY ("procedimentoId") REFERENCES "public"."procedimentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configuracoes_financeiras" ADD CONSTRAINT "configuracoes_financeiras_dentistaId_dentistas_id_fk" FOREIGN KEY ("dentistaId") REFERENCES "public"."dentistas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_utenteId_utentes_id_fk" FOREIGN KEY ("utenteId") REFERENCES "public"."utentes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_dentistaId_dentistas_id_fk" FOREIGN KEY ("dentistaId") REFERENCES "public"."dentistas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultas" ADD CONSTRAINT "consultas_procedimentoId_procedimentos_id_fk" FOREIGN KEY ("procedimentoId") REFERENCES "public"."procedimentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dentistas" ADD CONSTRAINT "dentistas_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_utenteId_utentes_id_fk" FOREIGN KEY ("utenteId") REFERENCES "public"."utentes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_consultaId_consultas_id_fk" FOREIGN KEY ("consultaId") REFERENCES "public"."consultas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historico_medico" ADD CONSTRAINT "historico_medico_utenteId_utentes_id_fk" FOREIGN KEY ("utenteId") REFERENCES "public"."utentes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_fatura" ADD CONSTRAINT "itens_fatura_faturaId_faturas_id_fk" FOREIGN KEY ("faturaId") REFERENCES "public"."faturas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itens_fatura" ADD CONSTRAINT "itens_fatura_procedimentoId_procedimentos_id_fk" FOREIGN KEY ("procedimentoId") REFERENCES "public"."procedimentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagens_utente" ADD CONSTRAINT "mensagens_utente_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagens_utente" ADD CONSTRAINT "mensagens_utente_utenteId_utentes_id_fk" FOREIGN KEY ("utenteId") REFERENCES "public"."utentes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagens_utente" ADD CONSTRAINT "mensagens_utente_templateId_templates_mensagem_id_fk" FOREIGN KEY ("templateId") REFERENCES "public"."templates_mensagem"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metricas_uso" ADD CONSTRAINT "metricas_uso_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_assinaturaId_assinaturas_clinica_id_fk" FOREIGN KEY ("assinaturaId") REFERENCES "public"."assinaturas_clinica"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagamentos_fatura" ADD CONSTRAINT "pagamentos_fatura_faturaId_faturas_id_fk" FOREIGN KEY ("faturaId") REFERENCES "public"."faturas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedimentos" ADD CONSTRAINT "procedimentos_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedimentos" ADD CONSTRAINT "procedimentos_categoriaId_categorias_procedimento_id_fk" FOREIGN KEY ("categoriaId") REFERENCES "public"."categorias_procedimento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registos_clinica" ADD CONSTRAINT "registos_clinica_planoSelecionadoId_planos_assinatura_id_fk" FOREIGN KEY ("planoSelecionadoId") REFERENCES "public"."planos_assinatura"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates_mensagem" ADD CONSTRAINT "templates_mensagem_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utentes" ADD CONSTRAINT "utentes_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utilizadores_clinica" ADD CONSTRAINT "utilizadores_clinica_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utilizadores_clinica" ADD CONSTRAINT "utilizadores_clinica_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utilizadores_clinica" ADD CONSTRAINT "utilizadores_clinica_convidadoPor_users_id_fk" FOREIGN KEY ("convidadoPor") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferencias_notificacoes" ADD CONSTRAINT "preferencias_notificacoes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultas_ortodontia" ADD CONSTRAINT "consultas_ortodontia_ortodontiaId_ortodontia_id_fk" FOREIGN KEY ("ortodontiaId") REFERENCES "public"."ortodontia"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultas_ortodontia" ADD CONSTRAINT "consultas_ortodontia_registadoPor_dentistas_id_fk" FOREIGN KEY ("registadoPor") REFERENCES "public"."dentistas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endodontia" ADD CONSTRAINT "endodontia_utenteId_utentes_id_fk" FOREIGN KEY ("utenteId") REFERENCES "public"."utentes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endodontia" ADD CONSTRAINT "endodontia_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endodontia" ADD CONSTRAINT "endodontia_registadoPor_dentistas_id_fk" FOREIGN KEY ("registadoPor") REFERENCES "public"."dentistas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historico_odontograma" ADD CONSTRAINT "historico_odontograma_odontogramaId_odontograma_id_fk" FOREIGN KEY ("odontogramaId") REFERENCES "public"."odontograma"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historico_odontograma" ADD CONSTRAINT "historico_odontograma_registadoPor_dentistas_id_fk" FOREIGN KEY ("registadoPor") REFERENCES "public"."dentistas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ia_insights" ADD CONSTRAINT "ia_insights_utenteId_utentes_id_fk" FOREIGN KEY ("utenteId") REFERENCES "public"."utentes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ia_insights" ADD CONSTRAINT "ia_insights_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imagens_utente" ADD CONSTRAINT "imagens_utente_utenteId_utentes_id_fk" FOREIGN KEY ("utenteId") REFERENCES "public"."utentes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imagens_utente" ADD CONSTRAINT "imagens_utente_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imagens_utente" ADD CONSTRAINT "imagens_utente_uploadPor_dentistas_id_fk" FOREIGN KEY ("uploadPor") REFERENCES "public"."dentistas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "implantes" ADD CONSTRAINT "implantes_utenteId_utentes_id_fk" FOREIGN KEY ("utenteId") REFERENCES "public"."utentes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "implantes" ADD CONSTRAINT "implantes_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "implantes" ADD CONSTRAINT "implantes_registadoPor_dentistas_id_fk" FOREIGN KEY ("registadoPor") REFERENCES "public"."dentistas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_utente" ADD CONSTRAINT "notas_utente_utenteId_utentes_id_fk" FOREIGN KEY ("utenteId") REFERENCES "public"."utentes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_utente" ADD CONSTRAINT "notas_utente_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notas_utente" ADD CONSTRAINT "notas_utente_criadoPor_dentistas_id_fk" FOREIGN KEY ("criadoPor") REFERENCES "public"."dentistas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontograma" ADD CONSTRAINT "odontograma_utenteId_utentes_id_fk" FOREIGN KEY ("utenteId") REFERENCES "public"."utentes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontograma" ADD CONSTRAINT "odontograma_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontograma" ADD CONSTRAINT "odontograma_registadoPor_dentistas_id_fk" FOREIGN KEY ("registadoPor") REFERENCES "public"."dentistas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ortodontia" ADD CONSTRAINT "ortodontia_utenteId_utentes_id_fk" FOREIGN KEY ("utenteId") REFERENCES "public"."utentes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ortodontia" ADD CONSTRAINT "ortodontia_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ortodontia" ADD CONSTRAINT "ortodontia_registadoPor_dentistas_id_fk" FOREIGN KEY ("registadoPor") REFERENCES "public"."dentistas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "periodontograma" ADD CONSTRAINT "periodontograma_utenteId_utentes_id_fk" FOREIGN KEY ("utenteId") REFERENCES "public"."utentes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "periodontograma" ADD CONSTRAINT "periodontograma_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "periodontograma" ADD CONSTRAINT "periodontograma_registadoPor_dentistas_id_fk" FOREIGN KEY ("registadoPor") REFERENCES "public"."dentistas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescricoes" ADD CONSTRAINT "prescricoes_utenteId_utentes_id_fk" FOREIGN KEY ("utenteId") REFERENCES "public"."utentes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescricoes" ADD CONSTRAINT "prescricoes_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescricoes" ADD CONSTRAINT "prescricoes_prescritoPor_dentistas_id_fk" FOREIGN KEY ("prescritoPor") REFERENCES "public"."dentistas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trabalhos_laboratorio" ADD CONSTRAINT "trabalhos_laboratorio_utenteId_utentes_id_fk" FOREIGN KEY ("utenteId") REFERENCES "public"."utentes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trabalhos_laboratorio" ADD CONSTRAINT "trabalhos_laboratorio_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trabalhos_laboratorio" ADD CONSTRAINT "trabalhos_laboratorio_solicitadoPor_dentistas_id_fk" FOREIGN KEY ("solicitadoPor") REFERENCES "public"."dentistas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analises_ia" ADD CONSTRAINT "analises_ia_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analises_ia" ADD CONSTRAINT "analises_ia_utenteId_utentes_id_fk" FOREIGN KEY ("utenteId") REFERENCES "public"."utentes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configuracoes_ia" ADD CONSTRAINT "configuracoes_ia_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversas_ia" ADD CONSTRAINT "conversas_ia_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversas_ia" ADD CONSTRAINT "conversas_ia_utenteRelacionado_utentes_id_fk" FOREIGN KEY ("utenteRelacionado") REFERENCES "public"."utentes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs_uso_ia" ADD CONSTRAINT "logs_uso_ia_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagens_ia" ADD CONSTRAINT "mensagens_ia_conversaId_conversas_ia_id_fk" FOREIGN KEY ("conversaId") REFERENCES "public"."conversas_ia"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sugestoes_ia" ADD CONSTRAINT "sugestoes_ia_clinicaId_clinicas_id_fk" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sugestoes_ia" ADD CONSTRAINT "sugestoes_ia_utenteId_utentes_id_fk" FOREIGN KEY ("utenteId") REFERENCES "public"."utentes"("id") ON DELETE no action ON UPDATE no action;