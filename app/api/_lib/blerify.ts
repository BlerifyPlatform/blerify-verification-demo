// Cliente del BFF hacia el flujo OIDC4VP v2 de Blerify, expuesto en /client/api/v2/...
// El verificador (este BFF) usa el flujo v2 AUTENTICADO con un service account (Bearer): init + poll.
// La wallet, que escanea el QR y no tiene el token, baja el authorization request y presenta por los
// endpoints PÚBLICOS v1 (el JAR ya trae el response_uri público). El poll v2 (/response) hace
// poll + verify en una sola llamada y devuelve {status: PENDING|COMPLETED, credentials:[...]}.
import { SignJWT, importPKCS8 } from 'jose';
import { randomUUID } from 'crypto';

const API_URL = (process.env.BLERIFY_API_URL ?? 'https://api.blerify.com').replace(/\/$/, '');
const OID = process.env.ORG_ID ?? '';
const PID = process.env.PROJECT_ID ?? '';
const VID = process.env.RULE_ID ?? ''; // id de la PresentationVerification (regla publicada/ACTIVE)
const WALLET_BASE = process.env.WALLET_BASE_URL ?? 'https://wallet.blerify.com/production/';

// v2 client (autenticado, lo usa el verificador): init + poll(+verify).
const BASE_V2 = `${API_URL}/client/api/v2/openid4vp/organizations/${OID}/projects/${PID}/verifications/${VID}`;
// v1 público (lo usa la WALLET): de aquí baja el authorization request firmado.
const BASE_PUB = `${API_URL}/public/api/v1/openid4vp/organizations/${OID}/projects/${PID}/verifications/${VID}`;

export interface Session {
  request_id: string;
  transaction_id: string;
  client_id?: string;
  client_id_scheme?: string;
  request_uri_method?: string;
  signing_payload?: string;
  images?: { qrImage?: string };
}

// Respuesta del poll v2 (/response): poll + verify combinados.
export interface PollResult {
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  transaction_id?: string;
  credentials?: Array<{
    issuer?: string;
    type?: string;
    present?: boolean;
    result?: Record<string, unknown>;
    data?: { format?: string; doctype?: string; namespaces?: Record<string, unknown>; claims?: Record<string, unknown> };
  }>;
  [k: string]: unknown;
}

function assertConfig(): void {
  if (!OID || !PID || !VID) throw new Error('Faltan ORG_ID / PROJECT_ID / RULE_ID');
}

async function authHeaders(): Promise<Record<string, string>> {
  return { 'content-type': 'application/json', authorization: `Bearer ${await getServiceAccountToken()}` };
}

/** Inicia una sesión de verificación (v2, autenticado con el SA). Devuelve transaction_id + request_id. */
export async function createSession(): Promise<Session> {
  assertConfig();
  const res = await fetch(BASE_V2, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ nonce: randomUUID() }),
  });
  if (!res.ok) throw new Error(`init verification ${res.status}: ${await res.text()}`);
  return (await res.json()) as Session;
}

/**
 * Arma el deep link del QR. El `request_uri` apunta al endpoint PÚBLICO v1 /request/{request_id}:
 * la wallet (sin el token del SA) baja ahí el authorization request firmado por el backend
 * (managed ISO signing). El response_uri (a dónde presenta) ya viaja dentro de ese JAR.
 */
export function buildWalletLink(s: Session): string {
  const qs = new URLSearchParams({ request_uri: `${BASE_PUB}/request/${s.request_id}` });
  if (s.client_id) qs.set('client_id', s.client_id);
  if (s.client_id_scheme) qs.set('client_id_scheme', s.client_id_scheme);
  if (s.request_uri_method) qs.set('request_uri_method', s.request_uri_method);
  return `${WALLET_BASE}?${qs.toString()}`;
}

/** Poll v2 (autenticado): poll + verify en una llamada. PENDING hasta que la wallet presenta; luego COMPLETED. */
export async function pollVerification(transactionId: string): Promise<PollResult> {
  // Cache-buster (`_`) + no-store: cada poll BFF→backend es una URL única. Sin esto, el CDN
  // (Cloudflare) cachea la primera respuesta `PENDING` y el BFF nunca ve el COMPLETED del backend.
  const res = await fetch(`${BASE_V2}/response?transaction-id=${encodeURIComponent(transactionId)}&_=${Date.now()}`, {
    headers: { authorization: `Bearer ${await getServiceAccountToken()}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`poll response ${res.status}: ${await res.text()}`);
  return (await res.json()) as PollResult;
}

// ── Cuenta de servicio (OAuth2 private_key_jwt, RFC 7523) ────────────────────────────────────────
// Aserción firmada RS256 (RSA-2048, PKCS#8 PEM). Body que espera Blerify: SOLO client_id,
// organization_id, client_assertion (grant_type/assertion_type los agrega el servicio auth).
const SA_CLIENT_ID = process.env.SA_CLIENT_ID ?? '';
// PKCS#8 PEM (RSA-2048). Se normaliza porque las plataformas de env vars (Netlify/Vercel/Docker) no
// hacen lo que dotenv hace en local: guardan el valor literal. Aceptamos la clave en una sola línea
// con `\n` escapados y/o entre comillas, y la volvemos un PEM con saltos de línea REALES, que es lo
// que exige jose.importPKCS8 (si no, lanza: "pkcs8" must be PKCS#8 formatted string).
const SA_PRIVATE_KEY = (process.env.SA_PRIVATE_KEY ?? '')
  .trim()
  .replace(/^["']|["']$/g, '')
  .replace(/\\n/g, '\n');
const SA_TOKEN_URI = process.env.SA_TOKEN_URI ?? `${API_URL}/auth/v2/protocol/openid-connect/token`;
const SA_IAM_AUDIENCE = process.env.SA_IAM_AUDIENCE ?? ''; // https://iam.../realms/{orgId}
const SA_ORG_ID = process.env.SA_ORGANIZATION_ID ?? OID;

let cachedToken: { value: string; exp: number } | null = null;

export async function getServiceAccountToken(): Promise<string> {
  if (!SA_CLIENT_ID || !SA_PRIVATE_KEY || !SA_IAM_AUDIENCE) {
    throw new Error('Cuenta de servicio no configurada (SA_CLIENT_ID / SA_PRIVATE_KEY / SA_IAM_AUDIENCE)');
  }
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.value;

  const key = await importPKCS8(SA_PRIVATE_KEY, 'RS256');
  const assertion = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(SA_CLIENT_ID)
    .setSubject(SA_CLIENT_ID)
    .setAudience(SA_IAM_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .setJti(randomUUID())
    .sign(key);

  const body = new URLSearchParams({
    client_id: SA_CLIENT_ID,
    organization_id: SA_ORG_ID,
    client_assertion: assertion,
  });
  const res = await fetch(SA_TOKEN_URI, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`token endpoint ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in?: number };
  cachedToken = { value: json.access_token, exp: now + (json.expires_in ?? 3600) };
  return cachedToken.value;
}
