import crypto from 'crypto';
import logger from '../logger';

/**
 * Encryption utilities for securing sensitive data like passwords
 * Uses AES-256-CBC encryption
 */

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Get encryption key from environment
 * Falls back to a default key if not set (NOT SECURE for production)
 */
function getEncryptionKey(): Buffer {
  const keyString = process.env.ENCRYPTION_MASTER_KEY || process.env.SESSION_SECRET || 'default-insecure-key-change-me';
  
  if (!process.env.ENCRYPTION_MASTER_KEY) {
    logger.log('warn', 'ENCRYPTION_MASTER_KEY not set! Using fallback key. This is NOT SECURE for production!');
  }
  
  // Create a 32-byte key from the string
  return crypto.createHash('sha256').update(keyString).digest();
}

/**
 * Encrypt a string value
 * @param text - Plain text to encrypt
 * @returns Encrypted string in format: iv:encryptedData
 */
export function encryptValue(text: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV and encrypted data separated by colon
    return iv.toString('hex') + ':' + encrypted;
  } catch (error: any) {
    logger.log('error', `Encryption failed: ${error.message}`);
    throw new Error('Failed to encrypt value');
  }
}

/**
 * Decrypt an encrypted string
 * @param encryptedText - Encrypted text in format: iv:encryptedData
 * @returns Decrypted plain text
 */
export function decryptValue(encryptedText: string): string {
  try {
    const key = getEncryptionKey();
    const parts = encryptedText.split(':');
    
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted text format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = parts[1];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error: any) {
    logger.log('error', `Decryption failed: ${error.message}`);
    throw new Error('Failed to decrypt value');
  }
}

/**
 * Hash a value (one-way, cannot be decrypted)
 * Useful for audit logs or verification
 */
export function hashValue(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Generate a secure random token
 * @param length - Length of token in bytes (will be hex encoded, so actual string length = length * 2)
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

