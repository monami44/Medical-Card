import { db } from './db';
import { encryptData, decryptData, getStoredKey } from './encryption';
import { EncryptedFile } from '@/types/EncryptedFile';

export const storeFile = async (file: File, userId: string, password: string): Promise<void> => {
  const key = await getStoredKey(userId, password);
  const arrayBuffer = await file.arrayBuffer();
  const { encryptedData, iv } = await encryptData(new Uint8Array(arrayBuffer), key);
  
  await db.files.add({
    name: file.name,
    userId,
    encryptedData,
    iv
  });
};

export const retrieveFile = async (id: number, userId: string, password: string): Promise<File> => {
  const encryptedFile = await db.files.get(id);
  if (!encryptedFile) throw new Error('File not found');

  const key = await getStoredKey(userId, password);
  const decryptedData = await decryptData(encryptedFile.encryptedData, key, encryptedFile.iv);
  
  return new File([decryptedData], encryptedFile.name);
};

export const getAllFiles = async (): Promise<EncryptedFile[]> => {
  return await db.files.toArray();
}