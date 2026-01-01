import { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import toast from 'react-hot-toast';
import './Admin.css';

export default function Admin() {
  const { contract, account, isAdmin, isIssuer } = useWeb3();
  const [newIssuerAddress, setNewIssuerAddress] = useState('');
  const [removeIssuerAddress, setRemoveIssuerAddress] = useState('');
  const [checkAddress, setCheckAddress] = useState('');
  const [checkResult, setCheckResult] = useState(null);
  const [loading, setLoading] = useState({
    add: false,
    remove: false,
    check: false
  });
  const [stats, setStats] = useState({
    totalCerts: 0
  });

  const loadStats = useCallback(async () => {
    if (!contract) return;
    try {
      const total = await contract.getTotalCertificates();
      setStats({ totalCerts: Number(total) });
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }, [contract]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleAddIssuer = async (e) => {
    e.preventDefault();

    if (!/^0x[a-fA-F0-9]{40}$/.test(newIssuerAddress)) {
      toast.error('Invalid Ethereum address');
      return;
    }

    setLoading(prev => ({ ...prev, add: true }));

    try {
      const tx = await contract.addIssuer(newIssuerAddress);
      toast.loading('Adding issuer...', { id: 'addIssuer' });
      await tx.wait();
      toast.success('Issuer added successfully!', { id: 'addIssuer' });
      setNewIssuerAddress('');
    } catch (error) {
      console.error('Error adding issuer:', error);
      toast.error(error.reason || 'Failed to add issuer', { id: 'addIssuer' });
    } finally {
      setLoading(prev => ({ ...prev, add: false }));
    }
  };

  const handleRemoveIssuer = async (e) => {
    e.preventDefault();

    if (!/^0x[a-fA-F0-9]{40}$/.test(removeIssuerAddress)) {
      toast.error('Invalid Ethereum address');
      return;
    }

    setLoading(prev => ({ ...prev, remove: true }));

    try {
      const tx = await contract.removeIssuer(removeIssuerAddress);
      toast.loading('Removing issuer...', { id: 'removeIssuer' });
      await tx.wait();
      toast.success('Issuer removed successfully!', { id: 'removeIssuer' });
      setRemoveIssuerAddress('');
    } catch (error) {
      console.error('Error removing issuer:', error);
      toast.error(error.reason || 'Failed to remove issuer', { id: 'removeIssuer' });
    } finally {
      setLoading(prev => ({ ...prev, remove: false }));
    }
  };

  const handleCheckRole = async (e) => {
    e.preventDefault();

    if (!/^0x[a-fA-F0-9]{40}$/.test(checkAddress)) {
      toast.error('Invalid Ethereum address');
      return;
    }

    setLoading(prev => ({ ...prev, check: true }));
    setCheckResult(null);

    try {
      const [issuerStatus, adminStatus] = await Promise.all([
        contract.isIssuer(checkAddress),
        contract.isAdmin(checkAddress)
      ]);
      
      setCheckResult({
        address: checkAddress,
        isIssuer: issuerStatus,
        isAdmin: adminStatus
      });
    } catch (error) {
      console.error('Error checking role:', error);
      toast.error('Failed to check role');
    } finally {
      setLoading(prev => ({ ...prev, check: false }));
    }
  };

  if (!account) {
    return (
      <div className="admin-page">
        <div className="admin-container">
          <div className="access-denied">
            <div className="denied-icon">🔗</div>
            <h2>Connect Wallet</h2>
            <p>Please connect your wallet to access admin panel</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="admin-page">
        <div className="admin-container">
          <div className="access-denied">
            <div className="denied-icon">🔐</div>
            <h2>Admin Access Required</h2>
            <p>You don't have admin permissions to access this page.</p>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div className="admin-header">
          <h1>Admin Panel</h1>
          <p>Manage issuers and system settings</p>
        </div>

        {/* Stats */}
        <div className="admin-stats">
          <div className="stat-card">
            <div className="stat-icon">📜</div>
            <div className="stat-info">
              <span className="stat-value">{stats.totalCerts}</span>
              <span className="stat-label">Total Certificates</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">👤</div>
            <div className="stat-info">
              <span className="stat-value">{isAdmin ? '✓' : '✗'}</span>
              <span className="stat-label">Admin Status</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✍️</div>
            <div className="stat-info">
              <span className="stat-value">{isIssuer ? '✓' : '✗'}</span>
              <span className="stat-label">Issuer Status</span>
            </div>
          </div>
        </div>

        <div className="admin-sections">
          {/* Add Issuer */}
          <section className="admin-section">
            <h2>Add Issuer</h2>
            <p>Grant issuer permissions to an address</p>
            <form onSubmit={handleAddIssuer} className="admin-form">
              <div className="form-row">
                <input
                  type="text"
                  value={newIssuerAddress}
                  onChange={(e) => setNewIssuerAddress(e.target.value)}
                  placeholder="0x... address"
                  className="form-input"
                />
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={loading.add}
                >
                  {loading.add ? 'Adding...' : 'Add Issuer'}
                </button>
              </div>
            </form>
          </section>

          {/* Remove Issuer */}
          <section className="admin-section">
            <h2>Remove Issuer</h2>
            <p>Revoke issuer permissions from an address</p>
            <form onSubmit={handleRemoveIssuer} className="admin-form">
              <div className="form-row">
                <input
                  type="text"
                  value={removeIssuerAddress}
                  onChange={(e) => setRemoveIssuerAddress(e.target.value)}
                  placeholder="0x... address"
                  className="form-input"
                />
                <button 
                  type="submit" 
                  className="btn btn-danger"
                  disabled={loading.remove}
                >
                  {loading.remove ? 'Removing...' : 'Remove Issuer'}
                </button>
              </div>
            </form>
          </section>

          {/* Check Role */}
          <section className="admin-section">
            <h2>Check Role</h2>
            <p>Check if an address is an issuer or admin</p>
            <form onSubmit={handleCheckRole} className="admin-form">
              <div className="form-row">
                <input
                  type="text"
                  value={checkAddress}
                  onChange={(e) => setCheckAddress(e.target.value)}
                  placeholder="0x... address"
                  className="form-input"
                />
                <button 
                  type="submit" 
                  className="btn btn-secondary"
                  disabled={loading.check}
                >
                  {loading.check ? 'Checking...' : 'Check Role'}
                </button>
              </div>
            </form>
            
            {checkResult && (
              <div className="check-result">
                <div className="result-address">
                  {checkResult.address.slice(0, 10)}...{checkResult.address.slice(-8)}
                </div>
                <div className="result-roles">
                  <span className={`role-badge ${checkResult.isAdmin ? 'active' : ''}`}>
                    Admin: {checkResult.isAdmin ? '✓ Yes' : '✗ No'}
                  </span>
                  <span className={`role-badge ${checkResult.isIssuer ? 'active' : ''}`}>
                    Issuer: {checkResult.isIssuer ? '✓ Yes' : '✗ No'}
                  </span>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
