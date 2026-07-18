import crypto from "node:crypto";
import { query } from "@/lib/postgres";

export type ApiTokenSummary = {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

type TokenRow = {
  id: string;
  name: string;
  token_prefix: string;
  created_at: string | Date;
  last_used_at: string | Date | null;
  revoked_at: string | Date | null;
};

function formatTs(value: string | Date | null) {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : value;
}

function mapToken(row: TokenRow): ApiTokenSummary {
  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.token_prefix,
    createdAt: formatTs(row.created_at) ?? "",
    lastUsedAt: formatTs(row.last_used_at),
    revokedAt: formatTs(row.revoked_at)
  };
}

function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Create a new API token. Returns the full secret once (not stored plaintext). */
export async function createApiToken(input: { name: string }) {
  const name = input.name.trim() || "External service";
  const secret = `plc_${crypto.randomBytes(24).toString("base64url")}`;
  const prefix = secret.slice(0, 12);
  const tokenHash = hashToken(secret);

  const result = await query<{ id: string; created_at: string | Date }>(
    `insert into api_tokens (name, token_prefix, token_hash)
     values ($1, $2, $3)
     returning id, created_at`,
    [name, prefix, tokenHash]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    name,
    tokenPrefix: prefix,
    createdAt: formatTs(row.created_at) ?? new Date().toISOString(),
    /** Show once — never persisted in plaintext. */
    token: secret
  };
}

export async function listApiTokens() {
  const result = await query<TokenRow>(
    `select id, name, token_prefix, created_at, last_used_at, revoked_at
     from api_tokens
     order by created_at desc
     limit 50`
  );
  return result.rows.map(mapToken);
}

export async function revokeApiToken(id: string) {
  await query(
    `update api_tokens
     set revoked_at = coalesce(revoked_at, now())
     where id = $1`,
    [id]
  );
}

/**
 * Validate Bearer token. Returns token id when valid.
 * Updates last_used_at (best-effort).
 */
export async function authenticateApiToken(authorizationHeader: string | null) {
  if (!authorizationHeader) {
    return null;
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    return null;
  }

  const raw = match[1].trim();
  if (!raw) {
    return null;
  }

  const tokenHash = hashToken(raw);
  const result = await query<{ id: string }>(
    `select id
     from api_tokens
     where token_hash = $1
       and revoked_at is null
     limit 1`,
    [tokenHash]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  try {
    await query(`update api_tokens set last_used_at = now() where id = $1`, [row.id]);
  } catch {
    // non-fatal
  }

  return { tokenId: row.id };
}
