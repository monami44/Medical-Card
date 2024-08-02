import Dexie, { Table } from 'dexie';
import { BloodTestResult } from '@/types/BloodTestResult';
import { EncryptedFile } from '@/types/EncryptedFile';

export class MyDatabase extends Dexie {
  bloodTestResults!: Table<BloodTestResult>;
  files!: Table<EncryptedFile>;

  constructor() {
    super('MyDatabase');
    this.version(5).stores({
      bloodTestResults: '++id, date, encryptedData, iv',
      files: '++id, name, userId, encryptedOriginal, ivOriginal, testDate, uploadDate, source'
    });
  }
}

export const db = new MyDatabase();