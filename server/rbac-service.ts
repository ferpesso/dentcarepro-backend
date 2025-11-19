import { getDb } from "./db";
import bcrypt from "bcrypt";

/**
 * Servico de RBAC (Role-Based Access Control)
 * 
 * Funcionalidades:
 * - Autenticacao de utilizadores
 * - Verificacao de permissoes
 * - Gestao de funcoes
 * - Auditoria de acoes
 */

export interface Utilizador {
  id: number;
  clinicaId: number;
  dentistaId?: number;
  email: string;
  nome: string;
  funcaoId: number;
  funcaoNome: string;
  nivelAcesso: number;
  ativo: boolean;
  ultimoAcesso?: Date;
}

export interface Permissao {
  id: number;
  codigo: string;
  nome: string;
  descricao: string;
  modulo: string;
}

export interface Funcao {
  id: number;
  nome: string;
  descricao: string;
  nivelAcesso: number;
  permissoes: Permissao[];
}

export class RBACService {
  /**
   * Autenticar utilizador
   */
  static async autenticar(
    email: string,
    password: string
  ): Promise<Utilizador | null> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const resultado = await db.query(`
      SELECT 
        u.id,
        u.clinica_id,
        u.dentista_id,
        u.email,
        u.nome,
        u.funcao_id,
        u.password_hash,
        u.ativo,
        u.ultimo_acesso,
        f.nome as funcao_nome,
        f.nivel_acesso
      FROM utilizadores u
      JOIN funcoes f ON u.funcao_id = f.id
      WHERE u.email = ?
    `, [email]);

    if (!resultado || resultado.length === 0) {
      return null;
    }

    const user = resultado[0];

    // Verificar password
    const passwordValida = await bcrypt.compare(password, user.password_hash);
    if (!passwordValida) {
      return null;
    }

    // Verificar se esta ativo
    if (!user.ativo) {
      throw new Error("Utilizador inativo");
    }

    // Atualizar ultimo acesso
    await db.query(`
      UPDATE utilizadores
      SET ultimo_acesso = NOW()
      WHERE id = ?
    `, [user.id]);

