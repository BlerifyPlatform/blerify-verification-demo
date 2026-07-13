import VerificationPanel from './components/VerificationPanel';
import ThemeToggle from './components/ThemeToggle';

export default function Home() {
  return (
    <>
      <header className="nav">
        <div className="container nav-inner">
          <span className="brand">
            <span className="brand-mark">B</span>
            Blerify
          </span>
          <div className="nav-right">
            <span className="demo-pill">Demo · OIDC4VP</span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="main">
        <div className="container hero">
          <div className="hero-copy">
            <span className="eyebrow"><span className="dot" /> Verificación de identidad</span>
            <h1>Verifica una credencial digital en segundos</h1>
            <p className="lead">
              Ejemplo de integración con Blerify usando OIDC4VP e ISO 18013-5 (mDL). El navegador nunca
              ve secretos: un BFF inicia la verificación, muestra el código QR o el botón de la billetera
              y consulta el resultado por sondeo.
            </p>
            <ol className="steps">
              <li><span className="num">1</span><span>Inicia la verificación y obtén un código seguro.</span></li>
              <li><span className="num">2</span><span>Presenta tu credencial desde tu billetera digital.</span></li>
              <li><span className="num">3</span><span>Recibe el resultado validado y los atributos revelados.</span></li>
            </ol>
          </div>
          <div className="panel-slot">
            <VerificationPanel />
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
