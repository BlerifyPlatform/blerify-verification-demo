// Modo MOCK para la demostración (sin backend real / sin cuenta de servicio).
// Se activa con DEMO_MOCK=true. /api/start genera un QR de aspecto real y /api/status
// simula pending → verified tras DEMO_MOCK_DELAY_MS, devolviendo un resultado de ejemplo
// con la MISMA forma que la respuesta real de Blerify (envelope v2 poll+verify).
import QRCode from 'qrcode';
import { randomUUID } from 'crypto';

export const MOCK_ENABLED = process.env.DEMO_MOCK === 'true';
const MOCK_DELAY_MS = Number(process.env.DEMO_MOCK_DELAY_MS ?? 5000);
const WALLET_BASE = (process.env.WALLET_BASE_URL ?? 'https://wallet.example.com/').replace(/\/$/, '');

export async function mockStart(): Promise<{ transactionId: string; qr: string; link: string }> {
  const transactionId = randomUUID();
  // Deep link de aspecto realista (datos ficticios) — solo para que el QR se vea como el real.
  const link =
    `${WALLET_BASE}/?request_uri=https://verifier.example.com/openid4vp/${transactionId}` +
    `&client_id=did:example:verifier&client_id_scheme=did&request_uri_method=post`;
  const qr = await QRCode.toDataURL(link, { width: 280, margin: 1 });
  return { transactionId, qr, link };
}

/** El "wallet presentó" simulado: verdadero una vez transcurrido el delay desde el inicio. */
export function mockReady(createdAt: number): boolean {
  return Date.now() - createdAt >= MOCK_DELAY_MS;
}

// JPEG gris de 1×1 (se estira a tarjeta por CSS): placeholder de las imágenes del documento que
// entrega la wallet en el sideband de extensiones (evidence.document_render, nivel STANDARD).
const MOCK_DOC_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

/** Resultado de verificación de ejemplo (misma forma que el envelope v2 poll+verify de Blerify). */
export function mockResult(): Record<string, unknown> {
  return {
    status: 'COMPLETED',
    transaction_id: 'mock-tx',
    assurance_level: 'STANDARD',
    effective_tier: 'STANDARD',
    credentials: [
      {
        issuer: 'did:example:issuer (ejemplo)',
        type: 'org.iso.18013.5.1.mDL',
        present: true,
        result: { credential_valid: true, signature_valid: true, issuer_trusted: true, holder_binding: 'VERIFIED', revoked: false, expired: false, warnings: [] },
        // ISO mDL: los claims revelados viven en data.namespaces (namespaced).
        data: {
          format: 'mso_mdoc',
          doctype: 'org.iso.18013.5.1.mDL',
          namespaces: {
            'org.iso.18013.5.1': {
              given_name: 'Ada',
              family_name: 'Lovelace',
              document_number: '000-000-000',
              birth_date: '1990-05-20',
              issuing_country: 'SV',
              expiry_date: '2033-01-15',
            },
          },
        },
      },
    ],
    evidence: {
      timestamp: '2026-01-01T00:00:00Z',
      note: 'Resultado SIMULADO — sin backend real',
      document_render: {
        format: 'image/jpeg',
        redaction: 'blur',
        images: [
          { side: 'front', data: MOCK_DOC_JPEG_BASE64 },
          { side: 'back', data: MOCK_DOC_JPEG_BASE64 },
        ],
      },
    },
  };
}
