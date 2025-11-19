// Storage local para desenvolvimento
// Salva arquivos no sistema de arquivos do servidor

import fs from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const BASE_URL = process.env.VITE_API_URL || 'http://localhost:5000';

// Garantir que o diretório de uploads existe
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

// Gerar nome de arquivo único
function generateFileName(originalName: string): string {
  const ext = path.extname(originalName);
  const name = path.basename(originalName, ext);
  const random = randomBytes(8).toString('hex');
  const timestamp = Date.now();
  return `${name}-${timestamp}-${random}${ext}`;
}

// Upload de arquivo
export async function storageLocalPut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  await ensureUploadDir();
  
  const fileName = generateFileName(relKey);
  const filePath = path.join(UPLOAD_DIR, fileName);
  
  // Converter string para Buffer se necessário
  const buffer = typeof data === 'string' 
    ? Buffer.from(data) 
    : Buffer.from(data);
  
  // Salvar arquivo
  await fs.writeFile(filePath, buffer);
  
  // Retornar URL pública
  const url = `${BASE_URL}/uploads/${fileName}`;
  
  return { key: fileName, url };
}

// Obter URL de arquivo
export async function storageLocalGet(relKey: string): Promise<{ key: string; url: string }> {
  const fileName = path.basename(relKey);
  const filePath = path.join(UPLOAD_DIR, fileName);
  
  // Verificar se arquivo existe
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`Arquivo não encontrado: ${fileName}`);
  }
  
  const url = `${BASE_URL}/uploads/${fileName}`;
  
  return { key: fileName, url };
}

// Deletar arquivo
export async function storageLocalDelete(relKey: string): Promise<void> {
  const fileName = path.basename(relKey);
  const filePath = path.join(UPLOAD_DIR, fileName);
  
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error(`Erro ao deletar arquivo ${fileName}:`, error);
    throw error;
  }
}

// Listar arquivos
export async function storageLocalList(prefix?: string): Promise<string[]> {
  await ensureUploadDir();
  
  const files = await fs.readdir(UPLOAD_DIR);
  
  if (prefix) {
    return files.filter(f => f.startsWith(prefix));
  }
  
  return files;
}
