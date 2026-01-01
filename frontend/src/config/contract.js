// Contract configuration
// Update CONTRACT_ADDRESS after deploying to your network
export const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // Default Hardhat local deployment address

export const CONTRACT_ABI = [
  // Events
  "event CertificateIssued(uint256 indexed tokenId, address indexed recipient, address indexed issuer, string recipientName, string courseName, string institutionName, uint256 issueDate)",
  "event CertificateRevoked(uint256 indexed tokenId, address indexed revokedBy, uint256 revokeDate)",
  "event IssuerAdded(address indexed issuer, address indexed addedBy)",
  "event IssuerRemoved(address indexed issuer, address indexed removedBy)",
  
  // Read Functions
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function tokenByIndex(uint256 index) view returns (uint256)",
  
  // Certificate Functions
  "function certificates(uint256) view returns (string recipientName, string courseName, string institutionName, uint256 issueDate, uint256 expiryDate, address recipientAddress, address issuerAddress, bool isRevoked, string ipfsHash)",
  "function getCertificateDetails(uint256 tokenId) view returns (tuple(string recipientName, string courseName, string institutionName, uint256 issueDate, uint256 expiryDate, address recipientAddress, address issuerAddress, bool isRevoked, string ipfsHash) certData, address currentOwner)",
  "function getCertificatesByRecipient(address recipient) view returns (uint256[])",
  "function getTotalCertificates() view returns (uint256)",
  "function verifyCertificate(uint256 tokenId) view returns (bool isValid, string message)",
  
  // Role Functions
  "function isIssuer(address account) view returns (bool)",
  "function isAdmin(address account) view returns (bool)",
  "function ISSUER_ROLE() view returns (bytes32)",
  "function ADMIN_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  
  // Write Functions
  "function issueCertificate(address recipient, string recipientName, string courseName, string institutionName, uint256 expiryDate, string ipfsHash, string metadataURI) returns (uint256)",
  "function revokeCertificate(uint256 tokenId)",
  "function addIssuer(address issuer)",
  "function removeIssuer(address issuer)",
  
  // ERC721 Functions
  "function approve(address to, uint256 tokenId)",
  "function transferFrom(address from, address to, uint256 tokenId)",
  "function safeTransferFrom(address from, address to, uint256 tokenId)"
];

// Network configurations
export const NETWORKS = {
  hardhat: {
    chainId: 31337,
    name: "Hardhat Local",
    rpcUrl: "http://127.0.0.1:8545"
  },
  sepolia: {
    chainId: 11155111,
    name: "Sepolia Testnet",
    rpcUrl: "https://sepolia.infura.io/v3/YOUR_INFURA_KEY"
  }
};

export const DEFAULT_NETWORK = NETWORKS.hardhat;
