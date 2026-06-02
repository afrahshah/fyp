
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWeb3 } from '../hooks/useWeb3';
import CertificateCard from '../components/CertificateCard';
import toast from 'react-hot-toast';
import { decodeBytes32Text } from '../utils/certificateEncoding';
import './Gallery.css';

export default function Gallery() {
  const { contract, account, isIssuer, isAdmin } = useWeb3();
  const navigate = useNavigate();
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [totalCerts, setTotalCerts] = useState(0);

  const galleryMode = isAdmin ? 'admin' : isIssuer ? 'issuer' : 'student';

  const loadCertificates = useCallback(async () => {
    if (!contract || !account) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let certificateIds = [];

      if (galleryMode === 'admin') {
        const total = await contract.getTotalCertificates();
        certificateIds = Array.from({ length: Number(total) }, (_, index) => index);
        setTotalCerts(Number(total));
      } else if (galleryMode === 'issuer') {
        const issuedIds = await contract.getCertificatesByIssuer(account);
        certificateIds = issuedIds.map((id) => Number(id));
        setTotalCerts(certificateIds.length);
      } else {
        const recipientIds = await contract.getCertificatesByRecipient(account);
        certificateIds = recipientIds.map((id) => Number(id));
        setTotalCerts(certificateIds.length);
      }

      const certs = [];
      for (const tokenId of certificateIds) {
        try {
          const [certData, currentOwner] = await contract.getCertificateDetails(tokenId);
          const [contractIsValid] = await contract.verifyCertificate(tokenId);

          // Frontend Time Check for Expiry
          const currentTimeInSeconds = Math.floor(Date.now() / 1000);
          const isExpiredLocally = Number(certData.expiryDate) > 0 && currentTimeInSeconds > Number(certData.expiryDate);
          const finalIsValid = contractIsValid && !isExpiredLocally;
          
          certs.push({
            tokenId,
            recipientName: decodeBytes32Text(certData.recipientName),
            courseName: decodeBytes32Text(certData.courseName),
            institutionName: decodeBytes32Text(certData.institutionName),
            issueDate: certData.issueDate,
            expiryDate: certData.expiryDate,
            recipientAddress: certData.recipientAddress,
            issuerAddress: certData.issuerAddress,
            isRevoked: certData.isRevoked,
            verificationCode: decodeBytes32Text(certData.verificationCode),
            currentOwner: currentOwner,
            isValid: finalIsValid,
            isExpired: isExpiredLocally
          });
        } catch (err) {
          console.error(`Error loading certificate ${tokenId}:`, err);
        }
      }
      setCertificates(certs);
    } catch (error) {
      console.error('Error loading certificates:', error);
      toast.error('Failed to load certificates');
    } finally {
      setLoading(false);
    }
  }, [account, contract, galleryMode]);

  useEffect(() => {
    loadCertificates();
  }, [loadCertificates]);

  useEffect(() => {
    setFilter(galleryMode === 'student' ? 'owned' : 'all');
  }, [galleryMode]);

  const getFilterOptions = () => {
    if (galleryMode === 'student') {
      return [
        { key: 'owned', label: 'My Certificates', count: certificates.length },
        { key: 'valid', label: 'Valid', count: certificates.filter(c => c.isValid && !c.isRevoked && !c.isExpired).length },
        { key: 'expired', label: 'Expired', count: certificates.filter(c => c.isExpired && !c.isRevoked).length },
        { key: 'revoked', label: 'Revoked', count: certificates.filter(c => c.isRevoked).length }
      ];
    }

    if (galleryMode === 'issuer') {
      return [
        { key: 'all', label: 'All', count: certificates.length },
        { key: 'valid', label: 'Valid', count: certificates.filter(c => c.isValid && !c.isRevoked && !c.isExpired).length },
        { key: 'expired', label: 'Expired', count: certificates.filter(c => c.isExpired && !c.isRevoked).length },
        { key: 'revoked', label: 'Revoked', count: certificates.filter(c => c.isRevoked).length }
      ];
    }

    return [
      { key: 'all', label: 'All', count: certificates.length },
      { key: 'owned', label: 'My Certificates', count: certificates.filter(c => account && c.currentOwner.toLowerCase() === account.toLowerCase()).length },
      { key: 'valid', label: 'Valid', count: certificates.filter(c => c.isValid && !c.isRevoked && !c.isExpired).length },
      { key: 'expired', label: 'Expired', count: certificates.filter(c => c.isExpired && !c.isRevoked).length },
      { key: 'revoked', label: 'Revoked', count: certificates.filter(c => c.isRevoked).length }
    ];
  };

  const getHeaderCopy = () => {
    if (galleryMode === 'student') {
      return {
        title: 'My Certificate Gallery',
        description: 'View certificates issued to your wallet',
        statLabel: 'Your Certificates'
      };
    }

    if (galleryMode === 'issuer') {
      return {
        title: 'Issued Certificate Gallery',
        description: 'View certificates you have issued',
        statLabel: 'Issued By You'
      };
    }

    return {
      title: 'Certificate Gallery',
      description: 'Browse all certificates issued on the blockchain',
      statLabel: 'Total Certificates'
    };
  };

  const filteredCertificates = certificates.filter(cert => {
    switch (filter) {
      case 'owned':
        if (galleryMode === 'student') {
          return true;
        }
        return account && cert.currentOwner.toLowerCase() === account.toLowerCase();
      case 'valid':
        // Must be valid, NOT revoked, and NOT expired
        return cert.isValid && !cert.isRevoked && !cert.isExpired;
      case 'revoked':
        return cert.isRevoked;
      case 'expired':
        return cert.isExpired && !cert.isRevoked;
      default:
        return true;
    }
  });

  const handleCardClick = (cert) => {
    navigate(`/certificate/${cert.tokenId}`);
  };

  const headerCopy = getHeaderCopy();
  const filterOptions = getFilterOptions();

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
            <h1>{headerCopy.title}</h1>
            <p>{headerCopy.description}</p>
          </div>
          <div className="header-stats">
            <div className="stat">
              <span className="stat-value">{totalCerts}</span>
              <span className="stat-label">{headerCopy.statLabel}</span>
            </div>
          </div>
        </div>

        <div className="gallery-filters">
          {filterOptions.map((option) => (
            <button
              key={option.key}
              className={`filter-btn ${filter === option.key ? 'active' : ''}`}
              onClick={() => setFilter(option.key)}
            >
              {option.label} ({option.count})
            </button>
          ))}
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
              {galleryMode === 'student' && filter === 'owned'
                ? "No certificates have been issued to your wallet yet"
                : galleryMode === 'issuer' && filter === 'all'
                  ? "You haven't issued any certificates yet"
                  : "No certificates match the current filter"}
            </p>
          </div>
        ) : (
         <div className="certificates-grid">
            {filteredCertificates.map((cert) => {
              return (
                <div key={cert.tokenId} className="gallery-item-wrapper">
                  <CertificateCard
                    certificate={cert}
                    onClick={() => handleCardClick(cert)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
