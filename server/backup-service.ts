import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import { getDb } from "./db";

const execAsync = promisify(exec);

/**
 * Serviço de Backup Automático
 * Gestão de backups da base de dados e ficheiros
 */

interface BackupConfig {
  backupDir: string;
  retentionDays: number;
  compressBackups: boolean;
}

const defaultConfig: BackupConfig = {
  backupDir: process.env.BACKUP_DIR || "/home/ubuntu/backups",
  retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || "30"),
  compressBackups: process.env.COMPRESS_BACKUPS === "true",
};

/**
 * Criar backup da base de dados
 */
export async function criarBackupBaseDados(config: Partial<BackupConfig> = {}) {
  const finalConfig = { ...defaultConfig, ...config };
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFileName = `backup-${timestamp}.sql`;
  const backupPath = path.join(finalConfig.backupDir, backupFileName);

  try {
    // Criar diretório de backups se não existir
    await fs.mkdir(finalConfig.backupDir, { recursive: true });

    // Obter configuração da base de dados
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error("DATABASE_URL não configurado");
    }

    // Parsear URL da base de dados
    const dbConfig = parseDbUrl(dbUrl);

    // Criar comando mysqldump
    const mysqldumpCmd = `mysqldump -h ${dbConfig.host} -P ${dbConfig.port} -u ${dbConfig.user} ${
      dbConfig.password ? `-p${dbConfig.password}` : ""
    } ${dbConfig.database} > ${backupPath}`;

    // Executar backup
    await execAsync(mysqldumpCmd);

    // Comprimir se configurado
    let finalPath = backupPath;
    if (finalConfig.compressBackups) {
      finalPath = `${backupPath}.gz`;
      await execAsync(`gzip ${backupPath}`);
    }

    // Obter tamanho do ficheiro
    const stats = await fs.stat(finalPath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

    return {
      success: true,
      backupPath: finalPath,
      fileName: path.basename(finalPath),
      sizeInMB: parseFloat(sizeInMB),
      timestamp: new Date(),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date(),
    };
  }
}

/**
 * Listar backups existentes
 */
export async function listarBackups(config: Partial<BackupConfig> = {}) {
  const finalConfig = { ...defaultConfig, ...config };

  try {
    const files = await fs.readdir(finalConfig.backupDir);
    const backupFiles = files.filter(
      (f) => f.startsWith("backup-") && (f.endsWith(".sql") || f.endsWith(".sql.gz"))
    );

    const backups = await Promise.all(
      backupFiles.map(async (file) => {
        const filePath = path.join(finalConfig.backupDir, file);
        const stats = await fs.stat(filePath);

        return {
          fileName: file,
          path: filePath,
          sizeInMB: (stats.size / (1024 * 1024)).toFixed(2),
          createdAt: stats.birthtime,
          compressed: file.endsWith(".gz"),
        };
      })
    );

    // Ordenar por data (mais recente primeiro)
    backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return backups;
  } catch (error: any) {
    throw new Error(`Erro ao listar backups: ${error.message}`);
  }
}

/**
 * Restaurar backup
 */
export async function restaurarBackup(
  backupFileName: string,
  config: Partial<BackupConfig> = {}
) {
  const finalConfig = { ...defaultConfig, ...config };
  const backupPath = path.join(finalConfig.backupDir, backupFileName);

  try {
    // Verificar se o ficheiro existe
    await fs.access(backupPath);

    // Obter configuração da base de dados
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error("DATABASE_URL não configurado");
    }

    const dbConfig = parseDbUrl(dbUrl);

    // Descomprimir se necessário
    let sqlFilePath = backupPath;
    if (backupFileName.endsWith(".gz")) {
      sqlFilePath = backupPath.replace(".gz", "");
      await execAsync(`gunzip -c ${backupPath} > ${sqlFilePath}`);
    }

    // Criar comando mysql
    const mysqlCmd = `mysql -h ${dbConfig.host} -P ${dbConfig.port} -u ${dbConfig.user} ${
      dbConfig.password ? `-p${dbConfig.password}` : ""
    } ${dbConfig.database} < ${sqlFilePath}`;

    // Executar restauro
    await execAsync(mysqlCmd);

    // Limpar ficheiro temporário se foi descomprimido
    if (backupFileName.endsWith(".gz")) {
      await fs.unlink(sqlFilePath);
    }

    return {
      success: true,
      message: "Backup restaurado com sucesso",
      timestamp: new Date(),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date(),
    };
  }
}

/**
 * Eliminar backups antigos
 */
