import { writeFile, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const STORAGE_PATH = process.env.STORAGE_PATH || './storage'

type StorageFolder = 'uploads' | 'logos' | 'covers'

async function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
}

export async function saveFile(
  file: File,
  folder: StorageFolder
): Promise<{ filename: string; path: string; size: number }> {
  const dir = path.join(STORAGE_PATH, folder)
  await ensureDir(dir)

  const ext = path.extname(file.name)
  const filename = `${randomUUID()}${ext}`
  const filePath = path.join(dir, filename)

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, buffer)

  return {
    filename,
    path: filePath,
    size: buffer.length,
  }
}

export async function deleteFile(filePath: string): Promise<void> {
  if (existsSync(filePath)) {
    await unlink(filePath)
  }
}

export function getFileUrl(folder: StorageFolder, filename: string): string {
  return `/api/files/${folder}/${filename}`
}
