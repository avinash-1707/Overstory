import { createHash, randomBytes } from 'node:crypto'

// ApiKey format: `osk_<secret>`. Only the SHA-256 hash is stored (api_keys.hashedKey);
// the `prefix` is the leading slice, kept in plaintext for identification in the UI/CLI.
// These are high-entropy random keys, not passwords — SHA-256 + indexed equality lookup
// is the right scheme (no bcrypt; timing is moot against a 24-byte random secret). D26/D30.

const KEY_PREFIX = 'osk_'
const SECRET_BYTES = 24
const PREFIX_LEN = 12

export interface MintedKey {
  /** The plaintext key — shown to the user ONCE, never persisted. */
  key: string
  /** SHA-256 hex of the key — stored in api_keys.hashedKey. */
  hashedKey: string
  /** Leading slice of the key — stored in api_keys.prefix for identification. */
  prefix: string
}

export function mintApiKey(): MintedKey {
  const key = KEY_PREFIX + randomBytes(SECRET_BYTES).toString('base64url')
  return { key, hashedKey: hashKey(key), prefix: key.slice(0, PREFIX_LEN) }
}

export function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

// A real key is `osk_` + base64url(24 bytes) ≈ 36 chars. Anything far longer is junk;
// reject it before the SHA-256 + indexed lookup so an oversized header can't drive work
// in the auth path. Generous ceiling — never clips a legitimate key. (L4 audit.)
const MAX_TOKEN_LEN = 200

/** Pull the bearer token out of an Authorization header, or null. */
export function bearerFromHeader(header: string | undefined): string | null {
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  const token = match?.[1] ?? null
  if (token && token.length > MAX_TOKEN_LEN) return null
  return token
}
