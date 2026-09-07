import fs from 'fs/promises';
import path from 'path';

export async function readData<T>(fileName: string): Promise<T[]> {
  const filePath = path.join(process.cwd(), 'data', fileName);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as T[];
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export function generateId(prefix: string = ""): string {
  return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function writeData<T>(fileName: string, data: T[]): Promise<void> {
  const filePath = path.join(process.cwd(), 'data', fileName);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
