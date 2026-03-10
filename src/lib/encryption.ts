import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

/**
 * Get the encryption key from environment variable.
 * The key must be a 32-byte hex string (64 characters).
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY

  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }

  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }

  return Buffer.from(key, 'hex')
}

/**
 * Encrypt a string using AES-256-GCM.
 * Returns a base64-encoded string containing: IV + AuthTag + CipherText
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8')
  encrypted = Buffer.concat([encrypted, cipher.final()])

  const authTag = cipher.getAuthTag()

  // Combine: IV (16 bytes) + AuthTag (16 bytes) + Ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted])

  return combined.toString('base64')
}

/**
 * Decrypt a string that was encrypted with the encrypt function.
 * Expects a base64-encoded string containing: IV + AuthTag + CipherText
 */
export function decrypt(encryptedBase64: string): string {
  const key = getEncryptionKey()
  const combined = Buffer.from(encryptedBase64, 'base64')

  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted data: too short')
  }

  // Extract components
  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted)
  decrypted = Buffer.concat([decrypted, decipher.final()])

  return decrypted.toString('utf8')
}

/**
 * Generate a random encryption key (for initial setup).
 * Returns a 64-character hex string.
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Encrypt OAuth tokens object.
 * Convenience function for encrypting token data.
 */
export function encryptTokens(tokens: {
  accessToken: string
  refreshToken: string
  expiresAt?: Date | null
}): {
  accessToken: string
  refreshToken: string
} {
  return {
    accessToken: encrypt(tokens.accessToken),
    refreshToken: encrypt(tokens.refreshToken),
  }
}

/**
 * Decrypt OAuth tokens.
 * Convenience function for decrypting token data.
 */
export function decryptTokens(encrypted: {
  accessToken: string
  refreshToken: string
}): {
  accessToken: string
  refreshToken: string
} {
  return {
    accessToken: decrypt(encrypted.accessToken),
    refreshToken: decrypt(encrypted.refreshToken),
  }
}
