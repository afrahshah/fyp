import { useState } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import toast from 'react-hot-toast';
import CertificateSharePanel from '../components/CertificateSharePanel';
import { generateVerificationCode } from '../utils/verification';
import './Issue.css';

const DEFAULT_EXPIRY_TIME = '23:59';

const TIME_OPTIONS = [
  { value: DEFAULT_EXPIRY_TIME, label: '11:59 PM (End of day)' },
  ...Array.from({ length: 48 }, (_, index) => {
    const hours = Math.floor(index / 2);
    const minutes = index % 2 === 0 ? '00' : '30';
    const value = `${hours.toString().padStart(2, '0')}:${minutes}`;
    const hour12 = hours % 12 || 12;
    const meridiem = hours < 12 ? 'AM' : 'PM';

    return {
      value,
      label: `${hour12.toString().padStart(2, '0')}:${minutes} ${meridiem}`
    };
  }).filter((option) => option.value !== DEFAULT_EXPIRY_TIME)
];

export default function Issue() {
  const { contract, account, isIssuer } = useWeb3();
  const [isLoading, setIsLoading] = useState(false);
  const [issuedCertificate, setIssuedCertificate] = useState(null);
  const [formData, setFormData] = useState({
    recipientAddress: '',
    recipientName: '',
    courseName: '',
    institutionName: '',
    expiryDate: '',
    expiryTime: '',
    ipfsHash: '',
    metadataURI: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      if (name === 'expiryDate') {
        return {
          ...prev,
          expiryDate: value,
          expiryTime: value ? (prev.expiryTime || DEFAULT_EXPIRY_TIME) : ''
        };
      }

      return { ...prev, [name]: value };
    });
  };

  const parseExpiryTimestamp = (expiryDate, expiryTime) => {
    if (!expiryDate) {
      return 0;
    }

    if (!expiryTime) {
      return null;
    }

    const parsedDate = new Date(`${expiryDate}T${expiryTime}`);
    const parsedTime = parsedDate.getTime();

    if (Number.isNaN(parsedTime)) {
      return null;
    }

    return Math.floor(parsedTime / 1000);
  };

  const getExpiryPreview = () => {
    const expiryTimestamp = parseExpiryTimestamp(formData.expiryDate, formData.expiryTime);

    if (!formData.expiryDate || expiryTimestamp === 0 || expiryTimestamp === null) {
      return '';
    }

    return new Date(expiryTimestamp * 1000).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!contract) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!isIssuer) {
      toast.error('You are not authorized to issue certificates');
      return;
    }

    if (!formData.recipientAddress || !formData.recipientName || 
        !formData.courseName || !formData.institutionName) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsLoading(true);

    try {
      const verificationCode = generateVerificationCode();
      const expiryTimestamp = parseExpiryTimestamp(formData.expiryDate, formData.expiryTime);

      if (expiryTimestamp === null) {
        toast.error('Please choose both an expiry date and time');
        return;
      }

      const tx = await contract.issueCertificate(
        formData.recipientAddress,
        formData.recipientName,
        formData.courseName,
        formData.institutionName,
        expiryTimestamp,
        formData.ipfsHash || '',
        verificationCode,
        formData.metadataURI || ''
      );

      toast.loading('Transaction submitted...', { id: 'issue' });
      const receipt = await tx.wait();
      const issuedEvent = receipt.logs
        .map((log) => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsedLog) => parsedLog?.name === 'CertificateIssued');

      toast.success('Certificate issued successfully!', { id: 'issue' });
      setIssuedCertificate({
        tokenId: issuedEvent ? Number(issuedEvent.args.tokenId) : null,
        verificationCode
      });

      setFormData({
        recipientAddress: '',
        recipientName: '',
        courseName: '',
        institutionName: '',
        expiryDate: '',
        expiryTime: '',
        ipfsHash: '',
        metadataURI: ''
      });

    } catch (error) {
      console.error('Issue error:', error);
      toast.error(error.reason || 'Failed to issue certificate', { id: 'issue' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!account) {
    return (
      <div className="issue-page">
        <div className="issue-container">
          <div className="not-connected">
            <span className="icon">🔗</span>
            <h2>Wallet Not Connected</h2>
            <p>Please connect your wallet to issue certificates</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isIssuer) {
    return (
      <div className="issue-page">
        <div className="issue-container">
          <div className="not-authorized">
            <span className="icon">🚫</span>
            <h2>Not Authorized</h2>
            <p>Only authorized issuers can issue certificates.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="issue-page">
      <div className="issue-container">
        <div className="issue-header">
          <h1>Issue Certificate</h1>
          <p>Create a new blockchain-verified certificate NFT</p>
        </div>

        <form onSubmit={handleSubmit} className="issue-form">
          <div className="form-section">
            <h3>Recipient Information</h3>
            <div className="form-group">
              <label htmlFor="recipientAddress">Recipient Wallet Address *</label>
              <input type="text" id="recipientAddress" name="recipientAddress" value={formData.recipientAddress} onChange={handleChange} placeholder="0x..." required />
            </div>
            <div className="form-group">
              <label htmlFor="recipientName">Recipient Full Name *</label>
              <input type="text" id="recipientName" name="recipientName" value={formData.recipientName} onChange={handleChange} placeholder="John Doe" required />
            </div>
          </div>

          <div className="form-section">
            <h3>Certificate Details</h3>
            <div className="form-group">
              <label htmlFor="courseName">Course / Achievement *</label>
              <input type="text" id="courseName" name="courseName" value={formData.courseName} onChange={handleChange} placeholder="Blockchain Development" required />
            </div>
            <div className="form-group">
              <label htmlFor="institutionName">Institution *</label>
              <input type="text" id="institutionName" name="institutionName" value={formData.institutionName} onChange={handleChange} placeholder="Tech University" required />
            </div>
            <div className="form-group">
              <label htmlFor="expiryDate">Expiry (Optional)</label>
              <div className="expiry-inputs">
                <div className="expiry-field">
                  <input
                    type="date"
                    id="expiryDate"
                    name="expiryDate"
                    value={formData.expiryDate}
                    onChange={handleChange}
                  />
                  <span className="hint">Pick the expiry date. Leave blank if the certificate should never expire.</span>
                </div>
                <div className="expiry-field">
                  <select
                    id="expiryTime"
                    name="expiryTime"
                    value={formData.expiryTime}
                    onChange={handleChange}
                    disabled={!formData.expiryDate}
                  >
                    <option value="">Choose time</option>
                    {TIME_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="hint">Choose the exact time on that date.</span>
                </div>
              </div>
              {getExpiryPreview() && (
                <span className="expiry-preview">Expires on {getExpiryPreview()}</span>
              )}
            </div>
          </div>

          <div className="form-section">
            <h3>Additional Data (Optional)</h3>
            <div className="form-group">
              <label htmlFor="ipfsHash">IPFS Hash</label>
              <input type="text" id="ipfsHash" name="ipfsHash" value={formData.ipfsHash} onChange={handleChange} placeholder="QmXxx..." />
            </div>
            {/* hiding the metadatUri option as we aren't converting our data into it first */}
            {/* <div className="form-group">
              <label htmlFor="metadataURI">Metadata URI</label>
              <input type="text" id="metadataURI" name="metadataURI" value={formData.metadataURI} onChange={handleChange} placeholder="ipfs://..." />
            </div> 
            */}
          </div>

          <button type="submit" className="btn btn-primary btn-submit" disabled={isLoading}>
            {isLoading ? 'Issuing...' : 'Issue Certificate'}
          </button>
        </form>

        {issuedCertificate && (
          <CertificateSharePanel
            tokenId={issuedCertificate.tokenId}
            verificationCode={issuedCertificate.verificationCode}
            title="Certificate Issued"
            subtitle="Share this verifier link, code, or QR with anyone who needs to validate the certificate."
          />
        )}
      </div>
    </div>
  );
}