    return {
      id: user.id,
      clinicaId: user.clinica_id,
      dentistaId: user.dentista_id,
      email: user.email,
      nome: user.nome,
      funcaoId: user.funcao_id,
      funcaoNome: user.funcao_nome,
      nivelAcesso: user.nivel_acesso,
      ativo: user.ativo,
      ultimoAcesso: user.ultimo_acesso,
    };
  }

  /**
   * Verificar se utilizador tem permissao
   */
  static async temPermissao(
    utilizadorId: number,
    codigoPermissao: string
  ): Promise<boolean> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const resultado = await db.query(`
      SELECT COUNT(*) as tem_permissao
      FROM utilizadores u
      JOIN funcoes_permissoes fp ON u.funcao_id = fp.funcao_id
      JOIN permissoes p ON fp.permissao_id = p.id
      WHERE u.id = ? AND p.codigo = ?
    `, [utilizadorId, codigoPermissao]);

    return parseInt(resultado[0]?.tem_permissao || 0) > 0;
  }

  /**
   * Obter permissoes do utilizador
   */
  static async getPermissoesUtilizador(
    utilizadorId: number
  ): Promise<Permissao[]> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const resultado = await db.query(`
      SELECT DISTINCT
        p.id,
        p.codigo,
        p.nome,
        p.descricao,
        p.modulo
      FROM utilizadores u
      JOIN funcoes_permissoes fp ON u.funcao_id = fp.funcao_id
      JOIN permissoes p ON fp.permissao_id = p.id
      WHERE u.id = ?
      ORDER BY p.modulo, p.nome
    `, [utilizadorId]);

    return resultado.map((p: any) => ({
      id: p.id,
      codigo: p.codigo,
      nome: p.nome,
      descricao: p.descricao,
      modulo: p.modulo,
    }));
  }

  /**
   * Obter todas as funcoes
   */
  static async getFuncoes(): Promise<Funcao[]> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const funcoes = await db.query(`
      SELECT id, nome, descricao, nivel_acesso
      FROM funcoes
      ORDER BY nivel_acesso DESC, nome
    `);

    const funcoesComPermissoes: Funcao[] = [];

    for (const funcao of funcoes) {
      const permissoes = await db.query(`
        SELECT 
          p.id,
          p.codigo,
          p.nome,
          p.descricao,
          p.modulo
        FROM funcoes_permissoes fp
        JOIN permissoes p ON fp.permissao_id = p.id
        WHERE fp.funcao_id = ?
        ORDER BY p.modulo, p.nome
      `, [funcao.id]);

      funcoesComPermissoes.push({
        id: funcao.id,
        nome: funcao.nome,
        descricao: funcao.descricao,
        nivelAcesso: funcao.nivel_acesso,
        permissoes: permissoes.map((p: any) => ({
          id: p.id,
          codigo: p.codigo,
          nome: p.nome,
          descricao: p.descricao,
          modulo: p.modulo,
        })),
      });
    }

    return funcoesComPermissoes;
  }

  /**
   * Criar utilizador
   */
  static async criarUtilizador(
    clinicaId: number,
    email: string,
    password: string,
    nome: string,
    funcaoId: number,
    dentistaId?: number
  ): Promise<number> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Hash da password
    const passwordHash = await bcrypt.hash(password, 10);

    const resultado = await db.query(`
      INSERT INTO utilizadores (
        clinica_id,
        dentista_id,
        email,
        password_hash,
        nome,
        funcao_id
      ) VALUES (?, ?, ?, ?, ?, ?)
      RETURNING id
    `, [clinicaId, dentistaId, email, passwordHash, nome, funcaoId]);

    return resultado[0].id;
  }

  /**
   * Atualizar funcao do utilizador
   */
  static async atualizarFuncao(
    utilizadorId: number,
    novaFuncaoId: number
  ): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db.query(`
      UPDATE utilizadores
      SET funcao_id = ?, updated_at = NOW()
      WHERE id = ?
    `, [novaFuncaoId, utilizadorId]);
  }

  /**
   * Desativar utilizador
   */
  static async desativarUtilizador(utilizadorId: number): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db.query(`
      UPDATE utilizadores
      SET ativo = FALSE, updated_at = NOW()
      WHERE id = ?
    `, [utilizadorId]);
  }

  /**
   * Registar acao (auditoria)
   */
  static async registarAcao(
    utilizadorId: number,
    clinicaId: number,
    acao: string,
    modulo: string,
    detalhes?: any,
    ipAddress?: string,
    userAgent?: string,
    sucesso: boolean = true
  ): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db.query(`
      INSERT INTO logs_acesso (
        utilizador_id,
        clinica_id,
        acao,
        modulo,
        detalhes,
        ip_address,
        user_agent,
        sucesso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      utilizadorId,
      clinicaId,
      acao,
      modulo,
      detalhes ? JSON.stringify(detalhes) : null,
      ipAddress,
      userAgent,
      sucesso,
    ]);
  }

  /**
   * Obter logs de auditoria
   */
  static async getLogsAuditoria(
    clinicaId: number,
    filtros?: {
      utilizadorId?: number;
      modulo?: string;
      dataInicio?: Date;
      dataFim?: Date;
      limite?: number;
    }
  ) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    let query = `
      SELECT 
        la.id,
        la.acao,
        la.modulo,
        la.detalhes,
        la.ip_address,
        la.sucesso,
        la.created_at,
        u.nome as utilizador_nome,
        u.email as utilizador_email
      FROM logs_acesso la
      LEFT JOIN utilizadores u ON la.utilizador_id = u.id
      WHERE la.clinica_id = ?
    `;

    const params: any[] = [clinicaId];

    if (filtros?.utilizadorId) {
      query += ` AND la.utilizador_id = ?`;
      params.push(filtros.utilizadorId);
    }

    if (filtros?.modulo) {
      query += ` AND la.modulo = ?`;
      params.push(filtros.modulo);
    }

    if (filtros?.dataInicio) {
      query += ` AND la.created_at >= ?`;
      params.push(filtros.dataInicio);
    }

    if (filtros?.dataFim) {
      query += ` AND la.created_at <= ?`;
      params.push(filtros.dataFim);
    }

    query += ` ORDER BY la.created_at DESC`;

    if (filtros?.limite) {
      query += ` LIMIT ?`;
      params.push(filtros.limite);
    }

    return await db.query(query, params);
  }

  /**
   * Listar utilizadores da clinica
   */
  static async getUtilizadoresClinica(clinicaId: number) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const resultado = await db.query(`
      SELECT 
        u.id,
        u.email,
        u.nome,
        u.ativo,
        u.ultimo_acesso,
        u.created_at,
        f.nome as funcao_nome,
        f.nivel_acesso,
        d.nome as dentista_nome
      FROM utilizadores u
      JOIN funcoes f ON u.funcao_id = f.id
      LEFT JOIN dentistas d ON u.dentista_id = d.id
      WHERE u.clinica_id = ?
      ORDER BY f.nivel_acesso DESC, u.nome
    `, [clinicaId]);

    return resultado.map((u: any) => ({
      id: u.id,
      email: u.email,
      nome: u.nome,
      ativo: u.ativo,
      ultimoAcesso: u.ultimo_acesso,
      criadoEm: u.created_at,
      funcaoNome: u.funcao_nome,
      nivelAcesso: u.nivel_acesso,
      dentistaNome: u.dentista_nome,
    }));
  }
}

export default RBACService;
