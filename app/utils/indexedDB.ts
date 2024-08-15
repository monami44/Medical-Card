import Dexie from 'dexie';

class MedicalCardDatabase extends Dexie {
  bloodTestResults: Dexie.Table<{ id?: number, data: string }, number>;
  attachments: Dexie.Table<{ id?: number, filename: string, data: string }, number>;

  constructor() {
    super('MedicalCardDB');
    this.version(1).stores({
      bloodTestResults: '++id',
      attachments: '++id, filename'
    });
  }
}

const db = new MedicalCardDatabase();

export async function storeProcessedData(bloodTestResults: string) {
  await db.transaction('rw', db.bloodTestResults, async () => {
    await db.bloodTestResults.clear();
    await db.bloodTestResults.add({ data: bloodTestResults });
  });
}

export async function getBloodTestResults(): Promise<string | undefined> {
  const results = await db.bloodTestResults.toArray();
  return results[0]?.data;
}

export async function getAttachments(): Promise<{ filename: string, data: string }[]> {
  return db.attachments.toArray();
}