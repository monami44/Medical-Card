import { db } from './db';
import { encryptData, decryptData, getStoredKey } from './encryption';
import { EncryptedFile } from '@/types/EncryptedFile';

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const storeFile = async (file: File, userId: string, password: string, source: 'manual' | 'email' = 'manual'): Promise<EncryptedFile> => {
  const key = await getStoredKey(userId, password);
  const arrayBuffer = await file.arrayBuffer();
  const { encryptedData: encryptedOriginal, iv: ivOriginal } = await encryptData(arrayBuffer, key);

  const newFile: Omit<EncryptedFile, 'id'> = {
    name: file.name,
    userId,
    encryptedOriginal,
    ivOriginal,
    testDate: formatDate(new Date()),
    uploadDate: formatDate(new Date()),
    source
  };

  const id = await db.files.add(newFile);
  return { ...newFile, id: id.toString() };
};

export const retrieveFile = async (id: number | string, userId: string, password: string): Promise<File> => {
  const encryptedFile = await db.files.get(Number(id));
  if (!encryptedFile) throw new Error('File not found');

  const key = await getStoredKey(userId, password);
  const decryptedData = await decryptData(encryptedFile.encryptedOriginal, key, encryptedFile.ivOriginal);
  const fileName = `${encryptedFile.name}`;
  
  return new File([decryptedData], fileName, { type: 'application/octet-stream' });
};

export const getAllFiles = async (): Promise<EncryptedFile[]> => {
  return await db.files.toArray();
};

export const fetchEmailAttachments = async (userId: string, password: string): Promise<EncryptedFile[]> => {
  try {
    const response = await fetch('/api/fetch-email-attachments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, password }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch email attachments');
    }

    const data = await response.json();
    const key = await getStoredKey(userId, password);
    const storedFiles: EncryptedFile[] = [];

    for (const item of data.originals) {
      const file = new File([Buffer.from(item.data, 'base64')], item.filename, { type: 'application/pdf' });
      const storedFile = await storeFile(file, userId, password, 'email');
      storedFiles.push(storedFile);
    }

    return storedFiles;
  } catch (error) {
    console.error('Error fetching email attachments:', error);
    throw error;
  }
};