import toast from 'react-hot-toast';
import {
  formatVerificationCode,
  normalizeVerificationCode
} from '../utils/verification';
import './CertificateSharePanel.css';

export default function CertificateSharePanel({
  tokenId,
  verificationCode,
  title = 'Verification Code',
  subtitle = 'Use this verification code in the public verifier to confirm the certificate without connecting a wallet.'
}) {
  const canonicalCode = normalizeVerificationCode(verificationCode);
  const formattedCode = formatVerificationCode(canonicalCode);

  const copyText = async (value, successMessage) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch (error) {
      console.error('Copy failed:', error);
      toast.error('Unable to copy right now');
    }
  };

  return (
    <div className="share-panel">
      <div className="share-panel-header">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        {typeof tokenId !== 'undefined' && tokenId !== null && (
          <span className="share-token-pill">Certificate #{tokenId}</span>
        )}
      </div>

      <div className="share-panel-fields">
        <div className="share-field">
          <span className="share-label">Verification Code</span>
          <div className="share-value-box">
            <span className="share-value-code">{formattedCode}</span>
            <button
              type="button"
              className="share-copy-btn"
              onClick={() => copyText(canonicalCode, 'Verification code copied')}
            >
              Copy code
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
