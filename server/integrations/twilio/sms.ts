import { getTwilioClient, getTwilioPhoneNumber } from './client';
import { getDb } from '../../db';
import { mensagensUtente } from '../../../drizzle/schema';

/**
 * Enviar SMS
 */
export async function enviarSMS(params: {
  para: string;
  mensagem: string;
  utenteId?: number;
  clinicaId?: number;
  tipo?: string;
}): Promise<{
  success: boolean;
  messageSid?: string;
  erro?: string;
}> {
  try {
    const client = getTwilioClient();
    const from = getTwilioPhoneNumber();

    // Normalizar número de telefone
    const para = normalizarNumeroTelefone(params.para);

    // Enviar SMS
    const message = await client.messages.create({
      body: params.mensagem,
      from: from,
      to: para,
    });

    // Registrar mensagem no banco de dados
    if (params.utenteId && params.clinicaId) {
      await registrarMensagem({
        utenteId: params.utenteId,
        clinicaId: params.clinicaId,
        tipo: params.tipo || 'sms',
        conteudo: params.mensagem,
        canal: 'sms',
        status: 'enviado',
        referencia: message.sid,
      });
    }

    console.log(`[Twilio] SMS enviado com sucesso: ${message.sid}`);

    return {
      success: true,
      messageSid: message.sid,
    };
  } catch (error: any) {
    console.error('[Twilio] Erro ao enviar SMS:', error.message);

    // Registrar falha no banco de dados
    if (params.utenteId && params.clinicaId) {
      await registrarMensagem({
        utenteId: params.utenteId,
        clinicaId: params.clinicaId,
        tipo: params.tipo || 'sms',
        conteudo: params.mensagem,
        canal: 'sms',
        status: 'falhou',
        erro: error.message,
      });
    }

    return {
      success: false,
      erro: error.message,
    };
  }
}

/**
 * Enviar SMS em lote
 */
export async function enviarSMSLote(params: {
  destinatarios: Array<{
    para: string;
    mensagem: string;
    utenteId?: number;
  }>;
  clinicaId?: number;
  tipo?: string;
}): Promise<{
  total: number;
  enviados: number;
  falhas: number;
  resultados: Array<{
    para: string;
    success: boolean;
    messageSid?: string;
    erro?: string;
  }>;
}> {
  const resultados = [];
  let enviados = 0;
  let falhas = 0;

  for (const dest of params.destinatarios) {
    const resultado = await enviarSMS({
      para: dest.para,
      mensagem: dest.mensagem,
      utenteId: dest.utenteId,
      clinicaId: params.clinicaId,
      tipo: params.tipo,
    });

    resultados.push({
      para: dest.para,
      ...resultado,
    });

    if (resultado.success) {
      enviados++;
    } else {
      falhas++;
    }

    // Aguardar 1 segundo entre envios para evitar rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return {
    total: params.destinatarios.length,
    enviados,
    falhas,
    resultados,
  };
}

/**
 * Verificar status de mensagem
 */
export async function verificarStatusMensagem(messageSid: string): Promise<{
  status: string;
  dataCriacao: Date;
  dataEnvio?: Date;
  erro?: string;
}> {
  try {
    const client = getTwilioClient();
    const message = await client.messages(messageSid).fetch();

    return {
      status: message.status,
      dataCriacao: message.dateCreated,
      dataEnvio: message.dateSent || undefined,
      erro: message.errorMessage || undefined,
    };
  } catch (error: any) {
    console.error('[Twilio] Erro ao verificar status:', error.message);
    throw error;
  }
}

/**
 * Normalizar número de telefone para formato internacional
 */
function normalizarNumeroTelefone(numero: string): string {
  // Remove espaços e caracteres especiais
  let cleaned = numero.replace(/[\s\-\(\)]/g, '');

  // Se não começar com +, adiciona +351 (Portugal)
  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('00')) {
      cleaned = '+' + cleaned.substring(2);
    } else if (cleaned.startsWith('351')) {
      cleaned = '+' + cleaned;
    } else if (cleaned.length === 9) {
      cleaned = '+351' + cleaned;
    }
  }

  return cleaned;
}

/**
 * Registrar mensagem no banco de dados
 */
async function registrarMensagem(params: {
  utenteId: number;
  clinicaId: number;
  tipo: string;
  conteudo: string;
  canal: string;
  status: string;
  referencia?: string;
  erro?: string;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn('[Twilio] Database não disponível para registrar mensagem');
      return;
    }

    await db.insert(mensagensUtente).values({
      utenteId: params.utenteId,
      clinicaId: params.clinicaId,
      tipo: params.tipo,
      conteudo: params.conteudo,
      canal: params.canal,
      status: params.status,
      referencia: params.referencia || null,
      dataEnvio: new Date(),
      erro: params.erro || null,
    });
  } catch (error: any) {
    console.error('[Twilio] Erro ao registrar mensagem no DB:', error.message);
  }
}