export async function limparBackupsAntigos(config: Partial<BackupConfig> = {}) {
  const finalConfig = { ...defaultConfig, ...config };
  const backups = await listarBackups(finalConfig);

  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - finalConfig.retentionDays);

  const backupsEliminados: string[] = [];

  for (const backup of backups) {
    if (backup.createdAt < dataLimite) {
      try {
        await fs.unlink(backup.path);
        backupsEliminados.push(backup.fileName);
      } catch (error: any) {
        console.error(`Erro ao eliminar backup ${backup.fileName}:`, error.message);
      }
    }
  }

  return {
    eliminados: backupsEliminados.length,
    ficheiros: backupsEliminados,
  };
}

/**
 * Obter estatísticas de backups
 */
export async function getEstatisticasBackups(config: Partial<BackupConfig> = {}) {
  const backups = await listarBackups(config);

  const totalSize = backups.reduce((sum, b) => sum + parseFloat(b.sizeInMB), 0);
  const ultimoBackup = backups[0];

  return {
    total: backups.length,
    totalSizeInMB: totalSize.toFixed(2),
    ultimoBackup: ultimoBackup
      ? {
          fileName: ultimoBackup.fileName,
          createdAt: ultimoBackup.createdAt,
          sizeInMB: ultimoBackup.sizeInMB,
        }
      : null,
  };
}

/**
 * Parsear URL da base de dados
 */
function parseDbUrl(url: string) {
  // Formato: mysql://user:password@host:port/database
  const regex = /mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
  const match = url.match(regex);

  if (!match) {
    throw new Error("Formato de DATABASE_URL inválido");
  }

  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    database: match[5],
  };
}

/**
 * Agendar backups automáticos
 */
export function agendarBackupsAutomaticos(intervalHoras: number = 24) {
  console.log(`📦 Backups automáticos agendados a cada ${intervalHoras} horas`);

  // Executar backup imediatamente
  criarBackupBaseDados().then((result) => {
    if (result.success) {
      console.log(`✅ Backup inicial criado: ${result.fileName} (${result.sizeInMB} MB)`);
    } else {
      console.error(`❌ Erro no backup inicial: ${result.error}`);
    }
  });

  // Agendar backups periódicos
  setInterval(
    async () => {
      console.log("📦 Iniciando backup automático...");
      const result = await criarBackupBaseDados();

      if (result.success) {
        console.log(`✅ Backup criado: ${result.fileName} (${result.sizeInMB} MB)`);

        // Limpar backups antigos
        const limpeza = await limparBackupsAntigos();
        if (limpeza.eliminados > 0) {
          console.log(`🗑️  ${limpeza.eliminados} backups antigos eliminados`);
        }
      } else {
        console.error(`❌ Erro no backup: ${result.error}`);
      }
    },
    intervalHoras * 60 * 60 * 1000
  );
}

/**
 * Criar backup de ficheiros (uploads, etc.)
 */
export async function criarBackupFicheiros(
  sourceDir: string,
  config: Partial<BackupConfig> = {}
) {
  const finalConfig = { ...defaultConfig, ...config };
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFileName = `files-backup-${timestamp}.tar.gz`;
  const backupPath = path.join(finalConfig.backupDir, backupFileName);

  try {
    // Criar diretório de backups se não existir
    await fs.mkdir(finalConfig.backupDir, { recursive: true });

    // Criar arquivo tar.gz
    const tarCmd = `tar -czf ${backupPath} -C ${path.dirname(sourceDir)} ${path.basename(
      sourceDir
    )}`;
    await execAsync(tarCmd);

    // Obter tamanho do ficheiro
    const stats = await fs.stat(backupPath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

    return {
      success: true,
      backupPath,
      fileName: backupFileName,
      sizeInMB: parseFloat(sizeInMB),
      timestamp: new Date(),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date(),
    };
  }
}

/**
 * Verificar integridade de backup
 */
export async function verificarIntegridadeBackup(backupFileName: string) {
  const backupPath = path.join(defaultConfig.backupDir, backupFileName);

  try {
    // Verificar se o ficheiro existe
    await fs.access(backupPath);

    // Se for comprimido, verificar integridade do gzip
    if (backupFileName.endsWith(".gz")) {
      await execAsync(`gzip -t ${backupPath}`);
    }

    // Verificar se o ficheiro SQL é válido (tem conteúdo)
    const stats = await fs.stat(backupPath);
    if (stats.size === 0) {
      throw new Error("Ficheiro de backup vazio");
    }

    return {
      valid: true,
      message: "Backup íntegro",
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message,
    };
  }
}
