import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import CertificateCard from '../components/CertificateCard';
import toast from 'react-hot-toast';
import { getReadOnlyContract } from '../utils/readOnlyContract';
import {
  decodeBytes32Text,
  encodeVerificationCode
} from '../utils/certificateEncoding';
import {
  formatVerificationCode,
  normalizeVerificationCode
} from '../utils/verification';
import { getWeb3ErrorMessage } from '../utils/web3Errors';
import './Verify.css';

export default function Verify() {
  const navigate = useNavigate();
  const [verificationInput, setVerificationInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);

  const getCertificateStatus = (certificate, isValid) => {
    if (certificate.isRevoked) {
      return {
        key: 'revoked',
        title: 'Certificate Revoked',
        badge: 'Revoked',
        message: 'This certificate has been revoked and should no longer be accepted.'
      };
    }

    if (!isValid) {
      return {
        key: 'expired',
        title: 'Certificate Expired',
        badge: 'Expired',
        message: 'This certificate exists on-chain but has passed its expiry date.'
      };
    }

    return {
      key: 'valid',
      title: 'Certificate Valid',
      badge: 'Valid',
      message: 'This certificate is valid and verified on-chain.'
    };
  };

  const runVerification = async (rawValue, { shouldToast = true } = {}) => {
    const canonicalCode = normalizeVerificationCode(rawValue);

    if (!canonicalCode) {
      toast.error('Please enter a verification code');
      return;
    }

    setIsLoading(true);
    setResult(null);
    setVerificationInput(formatVerificationCode(canonicalCode));

    try {
      const contract = await getReadOnlyContract();
      const verificationCodeBytes = encodeVerificationCode(canonicalCode);
      const [contractIsValid, contractMessage, resolvedTokenId] = await contract.verifyCertificateByCode(verificationCodeBytes);

      if (!contractIsValid && contractMessage === 'Certificate does not exist') {
        setResult({ isValid: false, message: contractMessage });
        if (shouldToast) {
          toast.error('Certificate not found');
        }
        return;
      }

      const [certData, currentOwner] = await contract.getCertificateDetails(resolvedTokenId);
      const currentTimeInSeconds = Math.floor(Date.now() / 1000);
      const isExpiredLocally = Number(certData.expiryDate) > 0 && currentTimeInSeconds > Number(certData.expiryDate);

      let finalIsValid = contractIsValid;
      let finalMessage = contractMessage;

      if (isExpiredLocally && !certData.isRevoked) {
        finalIsValid = false;
        finalMessage = 'Certificate has expired';
      }

      const certificate = {
        tokenId: Number(resolvedTokenId),
        recipientName: decodeBytes32Text(certData.recipientName),
        courseName: decodeBytes32Text(certData.courseName),
        institutionName: decodeBytes32Text(certData.institutionName),
        issueDate: certData.issueDate,
        expiryDate: certData.expiryDate,
        recipientAddress: certData.recipientAddress,
        issuerAddress: certData.issuerAddress,
        isRevoked: certData.isRevoked,
        verificationCode: decodeBytes32Text(certData.verificationCode) || canonicalCode,
        currentOwner
      };

      const status = getCertificateStatus(certificate, finalIsValid);

      setResult({
        isValid: finalIsValid,
        status,
        message: finalMessage,
        certificate
      });

      if (shouldToast) {
        if (finalIsValid) {
          toast.success('Certificate verified successfully');
        } else {
          toast.error(finalMessage);
        }
      }
    } catch (error) {
      const errorMessage = getWeb3ErrorMessage(
        error,
        'Unable to verify the certificate right now'
      );

      console.error('Verification error:', {
        error,
        verificationCode: canonicalCode
      });
      setResult({ isValid: false, message: errorMessage });
      if (shouldToast) {
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await runVerification(verificationInput);
  };

  const handleCardClick = (certificate) => {
    navigate(`/certificate/${certificate.tokenId}`);
  };

  const renderVerifiedCard = (certificate) => {
    return (
      <CertificateCard
        certificate={certificate}
        onClick={() => handleCardClick(certificate)}
      />
    );
  };

  return (
    <div className="verify-page">
      <div className="verify-container">
        <div className="verify-header">
          <h1>Public Certificate Verifier</h1>
          <p>Enter the certificate verification code to confirm it on-chain.</p>
        </div>

        <form onSubmit={handleSubmit} className="verify-form">
          <div className="input-group">
            <input
              type="text"
              value={verificationInput}
              onChange={(e) => setVerificationInput(e.target.value)}
              placeholder="Enter verification code"
              className="verify-input"
              autoComplete="off"
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? 'Verifying...' : 'Verify'}
            </button>
          </div>
        </form>

        {isLoading && (
          <LoadingSpinner text="Verifying certificate on blockchain..." />
        )}

        {result && !isLoading && (
          <div className={`result-card ${result.certificate ? result.status.key : 'invalid'}`}>
            <div className="result-header">
              <span className={`result-icon ${result.certificate ? result.status.key : 'invalid'}`}>
                {result.certificate
                  ? result.status.key === 'valid'
                    ? '✓'
                    : result.status.key === 'expired'
                      ? '!'
                      : '✕'
                  : '✕'}
              </span>
              <div>
                <h2>{result.certificate ? result.status.title : 'Verification Failed'}</h2>
                {result.certificate && (
                  <p className="result-status-text">{result.status.message}</p>
                )}
              </div>
            </div>
            <p className="result-message">{result.message}</p>

            {result.certificate ? (
              <div className="verify-result-content">
                <div className="verify-code-pill">
                  Verification code: {formatVerificationCode(result.certificate.verificationCode)}
                </div>
                <div className="verify-result-card-wrap">
                  {renderVerifiedCard({
                    ...result.certificate,
                    isValid: result.status.key === 'valid'
                  })}
                </div>
                <p className="verify-result-hint">
                  Click the certificate card to open the full details page.
                </p>
              </div>
            ) : (
              <div className="verify-empty-state">
                No certificate matches that verification code.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
