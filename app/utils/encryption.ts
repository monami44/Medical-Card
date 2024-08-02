import { Buffer } from 'buffer';
import { supabaseClient } from '../../utils/supabaseClient';

const algorithm = { name: 'AES-GCM', length: 256 };
const ivLength = 12;

export async function generateKey(password: string): Promise<{ key: CryptoKey, salt: Uint8Array }> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  return { key, salt };
}

export async function storeSaltInSupabase(userId: string, salt: Uint8Array): Promise<void> {
  const saltBase64 = btoa(String.fromCharCode.apply(null, salt));
  console.log('Storing salt for user:', userId);
  console.log('Salt (base64):', saltBase64);

  try {
    const supabase = supabaseClient();
    console.log('Supabase client created');
    const now = new Date().toISOString();
    const { data, error, status } = await supabase
      .from('UserEncryption')
      .upsert(
        { 
          userId: userId, 
          salt: saltBase64,
          createdAt: now,
          updatedAt: now
        }, 
        { onConflict: 'userId', ignoreDuplicates: false }
      )
      .select();
    
    console.log('Supabase response status:', status);
    
    if (error) {
      console.error('Supabase error:', error);
      throw new Error(`Failed to store salt in Supabase: ${JSON.stringify(error)}`);
    }

    if (!data || data.length === 0) {
      console.error('No data returned from Supabase');
      throw new Error('Failed to store or retrieve salt from Supabase');
    }

    console.log('Salt stored successfully:', data);
  } catch (error) {
    console.error('Error in storeSaltInSupabase:', error);
    throw error;
  }
}

export async function getStoredKey(clerkUserId: string, password: string): Promise<CryptoKey> {
  const supabase = supabaseClient();
  console.log("Fetching salt for user:", clerkUserId);
  const { data, error } = await supabase
    .from('UserEncryption')
    .select('salt')
    .eq('userId', clerkUserId)
    .single();

  if (error || !data) {
    console.error("Error fetching salt:", error);
    throw new Error("Encryption salt not found. Please set up your encryption password.");
  }

  console.log("Salt retrieved successfully");
  const salt = new Uint8Array(atob(data.salt).split("").map(char => char.charCodeAt(0)));

  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  console.log("Key material imported successfully");

  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  console.log("Key derived successfully");
  return derivedKey;
}

export async function encryptData(data: ArrayBuffer, key: CryptoKey): Promise<{ encryptedData: string; iv: string }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  console.log('Encrypting data:', { dataLength: data.byteLength, ivLength: iv.length });

  const encryptedData = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    data
  );

  const result = {
    encryptedData: Buffer.from(encryptedData).toString('base64'),
    iv: Buffer.from(iv).toString('base64')
  };

  console.log('Data encrypted successfully:', { 
    encryptedDataLength: result.encryptedData.length, 
    ivLength: result.iv.length 
  });

  return result;
}

export async function decryptData(encryptedData: string, key: CryptoKey, iv: string): Promise<ArrayBuffer> {
  try {
    const encryptedBuffer = Buffer.from(encryptedData, 'base64');
    const ivBuffer = Buffer.from(iv, 'base64');

    console.log('Decrypting data:', { encryptedDataLength: encryptedBuffer.length, ivLength: ivBuffer.length });

    const decryptedData = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBuffer },
      key,
      encryptedBuffer
    );

    console.log('Data decrypted successfully');
    return decryptedData;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error(`Decryption failed: ${error.message}`);
  }
}