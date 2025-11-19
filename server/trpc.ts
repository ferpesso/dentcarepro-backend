/**
 * Re-export do tRPC core para facilitar imports
 * Este ficheiro serve como ponte entre os routers e o core do tRPC
 */
export { router, publicProcedure, protectedProcedure, adminProcedure } from './_core/trpc';
