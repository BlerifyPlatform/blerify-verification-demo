# blerify-verification-demo (front + BFF)

Ejemplo mínimo de **integración de verificación de identidad con Blerify** usando **OIDC4VP**
(OpenID for Verifiable Presentations) e **ISO 18013-5 (mDL)**. Es un miniservicio Next.js en modo
server: una página que inicia la verificación, muestra el **código QR** (o un **botón de billetera**
en móvil) y consulta el resultado; y unas rutas `app/api/*` que actúan de **BFF** (Backend For
Frontend) orquestando el flujo contra Blerify. **No hay secretos en el navegador.**

Este servicio **solo verifica identidad**: inicia la verificación, valida la presentación y devuelve
el resultado con los atributos revelados. No registra usuarios ni gestiona sesiones — esa lógica es
responsabilidad de la aplicación que integre este patrón.

## Cómo funciona

```
navegador ──POST /api/start──▶ BFF ──init (v2, cuenta de servicio)──▶ Blerify
   │  muestra QR / botón de wallet     ◀── { transaction_id, qr, link, ... }
   │
wallet ── escanea el QR (o abre el deep link) y presenta la credencial ──▶ Blerify
   │
   └─ sondeo: GET /api/status?transactionId ──▶ BFF ──poll + verify (v2)──▶ Blerify
                                          ◀── { status, credential: { valid, claims, validation } }
```

- **El BFF usa el flujo v2 autenticado** con una **cuenta de servicio** (OAuth2 `private_key_jwt`,
  RFC 7523; aserción firmada **RS256**, clave RSA-2048 en PKCS#8 PEM) para iniciar y consultar la
  verificación. La wallet, que escanea el QR y no tiene el token, baja el authorization request
  firmado por los endpoints públicos y presenta ahí.
- **No hay webhook**: el resultado se obtiene por **sondeo** (poll + verify en una sola llamada),
  correlacionado por `transaction_id`.
- **Móvil (mismo dispositivo)**: si la página se abre desde un teléfono o tableta (user agent
  iOS/Android), en vez del QR se muestra el botón **«Abrir mi billetera»** con el mismo deep link
  que codifica el QR (enlace universal que abre la app de la wallet); un conmutador permite ver el
  QR si la billetera está en otro dispositivo.

## Estructura

| Ruta | Rol |
|------|-----|
| `app/api/start/route.ts` | Inicia la verificación; devuelve `transaction_id`, QR y deep link. |
| `app/api/status/route.ts` | Sondeo: poll + verify; devuelve el resultado y los atributos. |
| `app/api/_lib/blerify.ts` | Cliente OIDC4VP v2 + token de la cuenta de servicio. |
| `app/api/_lib/store.ts` | Estado por `transaction_id` (en memoria; una réplica). |
| `app/api/_lib/mock.ts` | Modo demostración sin backend (`DEMO_MOCK=true`). |
| `app/components/VerificationPanel.tsx` | Interfaz del flujo (QR / botón / resultado). |

## Configuración (variables de entorno — lado servidor)

Toda la configuración es de ejecución; ver `.env.example`. Lo esencial:

- `BLERIFY_API_URL`, `ORG_ID`, `PROJECT_ID`, `RULE_ID`, `WALLET_BASE_URL`
- Cuenta de servicio (flujo real): `SA_CLIENT_ID`, `SA_PRIVATE_KEY` (RS256 / PKCS#8), `SA_IAM_AUDIENCE`
  y, opcionalmente, `SA_TOKEN_URI`, `SA_ORGANIZATION_ID`.

## Ejecutar en local

```bash
cp .env.example .env      # completa los valores (o usa DEMO_MOCK=true)
npm install
npm run dev               # http://localhost:3000
```

Sin backend ni cuenta de servicio, prueba solo la interfaz con el modo simulado:

```bash
DEMO_MOCK=true npm run dev
```

## Docker

```bash
docker build -t blerify-verification-demo .
docker run --env-file .env -p 8080:8080 blerify-verification-demo
```

La imagen es genérica: ninguna regla, organización ni clave se hornea en ella; todo se inyecta por
entorno en tiempo de ejecución.
