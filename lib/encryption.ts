import crypto from 'crypto';

const MASTER_KEY = process.env.MASTER_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

function deriveKey(key: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(key, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

export function generateUserKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function encryptUserKey(userKey: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const derivedKey = deriveKey(MASTER_KEY, salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
  let encrypted = cipher.update(userKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return salt.toString('hex') + ':' + iv.toString('hex') + ':' + encrypted;
}

export function decryptUserKey(encryptedUserKey: string): string {
  const [saltHex, ivHex, encryptedHex] = encryptedUserKey.split(':');
  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const derivedKey = deriveKey(MASTER_KEY, salt);
  const encryptedText = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

export function encryptData(data: string, encryptedUserKey: string): string {
  const userKey = decryptUserKey(encryptedUserKey);
  const salt = crypto.randomBytes(SALT_LENGTH);
  const derivedKey = deriveKey(userKey, salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return salt.toString('hex') + ':' + iv.toString('hex') + ':' + encrypted;
}

export function decryptData(encryptedData: string, encryptedUserKey: string): string {
  try {
    console.log('Starting decryption process');
    const userKey = decryptUserKey(encryptedUserKey);
    console.log('User key decrypted successfully');
    
    const [saltHex, ivHex, encryptedHex] = encryptedData.split(':');
    if (!saltHex || !ivHex || !encryptedHex) {
      throw new Error('Invalid encrypted data format');
    }
    console.log('Encrypted data split successfully');
    
    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const derivedKey = deriveKey(userKey, salt);
    const encryptedText = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    console.log('Decryption completed successfully');
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption error:', error);
    throw error;
  }
}