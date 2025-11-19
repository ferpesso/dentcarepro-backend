/**
 * Router tRPC para testes de WhatsApp
 * Adicionar ao router principal
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { whatsappService } from "../whatsapp-service";

export const whatsappTestRouter = router({
  /**
   * Testar envio de mensagem
   */
  testMessage: protectedProcedure
    .input(
      z.object({
        phoneNumber: z.string(),
        message: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const clinicaId = ctx.user.clinicaId;
      
      if (!clinicaId) {
        throw new Error("Clínica não encontrada");
      }

      // Enviar mensagem de teste
      const resultado = await whatsappService.sendTextMessage(
        input.phoneNumber,
        input.message,
        clinicaId,
        null // sem utente específico para teste
      );

      return resultado;
    }),
});

// Adicionar ao router principal whatsapp.ts:
// testMessage: whatsappTestRouter.testMessage,
