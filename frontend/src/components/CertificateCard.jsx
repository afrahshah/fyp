import './CertificateCard.css';

export default function CertificateCard({ certificate, onClick }) {
  const {
    tokenId,
    recipientName,
    courseName,
    institutionName,
    issueDate,
    expiryDate,
    isRevoked,
    isValid
  } = certificate;

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

  const getStatusClass = () => {
    if (isRevoked) return 'revoked';
    if (isValid === false) return 'expired';
    return 'valid';
  };

  const getStatusText = () => {
    if (isRevoked) return 'Revoked';
    if (isValid === false) return 'Expired';
    return 'Valid';
  };

  return (
    <div className={`certificate-card ${getStatusClass()}`} onClick={onClick}>
      <div className="card-header">
        <span className="card-id">#{tokenId?.toString()}</span>
        <span className={`status-badge ${getStatusClass()}`}>
          {getStatusText()}
        </span>
      </div>
      
      <div className="card-body">
        <div className="cert-icon">🎓</div>
        <h3 className="course-name">{courseName}</h3>
        <p className="institution-name">{institutionName}</p>
        <div className="recipient-info">
          <span className="label">Awarded to</span>
          <span className="recipient-name">{recipientName}</span>
        </div>
      </div>
      
      <div className="card-footer">
        <div className="date-info">
          <span className="label">Issued</span>
          <span className="date">{formatDate(issueDate)}</span>
        </div>
        {expiryDate && expiryDate !== 0n && (
          <div className="date-info">
            <span className="label">Expires</span>
            <span className="date">{formatDate(expiryDate)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
