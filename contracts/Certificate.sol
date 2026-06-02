// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

/**
 * @title Certificate
 * @dev Fully on-chain digital certificate NFT contract
 */
contract Certificate is ERC721, ERC721Enumerable, AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    uint256 private _tokenIdCounter;

    struct CertificateData {
        address recipientAddress;
        address issuerAddress;
        uint64 issueDate;
        uint64 expiryDate;
        bool isRevoked;
        bytes32 recipientName;
        bytes32 courseName;
        bytes32 institutionName;
        bytes32 verificationCode;
    }

    mapping(uint256 => CertificateData) public certificates;
    mapping(address => uint256[]) public recipientCertificates;
    mapping(address => uint256[]) public issuerCertificates;
    mapping(bytes32 => uint256) private verificationCodeToTokenIdPlusOne;

    event CertificateIssued(
        uint256 indexed tokenId,
        address indexed recipient,
        address indexed issuer,
        uint64 issueDate
    );

    event CertificateRevoked(
        uint256 indexed tokenId,
        address indexed revokedBy,
        uint256 revokeDate
    );

    event IssuerAdded(address indexed issuer, address indexed addedBy);
    event IssuerRemoved(address indexed issuer, address indexed removedBy);

    constructor() ERC721("Digital Certificate", "CERT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(ISSUER_ROLE, msg.sender);
    }

    function addIssuer(address issuer) external onlyRole(ADMIN_ROLE) {
        require(issuer != address(0), "Invalid issuer address");
        require(!hasRole(ISSUER_ROLE, issuer), "Already an issuer");

        _grantRole(ISSUER_ROLE, issuer);
        emit IssuerAdded(issuer, msg.sender);
    }

    function removeIssuer(address issuer) external onlyRole(ADMIN_ROLE) {
        require(hasRole(ISSUER_ROLE, issuer), "Not an issuer");

        _revokeRole(ISSUER_ROLE, issuer);
        emit IssuerRemoved(issuer, msg.sender);
    }

    function issueCertificate(
        address recipient,
        bytes32 recipientName,
        bytes32 courseName,
        bytes32 institutionName,
        uint64 expiryDate,
        bytes32 verificationCode
    ) external onlyRole(ISSUER_ROLE) returns (uint256) {
        require(recipient != address(0), "Invalid recipient address");
        require(recipientName != bytes32(0), "Recipient name required");
        require(courseName != bytes32(0), "Course name required");
        require(institutionName != bytes32(0), "Institution name required");
        require(verificationCode != bytes32(0), "Verification code required");
        require(
            verificationCodeToTokenIdPlusOne[verificationCode] == 0,
            "Verification code already exists"
        );

        uint64 issueDate = uint64(block.timestamp);
        if (expiryDate > 0) {
            require(expiryDate > issueDate, "Expiry must be in future");
        }

        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter = tokenId + 1;

        certificates[tokenId] = CertificateData({
            recipientAddress: recipient,
            issuerAddress: msg.sender,
            issueDate: issueDate,
            expiryDate: expiryDate,
            isRevoked: false,
            recipientName: recipientName,
            courseName: courseName,
            institutionName: institutionName,
            verificationCode: verificationCode
        });

        recipientCertificates[recipient].push(tokenId);
        issuerCertificates[msg.sender].push(tokenId);
        verificationCodeToTokenIdPlusOne[verificationCode] = tokenId + 1;

        _safeMint(recipient, tokenId);

        emit CertificateIssued(tokenId, recipient, msg.sender, issueDate);

        return tokenId;
    }

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

    function verifyCertificate(uint256 tokenId) external view returns (bool isValid, string memory message) {
        return _verifyCertificate(tokenId);
    }

    function _verifyCertificate(uint256 tokenId) internal view returns (bool isValid, string memory message) {
        if (_ownerOf(tokenId) == address(0)) {
            return (false, "Certificate does not exist");
        }

        CertificateData memory cert = certificates[tokenId];

        if (cert.isRevoked) {
            return (false, "Certificate has been revoked");
        }

        if (cert.expiryDate > 0 && block.timestamp > cert.expiryDate) {
            return (false, "Certificate has expired");
        }

        return (true, "Certificate is valid");
    }

    function getTokenIdByVerificationCode(bytes32 verificationCode) external view returns (bool exists, uint256 tokenId) {
        uint256 tokenIdPlusOne = verificationCodeToTokenIdPlusOne[verificationCode];

        if (tokenIdPlusOne == 0) {
            return (false, 0);
        }

        return (true, tokenIdPlusOne - 1);
    }

    function verifyCertificateByCode(bytes32 verificationCode)
        external
        view
        returns (bool isValid, string memory message, uint256 tokenId)
    {
        uint256 tokenIdPlusOne = verificationCodeToTokenIdPlusOne[verificationCode];

        if (tokenIdPlusOne == 0) {
            return (false, "Certificate does not exist", 0);
        }

        tokenId = tokenIdPlusOne - 1;
        (isValid, message) = _verifyCertificate(tokenId);
    }

    function getCertificateDetails(uint256 tokenId) external view returns (CertificateData memory certData, address currentOwner) {
        require(_ownerOf(tokenId) != address(0), "Certificate does not exist");

        return (certificates[tokenId], ownerOf(tokenId));
    }

    function getCertificatesByRecipient(address recipient) external view returns (uint256[] memory) {
        return recipientCertificates[recipient];
    }

    function getCertificatesByIssuer(address issuer) external view returns (uint256[] memory) {
        return issuerCertificates[issuer];
    }

    function getTotalCertificates() external view returns (uint256) {
        return _tokenIdCounter;
    }

    function isIssuer(address account) external view returns (bool) {
        return hasRole(ISSUER_ROLE, account);
    }

    function isAdmin(address account) external view returns (bool) {
        return hasRole(ADMIN_ROLE, account);
    }

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

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
