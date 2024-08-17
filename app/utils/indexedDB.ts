import Dexie from 'dexie';

class MedicalCardDatabase extends Dexie {
  bloodTestResults: Dexie.Table<{ id?: number, data: string }, number>;
  attachments: Dexie.Table<{ id?: number, filename: string, data: string, testDate?: string }, number>;

  constructor() {
    super('MedicalCardDB');
    this.version(1).stores({
      bloodTestResults: '++id',
      attachments: '++id, filename, testDate'
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

export async function storeAttachments(attachments: { filename: string, data: string, testDate?: string }[] | undefined) {
  await db.transaction('rw', db.attachments, async () => {
    if (Array.isArray(attachments)) {
      for (const attachment of attachments) {
        const existingAttachment = await db.attachments.where('filename').equals(attachment.filename).first();
        if (!existingAttachment) {
          await db.attachments.add(attachment);
        }
      }
    }
  });
}

export async function getBloodTestResults(): Promise<string | undefined> {
  const results = await db.bloodTestResults.toArray();
  return results[0]?.data;
}

export async function getAttachments(): Promise<{ filename: string, data: string, testDate?: string }[]> {
  return db.attachments.toArray();
}