import VerificationPanel from '../components/VerificationPanel';
import ThemeToggle from '../components/ThemeToggle';

export const metadata = {
  title: 'Verificación W3C con DCQL — Blerify (demo)',
};

// Ruta de PRUEBA para una regla de verificación de tipo W3C con DCQL, separada del flujo
// principal. Reutiliza el mismo panel apuntándolo al BFF /api/w3c (regla W3C_RULE_ID).
export default function W3CVerifyPage() {
  return (
    <>
      <header className="nav">
        <div className="container nav-inner">
          <span className="brand">
            <span className="brand-mark">B</span>
            Blerify
          </span>
          <div className="nav-right">
            <span className="demo-pill">Demo · W3C DCQL</span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="main">
        <div className="container hero">
          <div className="hero-copy">
            <span className="eyebrow"><span className="dot" /> Verificación W3C</span>
            <h1>Presenta una credencial W3C con DCQL</h1>
            <p className="lead">
              Ruta de prueba para validar una regla de verificación de tipo W3C (OpenID4VP 1.0 con
              consulta DCQL). Presenta una credencial W3C (JWT-VC) desde tu billetera y revisa los
              atributos verificados.
            </p>
            <ol className="steps">
              <li><span className="num">1</span><span>Inicia la verificación y obtén un código seguro.</span></li>
              <li><span className="num">2</span><span>Presenta tu credencial W3C desde tu billetera digital.</span></li>
              <li><span className="num">3</span><span>Recibe el resultado validado y los atributos revelados.</span></li>
            </ol>
          </div>
          <div className="panel-slot">
            <VerificationPanel
              apiBase="/api/w3c"
              title="Verificación W3C (DCQL)"
              subtitle="Presenta una credencial W3C desde tu billetera"
              credentialHint="Necesitas una credencial W3C en tu billetera digital."
            />
          </div>
        </div>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <span>Ejemplo de integración · verificación con Blerify (OIDC4VP)</span>
          <span className="muted">Entidad y datos ficticios para demostración.</span>
        </div>
      </footer>
    </>
  );
}
