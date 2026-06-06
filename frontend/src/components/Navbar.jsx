import { Link, useLocation } from 'react-router-dom';
import { useWeb3 } from '../hooks/useWeb3';
import './Navbar.css';

export default function Navbar() {
  const { account, isConnecting, isIssuer, isAdmin, networkName, connectWallet, disconnectWallet } = useWeb3();
  const location = useLocation();

  const formatAddress = (addr) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          <span className="brand-icon">🎓</span>
          <span className="brand-text">AfHadChain</span>
        </Link>

        <div className="navbar-links">
          <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
            Home
          </Link>
          <Link to="/verify" className={`nav-link ${isActive('/verify') ? 'active' : ''}`}>
            Verify
          </Link>
          <Link to="/gallery" className={`nav-link ${isActive('/gallery') ? 'active' : ''}`}>
            Gallery
          </Link>
          {isIssuer && (
            <Link to="/issue" className={`nav-link ${isActive('/issue') ? 'active' : ''}`}>
              Issue
            </Link>
          )}
          {isAdmin && (
            <Link to="/admin" className={`nav-link ${isActive('/admin') ? 'active' : ''}`}>
              Admin
            </Link>
          )}
        </div>

        <div className="navbar-wallet">
          {account ? (
            <div className="wallet-info">
              <div className="wallet-details">
                <span className="network-badge">{networkName}</span>
                <span className="wallet-address">{formatAddress(account)}</span>
                {isAdmin && <span className="role-badge admin">Admin</span>}
                {isIssuer && !isAdmin && <span className="role-badge issuer">Issuer</span>}
              </div>
              <button onClick={disconnectWallet} className="btn btn-disconnect">
                Disconnect
              </button>
            </div>
          ) : (
            <button 
              onClick={connectWallet} 
              className="btn btn-connect"
              disabled={isConnecting}
            >
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
