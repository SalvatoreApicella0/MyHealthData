import { APP_NAME, SCHEMA_VERSION } from '../core/constants'
import { encryptedMhdExportFileSchema, parseMhdExportFile } from '../core/schema'
import type { EncryptedMhdExportFile, MhdExportFile } from '../core/types'

/**
 * PBKDF2-SHA-256 iterations for new exports (OWASP 2023 guidance for
 * password-based key derivation). Decryption honours the iteration count
 * recorded in the file, bounded to a safe range so a hostile file cannot force
 * an unbounded KDF workload.
 */
const ITERATIONS = 600_000
const MIN_ITERATIONS = 100_000
const MAX_ITERATIONS = 2_000_000
const SALT_BYTES = 16
const IV_BYTES = 12
/** Largest plaintext accepted after decryption (32 MiB). */
const MAX_PLAINTEXT_BYTES = 32 * 1024 * 1024

function assertWebCrypto(): SubtleCrypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto is not available in this browser.')
  }

  return globalThis.crypto.subtle
}

function bytesToBase64(bytes: Uint8Array): string {
  // Chunked to keep large exports linear instead of building one huge argument list.
  const chunkSize = 0x8000
  let binary = ''
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  return deriveKeyWithIterations(passphrase, salt, ITERATIONS)
}

async function deriveKeyWithIterations(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const subtle = assertWebCrypto()
  const passphraseBytes = new TextEncoder().encode(passphrase)
  const baseKey = await subtle.importKey('raw', passphraseBytes, 'PBKDF2', false, ['deriveKey'])

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptMhdExport(file: MhdExportFile, passphrase: string): Promise<EncryptedMhdExportFile> {
  if (passphrase.trim().length < 12) {
    throw new Error('Use a passphrase of at least 12 characters for encrypted export.')
  }

  const subtle = assertWebCrypto()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt)
  const plaintext = new TextEncoder().encode(JSON.stringify(file))
  const encrypted = await subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)

  return {
    manifest: {
      app: APP_NAME,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      encrypted: true,
      cryptoVersion: '0.1.0',
    },
    crypto: {
      algorithm: 'AES-GCM',
      kdf: 'PBKDF2-SHA-256',
      iterations: ITERATIONS,
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
    },
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  }
}

export async function decryptMhdExport(value: unknown, passphrase: string): Promise<MhdExportFile> {
  const encrypted = encryptedMhdExportFileSchema.parse(value)
  const subtle = assertWebCrypto()
  const salt = base64ToBytes(encrypted.crypto.salt)
  const iv = base64ToBytes(encrypted.crypto.iv)
  const ciphertext = base64ToBytes(encrypted.ciphertext)

  if (salt.length !== SALT_BYTES) {
    throw new Error('Encrypted export rejected: unexpected salt length.')
  }
  if (iv.length !== IV_BYTES) {
    throw new Error('Encrypted export rejected: unexpected IV length.')
  }
  if (ciphertext.length < 16 || ciphertext.length > MAX_PLAINTEXT_BYTES + 16) {
    throw new Error('Encrypted export rejected: unexpected ciphertext length.')
  }

  const iterations = encrypted.crypto.iterations
  if (!Number.isInteger(iterations) || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) {
    throw new Error('Encrypted export rejected: unsupported key-derivation iterations.')
  }

  const key = await deriveKeyWithIterations(passphrase, salt, iterations)
  const decrypted = await subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)

  if (decrypted.byteLength > MAX_PLAINTEXT_BYTES) {
    throw new Error('Encrypted export rejected: decrypted payload is too large.')
  }

  const decoded = new TextDecoder().decode(decrypted)

  return parseMhdExportFile(JSON.parse(decoded) as unknown)
}

export function isEncryptedMhdExport(value: unknown): value is EncryptedMhdExportFile {
  return encryptedMhdExportFileSchema.safeParse(value).success
}
