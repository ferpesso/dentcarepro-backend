# 📱 GUIA DE INTEGRAÇÕES - SMS/EMAIL/WHATSAPP
## DENTCAREPRO SAAS

Este guia explica como integrar provedores de SMS, Email e WhatsApp para envio de lembretes automáticos.

---

## 📧 INTEGRAÇÃO EMAIL

### **Opção 1: SendGrid (Recomendado)**

**Vantagens:**
- Fácil de configurar
- 100 emails/dia grátis
- Boa deliverability
- Dashboard completo

**Instalação:**
```bash
npm install @sendgrid/mail
```

**Configuração:**
```typescript
// server/integrations/sendgrid.ts
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function enviarEmail(
  destinatario: string,
  assunto: string,
  corpo: string
) {
  try {
    await sgMail.send({
      to: destinatario,
      from: process.env.EMAIL_FROM!, // Email verificado no SendGrid
      subject: assunto,
      text: corpo,
      html: corpo.replace(/\n/g, '<br>'),
    });
    return true;
  } catch (error) {
    console.error('Erro SendGrid:', error);
    return false;
  }
}
```

**Variáveis de ambiente (.env):**
```
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@dentcarepro.pt
```

**Custo:**
- Grátis: 100 emails/dia
- Essentials: €15/mês (40.000 emails)
- Pro: €90/mês (1.500.000 emails)

---

### **Opção 2: AWS SES**

**Vantagens:**
- Muito barato (€0.10 por 1000 emails)
- Escalável
- Integrado com AWS

**Instalação:**
```bash
npm install @aws-sdk/client-ses
```

**Configuração:**
```typescript
// server/integrations/aws-ses.ts
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const sesClient = new SESClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function enviarEmail(
  destinatario: string,
  assunto: string,
  corpo: string
) {
  try {
    const command = new SendEmailCommand({
      Source: process.env.EMAIL_FROM!,
      Destination: { ToAddresses: [destinatario] },
      Message: {
        Subject: { Data: assunto },
        Body: { Text: { Data: corpo } },
      },
    });

    await sesClient.send(command);
    return true;
  } catch (error) {
    console.error('Erro AWS SES:', error);
    return false;
  }
}
```

**Variáveis de ambiente:**
```
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@dentcarepro.pt
```

**Custo:**
- €0.10 por 1000 emails
- Muito econômico para alto volume

---

## 📱 INTEGRAÇÃO SMS

### **Opção 1: Twilio (Recomendado)**

**Vantagens:**
- Líder de mercado
- Fácil de usar
- Suporta Portugal
- Números portugueses disponíveis

**Instalação:**
```bash
npm install twilio
```

**Configuração:**
```typescript
// server/integrations/twilio.ts
import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function enviarSMS(
  destinatario: string,
  mensagem: string
) {
  try {
    // Formatar número para formato internacional
    const numeroFormatado = destinatario.startsWith('+')
      ? destinatario
      : `+351${destinatario.replace(/\s/g, '')}`;

    await client.messages.create({
      body: mensagem,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: numeroFormatado,
    });

    return true;
  } catch (error) {
    console.error('Erro Twilio:', error);
    return false;
  }
}
```

**Variáveis de ambiente:**
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+351912345678
```

**Custo (Portugal):**
- SMS: €0.04 - €0.08 por mensagem
- Número português: €1/mês
- Crédito inicial: €15 grátis (trial)

---

### **Opção 2: Vonage (ex-Nexmo)**

**Vantagens:**
- Bom para Europa
- Preços competitivos
- API simples

**Instalação:**
```bash
npm install @vonage/server-sdk
```

**Configuração:**
```typescript
// server/integrations/vonage.ts
import { Vonage } from '@vonage/server-sdk';

const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY!,
  apiSecret: process.env.VONAGE_API_SECRET!,
});

