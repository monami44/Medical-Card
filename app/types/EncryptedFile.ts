export interface EncryptedFile {
  id?: number;
  name: string;
  userId: string;
  encryptedData: string;
  iv: string;
}