export type EncryptedFile = {
  id?: string;
  name: string;
  userId: string;
  encryptedOriginal: string;
  ivOriginal: string;
  testDate: string;
  uploadDate: string;
  source: 'manual' | 'email';
};