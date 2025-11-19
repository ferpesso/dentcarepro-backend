import twilio from 'twilio';

/**
 * Cliente Twilio configurado
 */
let twilioClient: ReturnType<typeof twilio> | null = null;

export function getTwilioClient() {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      throw new Error('TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN devem estar configurados');
    }

    twilioClient = twilio(accountSid, authToken);
  }

  return twilioClient;
}

/**
 * Obter número de telefone do Twilio
 */
export function getTwilioPhoneNumber(): string {
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!phoneNumber) {
    throw new Error('TWILIO_PHONE_NUMBER não está configurado');
  }

  return phoneNumber;
}
