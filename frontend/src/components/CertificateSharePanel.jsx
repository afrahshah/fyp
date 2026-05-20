import toast from 'react-hot-toast';
import {
  buildShareLink,
  formatVerificationCode,
  normalizeVerificationCode
} from '../utils/verification';
import './CertificateSharePanel.css';

export default function CertificateSharePanel({
  tokenId,
  verificationCode,
  title = 'Share Verification',
  subtitle = 'Anyone with this code, link, or QR can verify this certificate without connecting a wallet.'
}) {
  const canonicalCode = normalizeVerificationCode(verificationCode);
  const formattedCode = formatVerificationCode(canonicalCode);
  const shareLink = buildShareLink(canonicalCode);
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=176x176&data=${encodeURIComponent(shareLink)}`;

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

      <div className="share-panel-grid">
        <div className="share-panel-qr">
          <div className="share-qr-frame">
            <img
              src={qrImageUrl}
              alt={`QR code for certificate ${tokenId ?? ''}`}
              width="176"
              height="176"
              className="share-qr-image"
            />
          </div>
          <span className="share-qr-caption">QR opens the public verifier link</span>
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

          <div className="share-field">
            <span className="share-label">Share Link</span>
            <div className="share-value-box share-link-box">
              <span className="share-value-link">{shareLink}</span>
              <button
                type="button"
                className="share-copy-btn"
                onClick={() => copyText(shareLink, 'Share link copied')}
              >
                Copy link
              </button>
            </div>
          </div>

          <a href={shareLink} className="share-open-link">
            Open public verifier
          </a>
        </div>
      </div>
    </div>
  );
}
