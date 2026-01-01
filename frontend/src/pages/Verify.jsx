import { useState } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';
import './Verify.css';

export default function Verify() {
  const { contract } = useWeb3();
  const [tokenId, setTokenId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleVerify = async (e) => {
    e.preventDefault();
    
    if (!tokenId.trim()) {
      toast.error('Please enter a certificate ID');
      return;
    }

    if (!contract) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const [isValid, message] = await contract.verifyCertificate(tokenId);
      
      if (isValid) {
        const [certData, currentOwner] = await contract.getCertificateDetails(tokenId);
        setResult({
          isValid: true,
          message,
          certificate: {
            tokenId,
            recipientName: certData.recipientName,
            courseName: certData.courseName,
            institutionName: certData.institutionName,
            issueDate: certData.issueDate,
            expiryDate: certData.expiryDate,
            recipientAddress: certData.recipientAddress,
            issuerAddress: certData.issuerAddress,
            ipfsHash: certData.ipfsHash,
            currentOwner
          }
        });
        toast.success('Certificate verified successfully!');
      } else {
        setResult({ isValid: false, message });
        toast.error(message);
      }
    } catch (error) {
      console.error('Verification error:', error);
      if (error.message.includes('Certificate does not exist')) {
        setResult({ isValid: false, message: 'Certificate does not exist' });
        toast.error('Certificate not found');
      } else {
        toast.error('Error verifying certificate');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp || timestamp === 0n) return 'No Expiry';
    return new Date(Number(timestamp) * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatAddress = (addr) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="verify-page">
      <div className="verify-container">
        <div className="verify-header">
          <h1>Verify Certificate</h1>
          <p>Enter the certificate ID to verify its authenticity on the blockchain</p>
        </div>

        <form onSubmit={handleVerify} className="verify-form">
          <div className="input-group">
            <input
              type="number"
              value={tokenId}
              onChange={(e) => setTokenId(e.target.value)}
              placeholder="Enter Certificate ID (e.g., 0, 1, 2...)"
              className="verify-input"
              min="0"
            />
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isLoading || !contract}
            >
              {isLoading ? 'Verifying...' : 'Verify'}
            </button>
          </div>
        </form>

        {isLoading && (
          <LoadingSpinner text="Verifying certificate on blockchain..." />
        )}

        {result && !isLoading && (
          <div className={`result-card ${result.isValid ? 'valid' : 'invalid'}`}>
            <div className="result-header">
              <span className={`result-icon ${result.isValid ? 'valid' : 'invalid'}`}>
                {result.isValid ? '✓' : '✕'}
              </span>
              <h2>{result.isValid ? 'Certificate is Valid' : 'Verification Failed'}</h2>
            </div>
            <p className="result-message">{result.message}</p>

            {result.certificate && (
              <div className="certificate-details">
                <div className="detail-row">
                  <span className="detail-label">Certificate ID</span>
                  <span className="detail-value">#{result.certificate.tokenId}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Recipient Name</span>
                  <span className="detail-value">{result.certificate.recipientName}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Course/Achievement</span>
                  <span className="detail-value">{result.certificate.courseName}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Institution</span>
                  <span className="detail-value">{result.certificate.institutionName}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Issue Date</span>
                  <span className="detail-value">{formatDate(result.certificate.issueDate)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Expiry Date</span>
                  <span className="detail-value">{formatDate(result.certificate.expiryDate)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Recipient Address</span>
                  <span className="detail-value mono">{formatAddress(result.certificate.recipientAddress)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Issuer Address</span>
                  <span className="detail-value mono">{formatAddress(result.certificate.issuerAddress)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Current Owner</span>
                  <span className="detail-value mono">{formatAddress(result.certificate.currentOwner)}</span>
                </div>
                {result.certificate.ipfsHash && (
                  <div className="detail-row">
                    <span className="detail-label">IPFS Hash</span>
                    <span className="detail-value mono">{result.certificate.ipfsHash}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
