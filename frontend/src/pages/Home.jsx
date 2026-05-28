import { Link } from 'react-router-dom';
import { useWeb3 } from '../hooks/useWeb3';
import './Home.css';

export default function Home() {
  const { account, connectWallet, isConnecting, isIssuer } = useWeb3();

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">
            <span className="gradient-text">Immutable Digital</span>
            <br />Recognition System
          </h1>
          <p className="hero-subtitle">
            Issue, verify, and manage tamper-proof digital certificates on the blockchain.
            Powered by Ethereum NFT technology for ultimate security and transparency.
          </p>
          <div className="hero-actions">
            <div className="hero-buttons">
              <Link to="/verify" className="btn btn-primary btn-large">
                Public Verifier
              </Link>
              {!account ? (
                <button 
                  onClick={connectWallet} 
                  className="btn btn-secondary btn-large"
                  disabled={isConnecting}
                >
                  {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
              ) : (
                isIssuer && (
                  <Link to="/issue" className="btn btn-secondary btn-large">
                    Issue Certificate
                  </Link>
                )
              )}
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="floating-card">
            <div className="card-glow"></div>
            <div className="cert-preview">
              <span className="preview-icon">🎓</span>
              <h3>Digital Certificate</h3>
              <p>Blockchain Verified</p>
              <div className="preview-badge">NFT #0001</div>
            </div>
          </div>
        </div>
      </section>

      <section className="features">
        <h2 className="section-title">Why Blockchain Certificates?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>Tamper-Proof</h3>
            <p>Certificates stored on blockchain cannot be altered or forged, ensuring complete authenticity.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>Instant Verification</h3>
            <p>Verify any certificate in seconds with a public verification code.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🌐</div>
            <h3>Global Access</h3>
            <p>Access and share your certificates from anywhere in the world, anytime.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🏆</div>
            <h3>True Ownership</h3>
            <p>Your certificates are NFTs - you truly own them and can transfer or showcase them.</p>
          </div>
        </div>
      </section>

      <section className="how-it-works">
        <h2 className="section-title">How It Works</h2>
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <h3>Share Securely</h3>
            <p>Each issued certificate gets a public verification code</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step">
            <div className="step-number">2</div>
            <h3>Issue or Receive</h3>
            <p>Institutions issue certificates, recipients receive NFTs</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step">
            <div className="step-number">3</div>
            <h3>Verify Anytime</h3>
            <p>Anyone can verify certificate authenticity instantly without connecting a wallet</p>
          </div>
        </div>
      </section>
    </div>
  );
}
