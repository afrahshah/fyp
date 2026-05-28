// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title Certificate
 * @dev Immutable Digital Recognition System - NFT Certificate Contract
 * @notice This contract allows authorized institutions to issue tamper-proof digital certificates as NFTs
 */
contract Certificate is ERC721, ERC721URIStorage, ERC721Enumerable, AccessControl {
    
    // ============ Roles ============
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // ============ State Variables ============
    uint256 private _tokenIdCounter;

    // ============ Structs ============
    struct CertificateData {
        string recipientName;
        string courseName;
        string institutionName;
        uint256 issueDate;
        uint256 expiryDate; // 0 means no expiry
        address recipientAddress;
        address issuerAddress;
        bool isRevoked;
        string ipfsHash; // For storing additional metadata/document
        string verificationCode;
    }

    // ============ Mappings ============
    mapping(uint256 => CertificateData) public certificates;
    mapping(address => uint256[]) public recipientCertificates;
    mapping(address => uint256[]) public issuerCertificates;
    mapping(string => bool) public usedIpfsHashes; // Prevent duplicate certificates
    mapping(bytes32 => uint256) private verificationCodeToTokenIdPlusOne;

    // ============ Events ============
    event CertificateIssued(
        uint256 indexed tokenId,
        address indexed recipient,
        address indexed issuer,
        string recipientName,
        string courseName,
        string institutionName,
        uint256 issueDate
    );

    event CertificateRevoked(
        uint256 indexed tokenId,
        address indexed revokedBy,
        uint256 revokeDate
    );

    event IssuerAdded(address indexed issuer, address indexed addedBy);
    event IssuerRemoved(address indexed issuer, address indexed removedBy);

    // ============ Constructor ============
    constructor() ERC721("Digital Certificate", "CERT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(ISSUER_ROLE, msg.sender);
    }

    // ============ Admin Functions ============
    
    /**
     * @dev Add a new institution/issuer who can mint certificates
     * @param issuer Address of the institution to add as issuer
     */
    function addIssuer(address issuer) external onlyRole(ADMIN_ROLE) {
        require(issuer != address(0), "Invalid issuer address");
        require(!hasRole(ISSUER_ROLE, issuer), "Already an issuer");
        
        _grantRole(ISSUER_ROLE, issuer);
        emit IssuerAdded(issuer, msg.sender);
    }

    /**
     * @dev Remove an institution/issuer
     * @param issuer Address of the institution to remove
     */
    function removeIssuer(address issuer) external onlyRole(ADMIN_ROLE) {
        require(hasRole(ISSUER_ROLE, issuer), "Not an issuer");
        
        _revokeRole(ISSUER_ROLE, issuer);
        emit IssuerRemoved(issuer, msg.sender);
    }

    // ============ Core Functions ============

    /**
     * @dev Issue a new certificate as an NFT
     * @param recipient Address of the certificate recipient
     * @param recipientName Name of the recipient
     * @param courseName Name of the course/achievement
     * @param institutionName Name of the issuing institution
     * @param expiryDate Expiry timestamp (0 for no expiry)
     * @param ipfsHash IPFS hash for additional certificate data/document
     * @param verificationCode Unique public verification code
     * @param metadataURI URI for the NFT metadata
     */
    function issueCertificate(
        address recipient,
        string memory recipientName,
        string memory courseName,
        string memory institutionName,
        uint256 expiryDate,
        string memory ipfsHash,
        string memory verificationCode,
        string memory metadataURI
    ) external onlyRole(ISSUER_ROLE) returns (uint256) {
        require(recipient != address(0), "Invalid recipient address");
        require(bytes(recipientName).length > 0, "Recipient name required");
        require(bytes(courseName).length > 0, "Course name required");
        require(bytes(institutionName).length > 0, "Institution name required");
        require(!usedIpfsHashes[ipfsHash] || bytes(ipfsHash).length == 0, "Certificate already exists");
        require(bytes(verificationCode).length > 0, "Verification code required");

        bytes32 verificationCodeHash = keccak256(bytes(verificationCode));
        require(verificationCodeToTokenIdPlusOne[verificationCodeHash] == 0, "Verification code already exists");
        
        if (expiryDate > 0) {
            require(expiryDate > block.timestamp, "Expiry must be in future");
        }

        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        // Store certificate data
        certificates[tokenId] = CertificateData({
            recipientName: recipientName,
            courseName: courseName,
            institutionName: institutionName,
            issueDate: block.timestamp,
            expiryDate: expiryDate,
            recipientAddress: recipient,
            issuerAddress: msg.sender,
            isRevoked: false,
            ipfsHash: ipfsHash,
            verificationCode: verificationCode
        });

        // Mark IPFS hash as used
        if (bytes(ipfsHash).length > 0) {
            usedIpfsHashes[ipfsHash] = true;
        }

        // Add to recipient's certificate list
        recipientCertificates[recipient].push(tokenId);
        issuerCertificates[msg.sender].push(tokenId);
        verificationCodeToTokenIdPlusOne[verificationCodeHash] = tokenId + 1;

        // Mint the NFT
        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, metadataURI);

        emit CertificateIssued(
            tokenId,
            recipient,
            msg.sender,
            recipientName,
            courseName,
            institutionName,
            block.timestamp
        );

        return tokenId;
    }

    /**
     * @dev Revoke a certificate (only original issuer or admin can revoke)
     * @param tokenId Token ID of the certificate to revoke
     */
    function revokeCertificate(uint256 tokenId) external {
        require(_ownerOf(tokenId) != address(0), "Certificate does not exist");
        require(!certificates[tokenId].isRevoked, "Already revoked");
        require(
            certificates[tokenId].issuerAddress == msg.sender || hasRole(ADMIN_ROLE, msg.sender),
            "Not authorized to revoke"
        );

        certificates[tokenId].isRevoked = true;

        emit CertificateRevoked(tokenId, msg.sender, block.timestamp);
    }

    // ============ View Functions ============

    /**
     * @dev Verify if a certificate is valid (exists, not revoked, not expired)
     * @param tokenId Token ID of the certificate
     * @return isValid Whether the certificate is valid
     * @return message Verification status message
     */
    function verifyCertificate(uint256 tokenId) external view returns (bool isValid, string memory message) {
        return _verifyCertificate(tokenId);
    }

    function _verifyCertificate(uint256 tokenId) internal view returns (bool isValid, string memory message) {
        // Check if certificate exists
        if (_ownerOf(tokenId) == address(0)) {
            return (false, "Certificate does not exist");
        }

        CertificateData memory cert = certificates[tokenId];

        // Check if revoked
        if (cert.isRevoked) {
            return (false, "Certificate has been revoked");
        }

        // Check if expired
        if (cert.expiryDate > 0 && block.timestamp > cert.expiryDate) {
            return (false, "Certificate has expired");
        }

        return (true, "Certificate is valid");
    }

    /**
     * @dev Resolve a verification code to a certificate token ID
     * @param verificationCode Verification code of the certificate
     * @return exists Whether a certificate exists for this code
     * @return tokenId Resolved token ID when the code exists
     */
    function getTokenIdByVerificationCode(string memory verificationCode) external view returns (bool exists, uint256 tokenId) {
        uint256 tokenIdPlusOne = verificationCodeToTokenIdPlusOne[keccak256(bytes(verificationCode))];

        if (tokenIdPlusOne == 0) {
            return (false, 0);
        }

        return (true, tokenIdPlusOne - 1);
    }

    /**
     * @dev Verify if a certificate is valid by its public verification code
     * @param verificationCode Verification code of the certificate
     * @return isValid Whether the certificate is valid
     * @return message Verification status message
     * @return tokenId Resolved token ID when the code exists
     */
    function verifyCertificateByCode(string memory verificationCode)
        external
        view
        returns (bool isValid, string memory message, uint256 tokenId)
    {
        uint256 tokenIdPlusOne = verificationCodeToTokenIdPlusOne[keccak256(bytes(verificationCode))];

        if (tokenIdPlusOne == 0) {
            return (false, "Certificate does not exist", 0);
        }

        tokenId = tokenIdPlusOne - 1;
        (isValid, message) = _verifyCertificate(tokenId);
    }

    /**
     * @dev Get full certificate details
     * @param tokenId Token ID of the certificate
     */
    function getCertificateDetails(uint256 tokenId) external view returns (CertificateData memory certData, address currentOwner) {
        require(_ownerOf(tokenId) != address(0), "Certificate does not exist");
        
        return (certificates[tokenId], ownerOf(tokenId));
    }

    /**
     * @dev Get all certificate IDs owned by a recipient
     * @param recipient Address of the recipient
     */
    function getCertificatesByRecipient(address recipient) external view returns (uint256[] memory) {
        return recipientCertificates[recipient];
    }

    /**
     * @dev Get all certificate IDs issued by an issuer
     * @param issuer Address of the issuer
     */
    function getCertificatesByIssuer(address issuer) external view returns (uint256[] memory) {
        return issuerCertificates[issuer];
    }

    /**
     * @dev Get the total number of certificates issued
     */
    function getTotalCertificates() external view returns (uint256) {
        return _tokenIdCounter;
    }

    /**
     * @dev Check if an address is an authorized issuer
     * @param account Address to check
     */
    function isIssuer(address account) external view returns (bool) {
        return hasRole(ISSUER_ROLE, account);
    }

    /**
     * @dev Check if an address is an admin
     * @param account Address to check
     */
    function isAdmin(address account) external view returns (bool) {
        return hasRole(ADMIN_ROLE, account);
    }

    // ============ Override Functions ============

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
