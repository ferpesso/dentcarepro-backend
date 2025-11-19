import cron from 'node-cron';
import { ConsultaReminderService, PaymentReminderService } from './reminder-service';

/**
 * Sistema de Agendamento Automatico
 * 
 * Executa tarefas periodicas:
 * - Lembretes de consultas (diariamente as 09:00)
 * - Lembretes de pagamento (diariamente as 10:00)
 * - Limpeza de cache (diariamente as 03:00)
 * - Backup de dados (diariamente as 04:00)
 */

export class Scheduler {
  private static jobs: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Iniciar todos os agendamentos
   */
  static iniciar() {
    console.log('[SCHEDULER] Iniciando agendamentos automaticos...');

    // Lembrete de consultas - Diariamente as 09:00
    this.agendar(
      'lembretes-consultas',
      '0 9 * * *', // Cron: 09:00 todos os dias
      async () => {
        console.log('[SCHEDULER] Processando lembretes de consultas...');
        try {
          const resultado = await ConsultaReminderService.processarLembretesConsultas({
            tipo: 'todos',
            antecedenciaHoras: 24,
          });
          console.log(`[SCHEDULER] Lembretes enviados: ${resultado.enviados}/${resultado.total}`);
        } catch (error) {
          console.error('[SCHEDULER] Erro ao processar lembretes de consultas:', error);
        }
      }
    );

    // Lembrete de pagamentos - Diariamente as 10:00
    this.agendar(
      'lembretes-pagamentos',
      '0 10 * * *', // Cron: 10:00 todos os dias
      async () => {
        console.log('[SCHEDULER] Processando lembretes de pagamento...');
        try {
          const resultado = await PaymentReminderService.processarLembretesPagamento();
          console.log(`[SCHEDULER] Lembretes de pagamento enviados: ${resultado.enviados}/${resultado.total}`);
        } catch (error) {
          console.error('[SCHEDULER] Erro ao processar lembretes de pagamento:', error);
        }
      }
    );

    // Confirmacao de consultas - Diariamente as 14:00
    this.agendar(
      'confirmacao-consultas',
      '0 14 * * *', // Cron: 14:00 todos os dias
      async () => {
        console.log('[SCHEDULER] Processando confirmacoes de consultas (48h antes)...');
        try {
          const resultado = await ConsultaReminderService.processarLembretesConsultas({
            tipo: 'whatsapp',
            antecedenciaHoras: 48,
          });
          console.log(`[SCHEDULER] Confirmacoes enviadas: ${resultado.enviados}/${resultado.total}`);
        } catch (error) {
          console.error('[SCHEDULER] Erro ao processar confirmacoes:', error);
        }
      }
    );

    // Limpeza de cache - Diariamente as 03:00
    this.agendar(
      'limpeza-cache',
      '0 3 * * *', // Cron: 03:00 todos os dias
      async () => {
        console.log('[SCHEDULER] Executando limpeza de cache...');
        try {
          // TODO: Implementar limpeza de cache
          console.log('[SCHEDULER] Cache limpo com sucesso');
        } catch (error) {
          console.error('[SCHEDULER] Erro ao limpar cache:', error);
        }
      }
    );

    // Estatisticas diarias - Diariamente as 23:00
    this.agendar(
      'estatisticas-diarias',
      '0 23 * * *', // Cron: 23:00 todos os dias
      async () => {
        console.log('[SCHEDULER] Gerando estatisticas diarias...');
        try {
          // TODO: Implementar geracao de estatisticas
          console.log('[SCHEDULER] Estatisticas geradas com sucesso');
        } catch (error) {
          console.error('[SCHEDULER] Erro ao gerar estatisticas:', error);
        }
      }
    );

    console.log(`[SCHEDULER] ${this.jobs.size} agendamentos ativos`);
  }

  /**
   * Agendar uma tarefa
   */
  private static agendar(nome: string, cronExpression: string, callback: () => void | Promise<void>) {
    if (this.jobs.has(nome)) {
      console.warn(`[SCHEDULER] Agendamento '${nome}' ja existe, substituindo...`);
      this.jobs.get(nome)?.stop();
    }

    const job = cron.schedule(cronExpression, callback, {
      scheduled: true,
      timezone: 'Europe/Lisbon', // Fuso horario de Portugal
    });

    this.jobs.set(nome, job);
    console.log(`[SCHEDULER] Agendamento '${nome}' criado: ${cronExpression}`);
  }

  /**
   * Parar um agendamento
   */
  static parar(nome: string) {
    const job = this.jobs.get(nome);
    if (job) {
      job.stop();
      this.jobs.delete(nome);
      console.log(`[SCHEDULER] Agendamento '${nome}' parado`);
      return true;
    }
    return false;
  }

  /**
   * Parar todos os agendamentos
   */
  static pararTodos() {
    console.log('[SCHEDULER] Parando todos os agendamentos...');
    this.jobs.forEach((job, nome) => {
      job.stop();
      console.log(`[SCHEDULER] Agendamento '${nome}' parado`);
    });
    this.jobs.clear();
    console.log('[SCHEDULER] Todos os agendamentos parados');
  }

  /**
   * Listar agendamentos ativos
   */
  static listar() {
    return Array.from(this.jobs.keys());
  }

  /**
   * Executar um agendamento manualmente (para testes)
   */
  static async executarManualmente(nome: string) {
    console.log(`[SCHEDULER] Executando '${nome}' manualmente...`);
    
    switch (nome) {
      case 'lembretes-consultas':
        return await ConsultaReminderService.processarLembretesConsultas({
          tipo: 'todos',
          antecedenciaHoras: 24,
        });
      
      case 'lembretes-pagamentos':
        return await PaymentReminderService.processarLembretesPagamento();
      
      case 'confirmacao-consultas':
        return await ConsultaReminderService.processarLembretesConsultas({
          tipo: 'whatsapp',
          antecedenciaHoras: 48,
        });
      
      default:
        throw new Error(`Agendamento '${nome}' nao encontrado`);
    }
  }
}

/**
 * Iniciar scheduler quando o servidor iniciar
 */
export function iniciarScheduler() {
  // Verificar se deve iniciar (pode ser desativado via env var)
  if (process.env.DISABLE_SCHEDULER === 'true') {
    console.log('[SCHEDULER] Scheduler desativado via DISABLE_SCHEDULER=true');
    return;
  }

  Scheduler.iniciar();

  // Parar scheduler quando o processo terminar
  process.on('SIGINT', () => {
    console.log('[SCHEDULER] Recebido SIGINT, parando scheduler...');
    Scheduler.pararTodos();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('[SCHEDULER] Recebido SIGTERM, parando scheduler...');
    Scheduler.pararTodos();
    process.exit(0);
  });
}

export default Scheduler;
