import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import CertificateSharePanel from '../components/CertificateSharePanel';
import toast from 'react-hot-toast';
import { getReadOnlyContract } from '../utils/readOnlyContract';
import {
  buildShareLink,
  formatVerificationCode,
  normalizeVerificationCode
} from '../utils/verification';
import './Verify.css';

export default function Verify() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [verificationInput, setVerificationInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const lastAutoVerifiedRef = useRef('');

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

  const runVerification = async (rawValue, { shouldSyncUrl = true, shouldToast = true } = {}) => {
    const canonicalCode = normalizeVerificationCode(rawValue);

    if (!canonicalCode) {
      toast.error('Please enter a verification code or share link');
      return;
    }

    setIsLoading(true);
    setResult(null);
    setVerificationInput(formatVerificationCode(canonicalCode));
    lastAutoVerifiedRef.current = canonicalCode;

    if (shouldSyncUrl) {
      setSearchParams({ code: canonicalCode }, { replace: true });
    }

    try {
      const contract = getReadOnlyContract();
      const [contractIsValid, contractMessage, resolvedTokenId] = await contract.verifyCertificateByCode(canonicalCode);

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
        recipientName: certData.recipientName,
        courseName: certData.courseName,
        institutionName: certData.institutionName,
        issueDate: certData.issueDate,
        expiryDate: certData.expiryDate,
        recipientAddress: certData.recipientAddress,
        issuerAddress: certData.issuerAddress,
        ipfsHash: certData.ipfsHash,
        verificationCode: certData.verificationCode || canonicalCode,
        currentOwner,
        shareLink: buildShareLink(certData.verificationCode || canonicalCode)
      };

      setResult({
        isValid: finalIsValid,
        message: finalIsValid ? 'Certificate is Valid' : finalMessage,
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
      console.error('Verification error:', error);
      setResult({ isValid: false, message: 'Error verifying certificate' });
      if (shouldToast) {
        toast.error('Error verifying certificate');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const codeFromUrl = normalizeVerificationCode(searchParams.get('code') || '');

    if (!codeFromUrl || lastAutoVerifiedRef.current === codeFromUrl) {
      return undefined;
    }

    lastAutoVerifiedRef.current = codeFromUrl;
    runVerification(codeFromUrl, { shouldSyncUrl: false, shouldToast: false });

    return undefined;
  }, [searchParams]);

  useEffect(() => {
    if (!scannerOpen) {
      setScannerError('');
      return undefined;
    }

    let cancelled = false;

    const stopScanner = () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    const scanFrame = async (detector) => {
      if (cancelled || !videoRef.current) {
        return;
      }

      try {
        const barcodes = await detector.detect(videoRef.current);

        if (barcodes.length > 0 && barcodes[0].rawValue) {
          const decodedText = barcodes[0].rawValue;
          stopScanner();
          setScannerOpen(false);
          setVerificationInput(decodedText);
          runVerification(decodedText);
          return;
        }
      } catch (error) {
        console.error('Scanner detect error:', error);
      }

      frameRef.current = requestAnimationFrame(() => {
        scanFrame(detector);
      });
    };

    const startScanner = async () => {
      if (!('BarcodeDetector' in window)) {
        setScannerError('QR scanning is not supported in this browser. Paste the share link or verification code instead.');
        setScannerOpen(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        });

        if (cancelled || !videoRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        scanFrame(detector);
      } catch (error) {
        console.error('Scanner start error:', error);
        setScannerError('Camera access failed. Paste the share link or code instead.');
        setScannerOpen(false);
        stopScanner();
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [scannerOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await runVerification(verificationInput);
  };

  return (
    <div className="verify-page">
      <div className="verify-container">
        <div className="verify-header">
          <h1>Public Certificate Verifier</h1>
          <p>Scan the QR, paste the share link, or enter the certificate verification code.</p>
        </div>

        <form onSubmit={handleSubmit} className="verify-form">
          <div className="input-group">
            <input
              type="text"
              value={verificationInput}
              onChange={(e) => setVerificationInput(e.target.value)}
              placeholder="Paste share link or enter verification code"
              className="verify-input"
              autoComplete="off"
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScannerOpen((open) => !open)}
            >
              {scannerOpen ? 'Close Scanner' : 'Scan QR'}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? 'Verifying...' : 'Verify'}
            </button>
          </div>
        </form>

        {scannerOpen && (
          <div className="scanner-card">
            <div className="scanner-header">
              <h2>Scan QR Code</h2>
              <p>Point your camera at the certificate QR to open its public verifier link.</p>
            </div>
            <video ref={videoRef} className="scanner-reader" muted playsInline />
            <p className="scanner-support-text">If scanning does not start, paste the share link or code manually below.</p>
          </div>
        )}

        {scannerError && (
          <div className="scanner-error">
            {scannerError}
          </div>
        )}

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

            {result.certificate ? (
              <>
                <div className="certificate-details">
                  <div className="detail-row">
                    <span className="detail-label">Verification Code</span>
                    <span className="detail-value mono">{formatVerificationCode(result.certificate.verificationCode)}</span>
                  </div>
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

                <CertificateSharePanel
                  tokenId={result.certificate.tokenId}
                  verificationCode={result.certificate.verificationCode}
                  title="Share This Verification"
                  subtitle="Reuse this same public link or QR any time you need to prove the certificate again."
                />
              </>
            ) : (
              <div className="verify-empty-state">
                No certificate matches that share link or verification code.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
