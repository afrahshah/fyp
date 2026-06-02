import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWeb3 } from '../hooks/useWeb3';
import { getReadOnlyContract } from '../utils/readOnlyContract';
import CertificateSharePanel from '../components/CertificateSharePanel';
import toast from 'react-hot-toast';
import { decodeBytes32Text } from '../utils/certificateEncoding';
import { getWeb3ErrorMessage } from '../utils/web3Errors';
import './CertificateDetail.css';

export default function CertificateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { contract, account, isAdmin } = useWeb3();
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);

  const loadCertificate = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const activeContract = contract ?? await getReadOnlyContract();
      const [certData, currentOwner] = await activeContract.getCertificateDetails(id);
      const [contractIsValid, contractMessage] = await activeContract.verifyCertificate(id);

      // Frontend Time Check for Expiry
      const currentTimeInSeconds = Math.floor(Date.now() / 1000);
      const isExpiredLocally = Number(certData.expiryDate) > 0 && currentTimeInSeconds > Number(certData.expiryDate);


      // Override the blockchain's frozen clock if necessary
      let finalIsValid = contractIsValid;
      let finalMessage = contractMessage;

      if (isExpiredLocally && !certData.isRevoked) {
        finalIsValid = false;
        finalMessage = "Certificate has expired"; 
      }

      setCertificate({
        tokenId: id,
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
        statusMessage: finalMessage
      });
    } catch (error) {
      console.error('Error loading certificate:', error);
      toast.error(getWeb3ErrorMessage(error, 'Certificate not found'));
      navigate('/gallery');
    } finally {
      setLoading(false);
    }
  }, [contract, id, navigate]);

  useEffect(() => {
    loadCertificate();
  }, [loadCertificate]);

  const handleRevoke = async () => {
    if (!contract) {
      toast.error('Connect an authorized wallet to revoke this certificate');
      return;
    }

    if (!window.confirm('Are you sure you want to revoke this certificate? This action cannot be undone.')) {
      return;
    }

    setRevoking(true);
    try {
      const tx = await contract.revokeCertificate(id);
      toast.loading('Revoking certificate...', { id: 'revoke' });
      await tx.wait();
      toast.success('Certificate revoked successfully', { id: 'revoke' });
      loadCertificate();
    } catch (error) {
      console.error('Error revoking:', error);
      toast.error(
        getWeb3ErrorMessage(error, 'Failed to revoke certificate'),
        { id: 'revoke' }
      );
    } finally {
      setRevoking(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp || timestamp === 0n) return 'No Expiry';
    return new Date(Number(timestamp) * 1000).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const canRevoke = () => {
    if (!certificate || !account) return false;
    if (certificate.isRevoked) return false;
    return (
      isAdmin || 
      certificate.issuerAddress.toLowerCase() === account.toLowerCase()
    );
  };

  if (loading) {
    return (
      <div className="detail-page">
        <div className="detail-container">
          <div className="loading-state">
            <div className="spinner-large"></div>
            <p>Loading certificate...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!certificate) {
    return (
      <div className="detail-page">
        <div className="detail-container">
          <div className="not-found">
            <div className="not-found-icon">❌</div>
            <h2>Certificate Not Found</h2>
            <p>The certificate you're looking for doesn't exist.</p>
            <button onClick={() => navigate('/gallery')} className="btn btn-primary">
              Back to Gallery
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="detail-page">
      <div className="detail-container">
        <button onClick={() => navigate(-1)} className="back-btn">
          ← Back
        </button>

        <div className="certificate-display">
          {/* Certificate Card */}
          <div className={`cert-card ${certificate.isRevoked ? 'revoked' : certificate.isValid ? 'valid' : 'expired'}`}>
            <div className="cert-header">
              <span className="cert-id">Certificate #{certificate.tokenId}</span>
              <span className={`status-badge ${certificate.isRevoked ? 'revoked' : certificate.isValid ? 'valid' : 'expired'}`}>
                {certificate.isRevoked ? '🚫 Revoked' : certificate.isValid ? '✓ Valid' : '⚠️ Expired'}
              </span>
            </div>

            <div className="cert-body">
              <div className="cert-icon">🎓</div>
              <h1 className="cert-title">{certificate.courseName}</h1>
              <p className="cert-subtitle">Certificate of Completion</p>
              
              <div className="cert-recipient">
                <span className="label">Awarded to</span>
                <h2 className="name">{certificate.recipientName}</h2>
              </div>

              <div className="cert-institution">
                <span className="label">Issued by</span>
                <h3 className="name">{certificate.institutionName}</h3>
              </div>

              <div className="cert-date">
                <span className="label">Issue Date</span>
                <span className="date">{formatDate(certificate.issueDate)}</span>
              </div>
            </div>

            <div className="cert-footer">
              <div className="blockchain-badge">
                <span className="icon">⛓️</span>
                <span>Verified on Blockchain</span>
              </div>
            </div>
          </div>

          {/* Details Panel */}
          <div className="details-panel">
            <h2>Certificate Details</h2>
            
            <div className="detail-group">
              <h3>Blockchain Information</h3>
              <div className="detail-item">
                <span className="label">Token ID</span>
                <span className="value">#{certificate.tokenId}</span>
              </div>
              <div className="detail-item">
                <span className="label">Status</span>
                <span className={`value status ${certificate.isRevoked ? 'revoked' : certificate.isValid ? 'valid' : 'expired'}`}>
                  {certificate.statusMessage}
                </span>
              </div>
            </div>

            <div className="detail-group">
              <h3>Addresses</h3>
              <div className="detail-item">
                <span className="label">Recipient Address</span>
                <span className="value address" title={certificate.recipientAddress}>
                  {formatAddress(certificate.recipientAddress)}
                  <button 
                    className="copy-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(certificate.recipientAddress);
                      toast.success('Address copied!');
                    }}
                  >
                    📋
                  </button>
                </span>
              </div>
              <div className="detail-item">
                <span className="label">Current Owner</span>
                <span className="value address" title={certificate.currentOwner}>
                  {formatAddress(certificate.currentOwner)}
                  <button 
                    className="copy-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(certificate.currentOwner);
                      toast.success('Address copied!');
                    }}
                  >
                    📋
                  </button>
                </span>
              </div>
              <div className="detail-item">
                <span className="label">Issuer Address</span>
                <span className="value address" title={certificate.issuerAddress}>
                  {formatAddress(certificate.issuerAddress)}
                  <button 
                    className="copy-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(certificate.issuerAddress);
                      toast.success('Address copied!');
                    }}
                  >
                    📋
                  </button>
                </span>
              </div>
            </div>

            <div className="detail-group">
              <h3>Dates</h3>
              <div className="detail-item">
                <span className="label">Issue Date</span>
                <span className="value">{formatDate(certificate.issueDate)}</span>
              </div>
              <div className="detail-item">
                <span className="label">Expiry Date</span>
                <span className="value">{formatDate(certificate.expiryDate)}</span>
              </div>
            </div>

            {certificate.verificationCode && (
              <CertificateSharePanel
                tokenId={certificate.tokenId}
                verificationCode={certificate.verificationCode}
                title="Public Verification Code"
                subtitle="Use this verification code in the public verifier to validate the certificate without MetaMask."
              />
            )}

            {/* Actions */}
            {canRevoke() && (
              <div className="actions">
                <button 
                  onClick={handleRevoke}
                  className="btn btn-danger"
                  disabled={revoking}
                >
                  {revoking ? 'Revoking...' : '🚫 Revoke Certificate'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
