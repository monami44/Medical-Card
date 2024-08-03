import { db } from './db';
import { encryptData, decryptData, getStoredKey } from './encryption';
import { EncryptedFile } from '@/types/EncryptedFile';
import { fetchData, sortByDate } from './chartUtils';
import { parse, format, isValid, setYear } from 'date-fns';

const formatDate = (dateString: string): string => {
  if (!dateString) return 'Unknown Date';
  
  // Try parsing as YYYY-MM-DD
  let date = parse(dateString, 'yyyy-MM-dd', new Date());
  
  // If not valid, try parsing as DD/MM/YYYY
  if (!isValid(date)) {
    date = parse(dateString, 'dd/MM/yyyy', new Date());
  }
  
  // If still not valid, return original string
  if (!isValid(date)) {
    console.warn(`Invalid date format: ${dateString}`);
    return dateString;
  }
  
  // If the year is before 1000, assume it's a recent year and add 2000
  if (date.getFullYear() < 1000) {
    date = setYear(date, date.getFullYear() + 2000);
  }
  
  // Format to DD/MM/YYYY with full year
  return format(date, 'dd/MM/yyyy');
};

export const storeFile = async (file: File, userId: string, password: string, source: 'manual' | 'email' = 'manual'): Promise<EncryptedFile | null> => {
  const key = await getStoredKey(userId, password);
  const arrayBuffer = await file.arrayBuffer();
  const { encryptedData: encryptedOriginal, iv: ivOriginal } = await encryptData(arrayBuffer, key);

  // Fetch and sort existing blood test results
  const bloodTestResults = await fetchData(userId, password);
  const sortedResults = sortByDate(bloodTestResults);

  // Extract the row number from the filename
  const rowMatch = file.name.match(/row_(\d+)/);
  const rowNumber = rowMatch ? parseInt(rowMatch[1]) : null;

  // Find the corresponding date for this file
  let testDate = '';
  if (rowNumber !== null && rowNumber <= sortedResults.length) {
    testDate = formatDate(sortedResults[rowNumber - 1].Date);
  } else {
    console.warn(`No matching date found for file: ${file.name}. Using empty string.`);
  }

  // Check for existing files with the same name or test date
  const existingFiles = await db.files.where('userId').equals(userId).toArray();
  const isDuplicate = existingFiles.some(existingFile => 
    existingFile.name === file.name || existingFile.testDate === testDate
  );

  if (isDuplicate) {
    console.warn(`Duplicate file detected: ${file.name}. Skipping storage.`);
    return null;
  }

  // New: Send file to backend for processing
  try {
    const response = await fetch('/api/fetch-email-attachments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        password,
        file: {
          name: file.name,
          type: file.type,
          size: file.size,
        },
        source,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to process file');
    }

    const processedData = await response.json();

    // Update testDate if it was empty and the backend provided a date
    if (!testDate && processedData.testDate) {
      testDate = processedData.testDate;
    }

    // Store additional processed data if provided by the backend
    const additionalData = processedData.additionalData || {};

    const newFile: Omit<EncryptedFile, 'id'> = {
      name: file.name,
      userId,
      encryptedOriginal,
      ivOriginal,
      testDate,
      uploadDate: formatDate(new Date().toISOString().split('T')[0]),
      source,
      ...additionalData
    };

    const id = await db.files.add(newFile);
    console.log(`File stored in IndexedDB with id: ${id}`);
    return { ...newFile, id: id.toString() };
  } catch (error) {
    console.error("Error processing file:", error);
    // If processing fails, still store the file with original data
    const newFile: Omit<EncryptedFile, 'id'> = {
      name: file.name,
      userId,
      encryptedOriginal,
      ivOriginal,
      testDate,
      uploadDate: formatDate(new Date().toISOString().split('T')[0]),
      source
    };

    const id = await db.files.add(newFile);
    console.log(`File stored in IndexedDB with id: ${id} (without additional processing)`);
    return { ...newFile, id: id.toString() };
  }
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
    const storedFiles: EncryptedFile[] = [];

    if (Array.isArray(data.attachments)) {
      for (const attachment of data.attachments) {
        if (attachment && attachment.filename && attachment.data) {
          const file = new File([Buffer.from(attachment.data, 'base64')], attachment.filename, { type: 'application/pdf' });
          const storedFile = await storeFile(file, userId, password, 'email');
          if (storedFile) {
            storedFiles.push(storedFile);
            console.log(`Stored file: ${attachment.filename}`);
          } else {
            console.log(`Skipped duplicate file: ${attachment.filename}`);
          }
        }
      }
    } else {
      console.error('Invalid attachments data:', data.attachments);
    }

    console.log(`Total files stored: ${storedFiles.length}`);
    return storedFiles;
  } catch (error) {
    console.error('Error fetching email attachments:', error);
    throw error;
  }
};