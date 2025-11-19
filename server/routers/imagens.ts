import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { imagensUtente } from "../../drizzle/schema-ficha-utente";
import { eq, and, desc } from "drizzle-orm";
import { IAService } from "../ia-service";
import { storagePut } from "../storage";
import { storageLocalPut } from "../storage-local";
import { ENV } from "../_core/env";

/**
 * Router para gestão de imagens de utentes
 * Inclui upload, análise por IA e visualização
 */

export const imagensRouter = router({
  /**
   * Listar imagens de um utente
   */
  listar: protectedProcedure
    .input(
      z.object({
        utenteId: z.number(),
        tipo: z.string().optional(), // filtrar por tipo
        limit: z.number().optional().default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      const conditions = [
        eq(imagensUtente.utenteId, input.utenteId),
        eq(imagensUtente.clinicaId, ctx.user.clinicaId!),
      ];

      if (input.tipo) {
        conditions.push(eq(imagensUtente.tipo, input.tipo));
      }

      const imagens = await database
        .select()
        .from(imagensUtente)
        .where(and(...conditions))
        .orderBy(desc(imagensUtente.dataUpload))
        .limit(input.limit);

      return imagens;
    }),

  /**
   * Obter detalhes de uma imagem
   */
  obter: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      const [imagem] = await database
        .select()
        .from(imagensUtente)
        .where(
          and(
            eq(imagensUtente.id, input.id),
            eq(imagensUtente.clinicaId, ctx.user.clinicaId!)
          )
        )
        .limit(1);

      if (!imagem) {
        throw new Error("Imagem não encontrada");
      }

      return imagem;
    }),

  /**
   * Upload de imagem
   * Recebe base64 da imagem e metadados
   */
  upload: protectedProcedure
    .input(
      z.object({
        utenteId: z.number(),
        tipo: z.string(), // radiografia_periapical, radiografia_panoramica, foto_intraoral, etc
        titulo: z.string().optional(),
        descricao: z.string().optional(),
        imagemBase64: z.string(), // data:image/jpeg;base64,/9j/4AAQ...
        denteRelacionado: z.number().optional(),
        consultaRelacionada: z.number().optional(),
        analisarComIA: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      // Extrair dados da imagem base64
      const matches = input.imagemBase64.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) {
        throw new Error("Formato de imagem inválido");
      }

      const formato = matches[1]; // jpeg, png, etc
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, "base64");
      const tamanhoBytes = buffer.length;

      // Gerar nome único para o arquivo
      const timestamp = Date.now();
      const fileName = `utente_${input.utenteId}_${timestamp}.${formato}`;
      const filePath = `imagens/${ctx.user.clinicaId}/${fileName}`;

      // Upload para storage (usa local em desenvolvimento)
      const useLocalStorage = ENV.nodeEnv === 'development';
      
      const { url: urlImagem } = useLocalStorage
        ? await storageLocalPut(filePath, buffer, `image/${formato}`)
        : await storagePut(filePath, buffer, `image/${formato}`);

      // Criar thumbnail (simplificado - em produção usar biblioteca de processamento)
      const thumbnailPath = `imagens/${ctx.user.clinicaId}/thumb_${fileName}`;
      const { url: urlThumbnail } = useLocalStorage
        ? await storageLocalPut(thumbnailPath, buffer, `image/${formato}`)
        : await storagePut(thumbnailPath, buffer, `image/${formato}`);

      // Inserir registro no banco
      const [imagemInserida] = await database
        .insert(imagensUtente)
        .values({
          utenteId: input.utenteId,
          clinicaId: ctx.user.clinicaId!,
          tipo: input.tipo,
          titulo: input.titulo || `${input.tipo} - ${new Date().toLocaleDateString()}`,
          descricao: input.descricao,
          urlImagem,
          urlThumbnail,
          tamanhoBytes,
          formato,
          denteRelacionado: input.denteRelacionado,
          consultaRelacionada: input.consultaRelacionada,
          uploadPor: ctx.user.dentistaId || null,
          analisadoPorIA: false,
        })
        .returning();

      // Se solicitado, analisar com IA
      if (input.analisarComIA) {
        try {
          const iaService = new IAService();
          await iaService.inicializar(ctx.user.clinicaId!);

          const resultadoIA = await iaService.analisarImagem({
            clinicaId: ctx.user.clinicaId!,
            utenteId: input.utenteId,
            imagemUrl: urlImagem,
            tipoImagem: input.tipo,
            contexto: {
              denteRelacionado: input.denteRelacionado,
            },
          });

          // Atualizar registro com resultado da IA
          await database
            .update(imagensUtente)
            .set({
              analisadoPorIA: true,
              resultadoIA: resultadoIA.dadosEstruturados,
            })
            .where(eq(imagensUtente.id, imagemInserida.id));

          return {
            ...imagemInserida,
            analisadoPorIA: true,
            resultadoIA: resultadoIA.dadosEstruturados,
          };
        } catch (error) {
          console.error("Erro ao analisar imagem com IA:", error);
          // Retorna a imagem mesmo se a análise falhar
          return imagemInserida;
        }
      }

      return imagemInserida;
    }),

  /**
   * Analisar imagem existente com IA
   */
  analisarComIA: protectedProcedure
    .input(z.object({ imagemId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      // Buscar imagem
      const [imagem] = await database
        .select()
        .from(imagensUtente)
        .where(
          and(
            eq(imagensUtente.id, input.imagemId),
            eq(imagensUtente.clinicaId, ctx.user.clinicaId!)
          )
        )
        .limit(1);

      if (!imagem) {
        throw new Error("Imagem não encontrada");
      }

      // Analisar com IA
      const iaService = new IAService();
      await iaService.inicializar(ctx.user.clinicaId!);

      const resultadoIA = await iaService.analisarImagem({
        clinicaId: ctx.user.clinicaId!,
        utenteId: imagem.utenteId,
        imagemUrl: imagem.urlImagem,
        tipoImagem: imagem.tipo,
        contexto: {
          denteRelacionado: imagem.denteRelacionado,
        },
      });

      // Atualizar registro
      await database
        .update(imagensUtente)
        .set({
          analisadoPorIA: true,
          resultadoIA: resultadoIA.dadosEstruturados,
        })
        .where(eq(imagensUtente.id, input.imagemId));

      return {
        sucesso: true,
        resultadoIA: resultadoIA.dadosEstruturados,
      };
    }),

  /**
   * Atualizar metadados de uma imagem
   */
  atualizar: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        titulo: z.string().optional(),
        descricao: z.string().optional(),
        denteRelacionado: z.number().optional().nullable(),
        consultaRelacionada: z.number().optional().nullable(),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      const { id, ...dados } = input;

      await database
        .update(imagensUtente)
        .set({
          ...dados,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(imagensUtente.id, id),
            eq(imagensUtente.clinicaId, ctx.user.clinicaId!)
          )
        );

      return { sucesso: true };
    }),

  /**
   * Excluir imagem
   */
  excluir: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      await database
        .delete(imagensUtente)
        .where(
          and(
            eq(imagensUtente.id, input.id),
            eq(imagensUtente.clinicaId, ctx.user.clinicaId!)
          )
        );

      return { sucesso: true };
    }),

  /**
   * Estatísticas de imagens
   */
  estatisticas: protectedProcedure
    .input(z.object({ utenteId: z.number() }))
    .query(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      const todasImagens = await database
        .select()
        .from(imagensUtente)
        .where(
          and(
            eq(imagensUtente.utenteId, input.utenteId),
            eq(imagensUtente.clinicaId, ctx.user.clinicaId!)
          )
        );

      const porTipo: Record<string, number> = {};
      let analisadasIA = 0;

      todasImagens.forEach((img) => {
        porTipo[img.tipo] = (porTipo[img.tipo] || 0) + 1;
        if (img.analisadoPorIA) analisadasIA++;
      });

      return {
        total: todasImagens.length,
        analisadasIA,
        porTipo,
      };
    }),
});
