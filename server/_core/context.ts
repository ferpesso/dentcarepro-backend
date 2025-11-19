import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // MODO DESENVOLVIMENTO: Criar utilizador fictício
  if (process.env.NODE_ENV === 'development') {
    user = {
      id: 1,
      openId: 'dev-user-001',
      nome: 'Desenvolvedor',
      email: 'dev@dentcarepro.com',
      loginMethod: 'dev',
      role: 'user',
      clinicaId: 1, // Associar à clínica de demonstração
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any;
  } else {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
