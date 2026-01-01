import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWeb3 } from '../hooks/useWeb3';
import CertificateCard from '../components/CertificateCard';
import toast from 'react-hot-toast';
import './Gallery.css';

export default function Gallery() {
  const { contract, account } = useWeb3();
  const navigate = useNavigate();
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'owned', 'valid', 'revoked'
  const [totalCerts, setTotalCerts] = useState(0);

  const loadCertificates = useCallback(async () => {
    if (!contract) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const total = await contract.getTotalCertificates();
      setTotalCerts(Number(total));

      const certs = [];
      for (let i = 0; i < Number(total); i++) {
        try {
          const [certData, currentOwner] = await contract.getCertificateDetails(i);
          const [isValid] = await contract.verifyCertificate(i);
          
          certs.push({
            tokenId: i,
            recipientName: certData.recipientName,
            courseName: certData.courseName,
            institutionName: certData.institutionName,
            issueDate: certData.issueDate,
            expiryDate: certData.expiryDate,
            recipientAddress: certData.recipientAddress,
            issuerAddress: certData.issuerAddress,
            isRevoked: certData.isRevoked,
            ipfsHash: certData.ipfsHash,
            currentOwner: currentOwner,
            isValid: isValid
          });
        } catch (err) {
          console.error(`Error loading certificate ${i}:`, err);
        }
      }
      setCertificates(certs);
    } catch (error) {
      console.error('Error loading certificates:', error);
      toast.error('Failed to load certificates');
    } finally {
      setLoading(false);
    }
  }, [contract]);

  useEffect(() => {
    loadCertificates();
  }, [loadCertificates]);

  const filteredCertificates = certificates.filter(cert => {
    switch (filter) {
      case 'owned':
        return account && cert.currentOwner.toLowerCase() === account.toLowerCase();
      case 'valid':
        return cert.isValid && !cert.isRevoked;
      case 'revoked':
        return cert.isRevoked;
      default:
        return true;
    }
  });

  const handleCardClick = (cert) => {
    navigate(`/certificate/${cert.tokenId}`);
  };

  if (!contract) {
    return (
      <div className="gallery-page">
        <div className="gallery-container">
          <div className="connect-prompt">
            <div className="prompt-icon">🔗</div>
            <h2>Connect Your Wallet</h2>
            <p>Please connect your wallet to view certificates</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gallery-page">
      <div className="gallery-container">
        <div className="gallery-header">
          <div className="header-content">
            <h1>Certificate Gallery</h1>
            <p>Browse all certificates issued on the blockchain</p>
          </div>
          <div className="header-stats">
            <div className="stat">
              <span className="stat-value">{totalCerts}</span>
              <span className="stat-label">Total Certificates</span>
            </div>
          </div>
        </div>

        <div className="gallery-filters">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({certificates.length})
          </button>
          <button 
            className={`filter-btn ${filter === 'owned' ? 'active' : ''}`}
            onClick={() => setFilter('owned')}
          >
            My Certificates ({certificates.filter(c => account && c.currentOwner.toLowerCase() === account.toLowerCase()).length})
          </button>
          <button 
            className={`filter-btn ${filter === 'valid' ? 'active' : ''}`}
            onClick={() => setFilter('valid')}
          >
            Valid ({certificates.filter(c => c.isValid && !c.isRevoked).length})
          </button>
          <button 
            className={`filter-btn ${filter === 'revoked' ? 'active' : ''}`}
            onClick={() => setFilter('revoked')}
          >
            Revoked ({certificates.filter(c => c.isRevoked).length})
          </button>
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="spinner-large"></div>
            <p>Loading certificates...</p>
          </div>
        ) : filteredCertificates.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📜</div>
            <h3>No Certificates Found</h3>
            <p>
              {filter === 'owned' 
                ? "You don't own any certificates yet" 
                : "No certificates match the current filter"}
            </p>
          </div>
        ) : (
          <div className="certificates-grid">
            {filteredCertificates.map((cert) => (
              <CertificateCard 
                key={cert.tokenId} 
                certificate={cert} 
                onClick={() => handleCardClick(cert)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
