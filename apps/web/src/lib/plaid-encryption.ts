import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

function getEncryptionKey(): Buffer {
  const keyHex = process.env.PLAID_ENCRYPTION_KEY

  if (!keyHex) {
    throw new Error('PLAID_ENCRYPTION_KEY environment variable not set')
  }

  if (keyHex.length !== 64) {
    throw new Error('PLAID_ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  }

  return Buffer.from(keyHex, 'hex')
}

export function encryptAccessToken(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(16)

  const cipher = createCipheriv('aes-256-cbc', key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  return iv.toString('hex') + ':' + encrypted
}

export function decryptAccessToken(encrypted: string): string {
  const key = getEncryptionKey()

  const parts = encrypted.split(':')
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted format - expected IV:data')
  }

  const [ivHex, encryptedText] = parts
  const iv = Buffer.from(ivHex, 'hex')

  const decipher = createDecipheriv('aes-256-cbc', key, iv)
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