export async function enviarSMS(
  destinatario: string,
  mensagem: string
) {
  try {
    const numeroFormatado = destinatario.startsWith('351')
      ? destinatario
      : `351${destinatario.replace(/\s/g, '')}`;

    await vonage.sms.send({
      to: numeroFormatado,
      from: 'DentCarePro',
      text: mensagem,
    });

    return true;
  } catch (error) {
    console.error('Erro Vonage:', error);
    return false;
  }
}
```

**Variáveis de ambiente:**
```
VONAGE_API_KEY=xxxxxxxx
VONAGE_API_SECRET=xxxxxxxxxxxxxxxx
```

**Custo:**
- SMS Portugal: €0.05 por mensagem
- Sem taxas mensais

---

## 💬 INTEGRAÇÃO WHATSAPP

### **WhatsApp Business API (Oficial)**

**Vantagens:**
- Oficial e confiável
- Melhor deliverability
- Suporta templates

**Requisitos:**
- Conta Facebook Business
- Verificação de empresa
- Aprovação de templates

**Instalação:**
```bash
npm install axios
```

**Configuração:**
```typescript
// server/integrations/whatsapp.ts
import axios from 'axios';

export async function enviarWhatsApp(
  destinatario: string,
  mensagem: string,
  templateName?: string
) {
  try {
    const numeroFormatado = destinatario.startsWith('351')
      ? destinatario
      : `351${destinatario.replace(/\s/g, '')}`;

    const response = await axios.post(
      `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: numeroFormatado,
        type: templateName ? 'template' : 'text',
        ...(templateName
          ? {
              template: {
                name: templateName,
                language: { code: 'pt_PT' },
              },
            }
          : {
              text: { body: mensagem },
            }),
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return true;
  } catch (error) {
    console.error('Erro WhatsApp:', error);
    return false;
  }
}
```

**Variáveis de ambiente:**
```
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Custo:**
- Primeiras 1000 conversas/mês: Grátis
- Conversas adicionais: €0.005 - €0.01 cada
- Muito mais barato que SMS!

**Templates necessários:**
Você precisa criar e aprovar templates no Facebook Business Manager:

```
Template: lembrete_consulta
Categoria: APPOINTMENT_UPDATE
Idioma: Português (Portugal)

Conteúdo:
Olá {{1}}, tem consulta marcada para {{2}} às {{3}} com {{4}}. 
Por favor, chegue com 10 minutos de antecedência.
```

---

## 🔧 APLICAR INTEGRAÇÕES

### **1. Instalar dependências:**

```bash
cd dentcarepro-saas
npm install @sendgrid/mail twilio @vonage/server-sdk axios
```

### **2. Configurar variáveis de ambiente:**

Criar/editar `.env`:

```bash
# Email (escolher uma opção)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@dentcarepro.pt

# SMS (escolher uma opção)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+351912345678

# WhatsApp (opcional)
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### **3. Atualizar reminder-service.ts:**

Substituir os métodos `enviarEmail`, `enviarSMS`, `enviarWhatsApp` para usar as integrações reais.

---

## 💰 COMPARAÇÃO DE CUSTOS

### **Para 1000 lembretes/mês:**

| Provedor | Tipo | Custo/mês | Observações |
|----------|------|-----------|-------------|
| SendGrid | Email | Grátis | Até 3000/mês |
| AWS SES | Email | €0.10 | Muito barato |
| Twilio | SMS | €40-80 | €0.04-0.08/SMS |
| Vonage | SMS | €50 | €0.05/SMS |
| WhatsApp | WhatsApp | €5-10 | Muito barato! |

**Recomendação:**
- **Email:** SendGrid (grátis até 3000/mês)
- **SMS:** Twilio (mais confiável)
- **WhatsApp:** WhatsApp Business API (mais barato)

**Estratégia ideal:**
1. Email como principal (grátis)
2. WhatsApp como secundário (barato)
3. SMS como último recurso (caro)

---

## 📊 ESTATÍSTICAS ESPERADAS

Com lembretes automáticos implementados:

- **Redução de faltas:** 30-40%
- **Taxa de confirmação:** 70-80%
- **Satisfação do utente:** +25%
- **Receita recuperada:** +15%

**ROI:**
- Custo: €50-100/mês
- Receita recuperada: €500-1000/mês
- **ROI: 500-1000%**

---

## ✅ PRÓXIMOS PASSOS

1. Escolher provedores (SendGrid + Twilio + WhatsApp)
2. Criar contas e obter credenciais
3. Configurar variáveis de ambiente
4. Testar envios
5. Ativar lembretes automáticos
6. Monitorar estatísticas

---

**Precisa de ajuda?**
- SendGrid: https://sendgrid.com/docs
- Twilio: https://www.twilio.com/docs
- WhatsApp: https://developers.facebook.com/docs/whatsapp
