import { useState } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import toast from 'react-hot-toast';
import './Issue.css';

export default function Issue() {
  const { contract, account, isIssuer } = useWeb3();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    recipientAddress: '',
    recipientName: '',
    courseName: '',
    institutionName: '',
    expiryDate: '',
    ipfsHash: '',
    metadataURI: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
      let expiryTimestamp = 0;
      if (formData.expiryDate) {
        expiryTimestamp = Math.floor(new Date(formData.expiryDate).getTime() / 1000);
      }

      const tx = await contract.issueCertificate(
        formData.recipientAddress,
        formData.recipientName,
        formData.courseName,
        formData.institutionName,
        expiryTimestamp,
        formData.ipfsHash || '',
        formData.metadataURI || ''
      );

      toast.loading('Transaction submitted...', { id: 'issue' });
      await tx.wait();
      toast.success('Certificate issued successfully!', { id: 'issue' });

      setFormData({
        recipientAddress: '',
        recipientName: '',
        courseName: '',
        institutionName: '',
        expiryDate: '',
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
              <label htmlFor="expiryDate">Expiry Date (Optional)</label>
              <input type="date" id="expiryDate" name="expiryDate" value={formData.expiryDate} onChange={handleChange} />
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
      </div>
    </div>
  );
}
