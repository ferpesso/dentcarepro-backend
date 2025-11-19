CREATE TABLE `assinaturas_clinica` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinicaId` int NOT NULL,
	`planoId` int NOT NULL,
	`estado` enum('trial','ativo','em_atraso','cancelado','expirado') NOT NULL DEFAULT 'trial',
	`cicloFaturacao` enum('mensal','anual') NOT NULL DEFAULT 'mensal',
	`inicioPeriodoAtual` timestamp NOT NULL,
	`fimPeriodoAtual` timestamp NOT NULL,
	`inicioTrial` timestamp,
	`fimTrial` timestamp,
	`cancelarNoFimPeriodo` boolean NOT NULL DEFAULT false,
	`canceladoEm` timestamp,
	`motivoCancelamento` text,
	`stripeCustomerId` varchar(255),
	`stripeSubscriptionId` varchar(255),
	`stripePaymentMethodId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assinaturas_clinica_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categorias_procedimento` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinicaId` int NOT NULL,
	`nome` varchar(255) NOT NULL,
	`descricao` text,
	`cor` varchar(7),
	`ativo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categorias_procedimento_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clinicas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`email` varchar(320),
	`telemovel` varchar(50),
	`morada` text,
	`cidade` varchar(100),
	`codigoPostal` varchar(20),
	`pais` varchar(2) NOT NULL DEFAULT 'PT',
	`nif` varchar(50),
	`logoUrl` varchar(500),
	`ativo` boolean NOT NULL DEFAULT true,
	`proprietarioId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `clinicas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `configuracoes_financeiras` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinicaId` int NOT NULL,
	`procedimentoId` int,
	`dentistaId` int,
	`tipoDistribuicao` enum('percentagem','fixo','hibrido') NOT NULL DEFAULT 'percentagem',
	`percentagemDentista` decimal(5,2),
	`valorFixoDentista` decimal(10,2),
	`percentagemClinica` decimal(5,2),
	`valorFixoClinica` decimal(10,2),
	`custoLaboratorio` decimal(10,2) DEFAULT '0',
	`custoMateriais` decimal(10,2) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `configuracoes_financeiras_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consultas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinicaId` int NOT NULL,
	`utenteId` int NOT NULL,
	`dentistaId` int NOT NULL,
	`procedimentoId` int,
	`horaInicio` timestamp NOT NULL,
	`horaFim` timestamp NOT NULL,
	`estado` enum('agendada','confirmada','em_curso','concluida','cancelada','faltou') NOT NULL DEFAULT 'agendada',
	`titulo` varchar(255),
	`observacoes` text,
	`motivoCancelamento` text,
	`confirmadaEm` timestamp,
	`concluidaEm` timestamp,
	`canceladaEm` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `consultas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dentistas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinicaId` int NOT NULL,
	`userId` int,
	`nome` varchar(255) NOT NULL,
	`email` varchar(320),
	`telemovel` varchar(50),
	`especializacao` varchar(255),
	`numeroCedula` varchar(100),
	`percentagemComissao` decimal(5,2) DEFAULT '0',
	`ativo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dentistas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `faturas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinicaId` int NOT NULL,
	`utenteId` int NOT NULL,
	`consultaId` int,
	`numeroFatura` varchar(50) NOT NULL,
	`dataFatura` timestamp NOT NULL,
	`dataVencimento` timestamp,
	`subtotal` decimal(10,2) NOT NULL DEFAULT '0',
	`valorIVA` decimal(10,2) NOT NULL DEFAULT '0',
	`percentagemIVA` decimal(5,2) NOT NULL DEFAULT '0',
	`valorDesconto` decimal(10,2) NOT NULL DEFAULT '0',
	`valorTotal` decimal(10,2) NOT NULL DEFAULT '0',
	`valorPago` decimal(10,2) NOT NULL DEFAULT '0',
	`estado` enum('rascunho','enviada','paga','parcialmente_paga','vencida','cancelada') NOT NULL DEFAULT 'rascunho',
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `faturas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `historico_medico` (
	`id` int AUTO_INCREMENT NOT NULL,
	`utenteId` int NOT NULL,
	`alergias` text,
	`medicamentos` text,
	`condicoesMedicas` text,
	`cirurgiasPrevias` text,
	`historicoFamiliar` text,
	`estadoTabagismo` enum('nunca','ex_fumador','fumador'),
	`consumoAlcool` enum('nunca','ocasional','regular'),
	`tipoSanguineo` varchar(10),
	`contatoEmergenciaNome` varchar(255),
	`contatoEmergenciaTelemovel` varchar(50),
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `historico_medico_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `itens_fatura` (
	`id` int AUTO_INCREMENT NOT NULL,
	`faturaId` int NOT NULL,
	`procedimentoId` int,
	`descricao` varchar(500) NOT NULL,
	`quantidade` int NOT NULL DEFAULT 1,
	`precoUnitario` decimal(10,2) NOT NULL,
	`precoTotal` decimal(10,2) NOT NULL,
	`comissaoDentista` decimal(10,2) DEFAULT '0',
	`valorClinica` decimal(10,2) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `itens_fatura_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mensagens_utente` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinicaId` int NOT NULL,
	`utenteId` int NOT NULL,
	`templateId` int,
	`canal` enum('email','sms','whatsapp') NOT NULL,
	`assunto` varchar(500),
	`corpo` text NOT NULL,
	`estado` enum('pendente','enviada','entregue','lida','falhada') NOT NULL DEFAULT 'pendente',
	`enviadaEm` timestamp,
	`entregueEm` timestamp,
	`lidaEm` timestamp,
	`mensagemErro` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mensagens_utente_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `metricas_uso` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinicaId` int NOT NULL,
	`inicioPeriodo` timestamp NOT NULL,
	`fimPeriodo` timestamp NOT NULL,
	`totalUtentes` int NOT NULL DEFAULT 0,
	`totalConsultas` int NOT NULL DEFAULT 0,
	`totalFaturas` int NOT NULL DEFAULT 0,
	`receitaTotal` decimal(12,2) NOT NULL DEFAULT '0',
	`dentistasAtivos` int NOT NULL DEFAULT 0,
	`clinicasAtivas` int NOT NULL DEFAULT 0,
	`armazenamentoUsadoMB` int NOT NULL DEFAULT 0,
	`chamadasAPI` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `metricas_uso_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pagamentos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinicaId` int NOT NULL,
	`assinaturaId` int,
	`valor` decimal(10,2) NOT NULL,
	`moeda` varchar(3) NOT NULL DEFAULT 'EUR',
	`estado` enum('pendente','sucesso','falhado','reembolsado') NOT NULL,
	`descricao` text,
	`stripePaymentIntentId` varchar(255),
	`stripeInvoiceId` varchar(255),
	`metadata` json,
	`pagoEm` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pagamentos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pagamentos_fatura` (
	`id` int AUTO_INCREMENT NOT NULL,
	`faturaId` int NOT NULL,
	`valor` decimal(10,2) NOT NULL,
	`metodoPagamento` enum('dinheiro','cartao','transferencia','mbway','multibanco','outro') NOT NULL,
	`dataPagamento` timestamp NOT NULL,
	`referencia` varchar(255),
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pagamentos_fatura_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `planos_assinatura` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(100) NOT NULL,
	`slug` varchar(50) NOT NULL,
	`descricao` text,
	`precoMensal` decimal(10,2) NOT NULL,
	`precoAnual` decimal(10,2),
	`maxDentistas` int NOT NULL DEFAULT 1,
	`maxUtentes` int NOT NULL DEFAULT 100,
	`maxClinicas` int NOT NULL DEFAULT 1,
	`maxArmazenamentoGB` int NOT NULL DEFAULT 1,
	`funcionalidades` json,
	`ativo` boolean NOT NULL DEFAULT true,
	`popular` boolean NOT NULL DEFAULT false,
	`stripePriceIdMensal` varchar(255),
	`stripePriceIdAnual` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `planos_assinatura_id` PRIMARY KEY(`id`),
	CONSTRAINT `planos_assinatura_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `procedimentos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinicaId` int NOT NULL,
	`categoriaId` int,
	`codigo` varchar(50),
	`nome` varchar(255) NOT NULL,
	`descricao` text,
	`precoBase` decimal(10,2) NOT NULL DEFAULT '0',
	`duracaoMinutos` int DEFAULT 30,
	`cor` varchar(7),
	`ativo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `procedimentos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `registos_clinica` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nomeClinica` varchar(255) NOT NULL,
	`nomeProprietario` varchar(255) NOT NULL,
	`emailProprietario` varchar(320) NOT NULL,
	`telemovel` varchar(50),
	`morada` text,
	`cidade` varchar(100),
	`codigoPostal` varchar(20),
	`pais` varchar(2) NOT NULL DEFAULT 'PT',
	`planoSelecionadoId` int,
	`estado` enum('pendente','completo','cancelado') NOT NULL DEFAULT 'pendente',
	`tokenVerificacao` varchar(255),
	`verificadoEm` timestamp,
	`clinicaId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completadoEm` timestamp,
	CONSTRAINT `registos_clinica_id` PRIMARY KEY(`id`),
	CONSTRAINT `registos_clinica_emailProprietario_unique` UNIQUE(`emailProprietario`)
);
--> statement-breakpoint
CREATE TABLE `templates_mensagem` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinicaId` int NOT NULL,
	`nome` varchar(255) NOT NULL,
	`categoria` enum('lembrete_consulta','confirmacao_consulta','seguimento','pos_tratamento','marketing','outro') NOT NULL,
	`assunto` varchar(500),
	`corpo` text NOT NULL,
	`canal` enum('email','sms','whatsapp') NOT NULL DEFAULT 'email',
	`ativo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `templates_mensagem_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `utentes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinicaId` int NOT NULL,
	`numeroUtente` varchar(50) NOT NULL,
	`nome` varchar(255) NOT NULL,
	`email` varchar(320),
	`telemovel` varchar(50),
	`dataNascimento` timestamp,
	`genero` enum('masculino','feminino','outro'),
	`morada` text,
	`cidade` varchar(100),
	`codigoPostal` varchar(20),
	`pais` varchar(2) DEFAULT 'PT',
	`nif` varchar(50),
	`fotoUrl` varchar(500),
	`observacoes` text,
	`ativo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `utentes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `utilizadores_clinica` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clinicaId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('proprietario','admin','dentista','rececionista') NOT NULL,
	`ativo` boolean NOT NULL DEFAULT true,
	`convidadoPor` int,
	`convidadoEm` timestamp NOT NULL DEFAULT (now()),
	`aceiteEm` timestamp,
	CONSTRAINT `utilizadores_clinica_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','dentista','rececionista') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `updatedAt` timestamp NOT NULL DEFAULT (now());--> statement-breakpoint
ALTER TABLE `users` ADD `nome` text;--> statement-breakpoint
ALTER TABLE `assinaturas_clinica` ADD CONSTRAINT `assinaturas_clinica_clinicaId_clinicas_id_fk` FOREIGN KEY (`clinicaId`) REFERENCES `clinicas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assinaturas_clinica` ADD CONSTRAINT `assinaturas_clinica_planoId_planos_assinatura_id_fk` FOREIGN KEY (`planoId`) REFERENCES `planos_assinatura`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `categorias_procedimento` ADD CONSTRAINT `categorias_procedimento_clinicaId_clinicas_id_fk` FOREIGN KEY (`clinicaId`) REFERENCES `clinicas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clinicas` ADD CONSTRAINT `clinicas_proprietarioId_users_id_fk` FOREIGN KEY (`proprietarioId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `configuracoes_financeiras` ADD CONSTRAINT `configuracoes_financeiras_clinicaId_clinicas_id_fk` FOREIGN KEY (`clinicaId`) REFERENCES `clinicas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `configuracoes_financeiras` ADD CONSTRAINT `configuracoes_financeiras_procedimentoId_procedimentos_id_fk` FOREIGN KEY (`procedimentoId`) REFERENCES `procedimentos`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `configuracoes_financeiras` ADD CONSTRAINT `configuracoes_financeiras_dentistaId_dentistas_id_fk` FOREIGN KEY (`dentistaId`) REFERENCES `dentistas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `consultas` ADD CONSTRAINT `consultas_clinicaId_clinicas_id_fk` FOREIGN KEY (`clinicaId`) REFERENCES `clinicas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `consultas` ADD CONSTRAINT `consultas_utenteId_utentes_id_fk` FOREIGN KEY (`utenteId`) REFERENCES `utentes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `consultas` ADD CONSTRAINT `consultas_dentistaId_dentistas_id_fk` FOREIGN KEY (`dentistaId`) REFERENCES `dentistas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `consultas` ADD CONSTRAINT `consultas_procedimentoId_procedimentos_id_fk` FOREIGN KEY (`procedimentoId`) REFERENCES `procedimentos`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dentistas` ADD CONSTRAINT `dentistas_clinicaId_clinicas_id_fk` FOREIGN KEY (`clinicaId`) REFERENCES `clinicas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dentistas` ADD CONSTRAINT `dentistas_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `faturas` ADD CONSTRAINT `faturas_clinicaId_clinicas_id_fk` FOREIGN KEY (`clinicaId`) REFERENCES `clinicas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `faturas` ADD CONSTRAINT `faturas_utenteId_utentes_id_fk` FOREIGN KEY (`utenteId`) REFERENCES `utentes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `faturas` ADD CONSTRAINT `faturas_consultaId_consultas_id_fk` FOREIGN KEY (`consultaId`) REFERENCES `consultas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `historico_medico` ADD CONSTRAINT `historico_medico_utenteId_utentes_id_fk` FOREIGN KEY (`utenteId`) REFERENCES `utentes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `itens_fatura` ADD CONSTRAINT `itens_fatura_faturaId_faturas_id_fk` FOREIGN KEY (`faturaId`) REFERENCES `faturas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `itens_fatura` ADD CONSTRAINT `itens_fatura_procedimentoId_procedimentos_id_fk` FOREIGN KEY (`procedimentoId`) REFERENCES `procedimentos`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mensagens_utente` ADD CONSTRAINT `mensagens_utente_clinicaId_clinicas_id_fk` FOREIGN KEY (`clinicaId`) REFERENCES `clinicas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mensagens_utente` ADD CONSTRAINT `mensagens_utente_utenteId_utentes_id_fk` FOREIGN KEY (`utenteId`) REFERENCES `utentes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mensagens_utente` ADD CONSTRAINT `mensagens_utente_templateId_templates_mensagem_id_fk` FOREIGN KEY (`templateId`) REFERENCES `templates_mensagem`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `metricas_uso` ADD CONSTRAINT `metricas_uso_clinicaId_clinicas_id_fk` FOREIGN KEY (`clinicaId`) REFERENCES `clinicas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pagamentos` ADD CONSTRAINT `pagamentos_clinicaId_clinicas_id_fk` FOREIGN KEY (`clinicaId`) REFERENCES `clinicas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pagamentos` ADD CONSTRAINT `pagamentos_assinaturaId_assinaturas_clinica_id_fk` FOREIGN KEY (`assinaturaId`) REFERENCES `assinaturas_clinica`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pagamentos_fatura` ADD CONSTRAINT `pagamentos_fatura_faturaId_faturas_id_fk` FOREIGN KEY (`faturaId`) REFERENCES `faturas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `procedimentos` ADD CONSTRAINT `procedimentos_clinicaId_clinicas_id_fk` FOREIGN KEY (`clinicaId`) REFERENCES `clinicas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `procedimentos` ADD CONSTRAINT `procedimentos_categoriaId_categorias_procedimento_id_fk` FOREIGN KEY (`categoriaId`) REFERENCES `categorias_procedimento`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `registos_clinica` ADD CONSTRAINT `registos_clinica_planoSelecionadoId_planos_assinatura_id_fk` FOREIGN KEY (`planoSelecionadoId`) REFERENCES `planos_assinatura`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `templates_mensagem` ADD CONSTRAINT `templates_mensagem_clinicaId_clinicas_id_fk` FOREIGN KEY (`clinicaId`) REFERENCES `clinicas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `utentes` ADD CONSTRAINT `utentes_clinicaId_clinicas_id_fk` FOREIGN KEY (`clinicaId`) REFERENCES `clinicas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `utilizadores_clinica` ADD CONSTRAINT `utilizadores_clinica_clinicaId_clinicas_id_fk` FOREIGN KEY (`clinicaId`) REFERENCES `clinicas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `utilizadores_clinica` ADD CONSTRAINT `utilizadores_clinica_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `utilizadores_clinica` ADD CONSTRAINT `utilizadores_clinica_convidadoPor_users_id_fk` FOREIGN KEY (`convidadoPor`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `name`;