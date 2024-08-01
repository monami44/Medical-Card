import { BloodTestResult } from '@/types/BloodTestResult';
import { normalRanges, NormalRangeKey } from '@/data/normalRanges';
import Papa from 'papaparse';
import { db } from './db';
import { getStoredKey, encryptData, decryptData } from './encryption';
import { supabaseClient } from '../../utils/supabaseClient';

type EncryptedBloodTestResult = Omit<BloodTestResult, keyof BloodTestResult> & { Date: string; encryptedData: string; iv: string };

export const fetchData = async (userId: string, password: string): Promise<BloodTestResult[]> => {
  try {
    const encryptedData = await db.bloodTestResults.toArray();
    console.log("Fetched encrypted data:", encryptedData.length, "items");
    
    if (encryptedData.length === 0) {
      throw new Error("No encrypted data found. Please set up encryption first.");
    }
    
    const key = await getStoredKey(userId, password);
    console.log("Retrieved encryption key");
    
    const decryptedData = await Promise.all(encryptedData.map(async (item) => {
      try {
        const decryptedItem = await decryptData(item.encryptedData, key, item.iv);
        const parsedItem = JSON.parse(new TextDecoder().decode(decryptedItem));
        
        // Handle potential invalid date
        let formattedDate = parsedItem.Date;
        try {
          formattedDate = new Date(parsedItem.Date).toISOString().split('T')[0];
        } catch (dateError) {
          console.warn(`Invalid date for item: ${parsedItem.Date}. Using original value.`);
        }

        return {
          ...parsedItem,
          Date: formattedDate
        };
      } catch (error) {
        console.error(`Error decrypting item:`, error);
        throw new Error(`Failed to decrypt item: ${error.message}`);
      }
    }));
    
    console.log("Successfully decrypted all items");
    return decryptedData;
  } catch (error) {
    console.error("Error in fetchData:", error);
    throw error;
  }
}

export const decryptBloodTestResult = async (encryptedResult: EncryptedBloodTestResult, userId: string, password: string): Promise<BloodTestResult> => {
  const key = await getStoredKey(userId, password);
  const decryptedData = JSON.parse(new TextDecoder().decode(await decryptData(encryptedResult.encryptedData, key, encryptedResult.iv)));
  return {
    ...decryptedData,
    Date: encryptedResult.Date
  };
}

export const sortByDate = (data: BloodTestResult[]): BloodTestResult[] => {
  return data.sort((a, b) => {
    const [dayA, monthA, yearA] = a.Date.split('/').map(Number);
    const [dayB, monthB, yearB] = b.Date.split('/').map(Number);
    return new Date(yearA, monthA - 1, dayA).getTime() - new Date(yearB, monthB - 1, dayB).getTime();
  });
}

export const calculateQuantile = (value: number, min: number, max: number): number => {
  return ((value - min) / (max - min)) * 100;
}

export const calculateMiddle = (min: number, max: number): number => {
  return (min + max) / 2;
}

export const calculateDomain = (data: BloodTestResult[], parameter: NormalRangeKey, range: { min: number, max: number }): [number, number] => {
  const values = data.map(item => item[parameter] as number).filter(value => value !== undefined);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const domainMin = Math.min(dataMin, range.min);
  const domainMax = Math.max(dataMax, range.max);
  const padding = (domainMax - domainMin) * 0.1; // 10% padding
  return [domainMin - padding, domainMax + padding];
}

export const calculateTrend = (data: BloodTestResult[], parameter: NormalRangeKey): number => {
  if (data.length < 2) return 0;
  const lastValue = data[data.length - 1][parameter] as number;
  const secondLastValue = data[data.length - 2][parameter] as number;
  return ((lastValue - secondLastValue) / secondLastValue) * 100;
}

export const normalizeValue = (value: number, min: number, max: number): number => {
  const range = max - min;
  const extendedMin = min - range * 0.5; // Extend the range below the minimum
  const extendedMax = max + range * 0.5; // Extend the range above the maximum
  return ((value - extendedMin) / (extendedMax - extendedMin)) * 100;
};

export const fetchAndEncryptData = async (userId: string, password: string): Promise<void> => {
  try {
    const response = await fetch("/blood_test_results.csv");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const text = await response.text();
    const parsedData = Papa.parse<BloodTestResult>(text, { header: true, dynamicTyping: true });
    
    const key = await getStoredKey(userId, password);
    const encryptedData = await Promise.all(parsedData.data.map(async (item) => {
      const dataToEncrypt = JSON.stringify(item);
      const { encryptedData, iv } = await encryptData(new TextEncoder().encode(dataToEncrypt), key);
      return {
        Date: item.Date,
        encryptedData,
        iv
      };
    }));
    
    await db.bloodTestResults.bulkAdd(encryptedData);
    console.log('Data fetched, encrypted, and stored successfully');
  } catch (error) {
    console.error("Error fetching, encrypting, or storing data:", error);
    throw error;
  }
};

export async function storeSaltInSupabase(userId: string, salt: Uint8Array): Promise<void> {
  const saltBase64 = btoa(String.fromCharCode.apply(null, salt));
  console.log('Storing salt for user:', userId);
  console.log('Salt (base64):', saltBase64);

  const supabase = supabaseClient();
  const { error } = await supabase
    .from('UserEncryption')
    .upsert({ userId: userId, salt: saltBase64 }, { onConflict: 'userId' });
  
  if (error) {
    console.error('Supabase error:', error);
    throw new Error(`Failed to store salt in Supabase: ${error.message}`);
  }
}

export async function createUserAndStoreKey(clerkUserId: string, password: string): Promise<void> {
  // Generate a new salt and key
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await getStoredKey(clerkUserId, password);

  // Store the salt in Supabase
  await storeSaltInSupabase(clerkUserId, salt);

  // Store the Clerk user ID in Supabase
  const { error } = await supabaseClient()
    .from('users')
    .upsert({ clerk_user_id: clerkUserId }, { onConflict: 'clerk_user_id' });

  if (error) throw new Error('Failed to store user in Supabase');
}