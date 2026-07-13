import { NextRequest, NextResponse } from 'next/server';
import { pollVerification, PollResult } from '../_lib/blerify';
import { getCreatedAt, getResult, setResult, setStatus } from '../_lib/store';
import { MOCK_ENABLED, mockReady, mockResult } from '../_lib/mock';

export const dynamic = 'force-dynamic';

// Forma de la credencial verificada que se devuelve al frontend. Es genérica: no asume ningún
// conjunto de atributos concreto — expone los claims tal cual los reveló la wallet.
export interface VerifiedCredential {
  issuer: string;
  format: string;
  docType: string;
  valid: boolean;
  validation: Record<string, unknown>;
  claims: Record<string, unknown>;
}

// ISO mDL: los claims vienen por namespace (p.ej. {"org.iso.18013.5.1": {given_name, ...}}).
// Los aplanamos para poder leerlos directo. W3C ya viene plano (== credentialSubject).
function flattenClaims(claims: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(claims)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, v as Record<string, unknown>);
    else out[k] = v;
  }
  return out;
}

// Extrae la primera credencial verificada del envelope v2 (poll+verify), en forma genérica.
function extractCredential(result: PollResult): VerifiedCredential | null {
  const first = (result.credentials ?? [])[0];
  if (!first) return null;
  const data = first.data ?? {};
  const validation = (first.result ?? {}) as Record<string, unknown>;
  return {
    issuer: String(first.issuer ?? ''),
    format: String(data.format ?? ''),
    docType: String(data.doctype ?? first.type ?? ''),
    valid: Boolean(first.present) && Boolean(validation.credential_valid),
    validation,
    claims: flattenClaims((data.namespaces ?? data.claims ?? {}) as Record<string, unknown>),
  };
}

// COMPLETED + la primera credencial presente y válida (firma + binding, no revocada/expirada).
function isValid(result: PollResult): boolean {
  const first = (result.credentials ?? [])[0];
  const r = (first?.result ?? {}) as Record<string, unknown>;
  return Boolean(first?.present) && Boolean(r.credential_valid);
}

// Polling del frontend: pending hasta que la wallet presenta; al completarse, devuelve el
// resultado de la verificación y los atributos presentados. El flujo v2 hace poll + verify
// en una sola llamada (pollVerification). NO hay registro de usuario ni sesión: este servicio
// solo verifica identidad y devuelve el resultado.
export async function GET(req: NextRequest) {
  const tx = new URL(req.url).searchParams.get('transactionId');
  if (!tx) return NextResponse.json({ error: 'transactionId requerido' }, { status: 400 });

  const cached = getResult(tx) as VerifiedCredential | undefined;
  if (cached !== undefined) {
    return NextResponse.json({ status: 'verified', credential: cached });
  }

  if (MOCK_ENABLED) {
    if (mockReady(getCreatedAt(tx))) {
      const credential = extractCredential(mockResult() as PollResult);
      setResult(tx, credential);
      return NextResponse.json({ status: 'verified', credential });
    }
    return NextResponse.json({ status: 'pending' });
  }

  try {
    const poll = await pollVerification(tx);
    if (poll.status === 'PENDING') return NextResponse.json({ status: 'pending' });
    if (poll.status !== 'COMPLETED' || !isValid(poll)) {
      setStatus(tx, 'failed');
      return NextResponse.json({ status: 'failed', error: 'La credencial no es válida.' }, { status: 200 });
    }
    const credential = extractCredential(poll);
    setResult(tx, credential);
    return NextResponse.json({ status: 'verified', credential });
  } catch (e) {
    setStatus(tx, 'failed');
    return NextResponse.json({ status: 'failed', error: (e as Error).message }, { status: 502 });
  }
}
