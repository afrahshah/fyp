import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("Certificate Contract", function () {
  let certificate: any;
  let owner: any;
  let issuer: any;
  let secondIssuer: any;
  let recipient: any;
  let secondRecipient: any;
  let otherUser: any;

  const sampleCertificate = {
    recipientName: "John Doe",
    courseName: "Blockchain Development",
    institutionName: "Tech University",
    expiryDate: 0,
    ipfsHash: "QmTestHash123456789",
    verificationCode: "ABCD2345EFGH6789JKLM",
    tokenURI: "ipfs://QmTestMetadata123456789"
  };

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    owner = signers[0];
    issuer = signers[1];
    recipient = signers[2];
    otherUser = signers[3];
    secondIssuer = signers[4];
    secondRecipient = signers[5];

    certificate = await ethers.deployContract("Certificate");
    await certificate.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the deployer as admin and issuer", async function () {
      expect(await certificate.isAdmin(owner.address)).to.be.true;
      expect(await certificate.isIssuer(owner.address)).to.be.true;
    });

    it("Should have correct name and symbol", async function () {
      expect(await certificate.name()).to.equal("Digital Certificate");
      expect(await certificate.symbol()).to.equal("CERT");
    });

    it("Should start with 0 certificates", async function () {
      expect(await certificate.getTotalCertificates()).to.equal(0);
    });
  });

  describe("Issuer Management", function () {
    it("Should allow admin to add a new issuer", async function () {
      await expect(certificate.addIssuer(issuer.address))
        .to.emit(certificate, "IssuerAdded")
        .withArgs(issuer.address, owner.address);

      expect(await certificate.isIssuer(issuer.address)).to.be.true;
    });

    it("Should allow admin to remove an issuer", async function () {
      await certificate.addIssuer(issuer.address);
      
      await expect(certificate.removeIssuer(issuer.address))
        .to.emit(certificate, "IssuerRemoved")
        .withArgs(issuer.address, owner.address);

      expect(await certificate.isIssuer(issuer.address)).to.be.false;
    });

    it("Should not allow non-admin to add issuer", async function () {
      await expect(
        certificate.connect(otherUser).addIssuer(issuer.address)
      ).to.be.revert(ethers);
    });
  });

  describe("Certificate Issuance", function () {
    it("Should allow issuer to issue a certificate", async function () {
      const tx = await certificate.issueCertificate(
        recipient.address,
        sampleCertificate.recipientName,
        sampleCertificate.courseName,
        sampleCertificate.institutionName,
        sampleCertificate.expiryDate,
        sampleCertificate.ipfsHash,
        sampleCertificate.verificationCode,
        sampleCertificate.tokenURI
      );

      await expect(tx).to.emit(certificate, "CertificateIssued");
      expect(await certificate.getTotalCertificates()).to.equal(1);
      expect(await certificate.ownerOf(0)).to.equal(recipient.address);
    });

    it("Should store certificate data correctly", async function () {
      await certificate.issueCertificate(
        recipient.address,
        sampleCertificate.recipientName,
        sampleCertificate.courseName,
        sampleCertificate.institutionName,
        sampleCertificate.expiryDate,
        sampleCertificate.ipfsHash,
        sampleCertificate.verificationCode,
        sampleCertificate.tokenURI
      );

      const [certData, currentOwner] = await certificate.getCertificateDetails(0);
      
      expect(certData.recipientName).to.equal(sampleCertificate.recipientName);
      expect(certData.courseName).to.equal(sampleCertificate.courseName);
      expect(certData.institutionName).to.equal(sampleCertificate.institutionName);
      expect(certData.recipientAddress).to.equal(recipient.address);
      expect(certData.issuerAddress).to.equal(owner.address);
      expect(certData.isRevoked).to.be.false;
      expect(certData.verificationCode).to.equal(sampleCertificate.verificationCode);
      expect(currentOwner).to.equal(recipient.address);
    });

    it("Should store issued certificate IDs under the recipient", async function () {
      await certificate.issueCertificate(
        recipient.address,
        sampleCertificate.recipientName,
        sampleCertificate.courseName,
        sampleCertificate.institutionName,
        sampleCertificate.expiryDate,
        sampleCertificate.ipfsHash,
        sampleCertificate.verificationCode,
        sampleCertificate.tokenURI
      );

      const certificateIds = await certificate.getCertificatesByRecipient(recipient.address);
      expect(certificateIds).to.deep.equal([0n]);
    });

    it("Should store issued certificate IDs under the issuer", async function () {
      await certificate.issueCertificate(
        recipient.address,
        sampleCertificate.recipientName,
        sampleCertificate.courseName,
        sampleCertificate.institutionName,
        sampleCertificate.expiryDate,
        sampleCertificate.ipfsHash,
        sampleCertificate.verificationCode,
        sampleCertificate.tokenURI
      );

      const certificateIds = await certificate.getCertificatesByIssuer(owner.address);
      expect(certificateIds).to.deep.equal([0n]);
    });

    it("Should return only certificates issued by the requested issuer", async function () {
      await certificate.addIssuer(issuer.address);
      await certificate.addIssuer(secondIssuer.address);

      await certificate.issueCertificate(
        recipient.address,
        sampleCertificate.recipientName,
        sampleCertificate.courseName,
        sampleCertificate.institutionName,
        sampleCertificate.expiryDate,
        sampleCertificate.ipfsHash,
        sampleCertificate.verificationCode,
        sampleCertificate.tokenURI
      );

      await certificate.connect(issuer).issueCertificate(
        secondRecipient.address,
        "Jane Doe",
        "Smart Contract Security",
        "Tech University",
        0,
        "QmIssuerTwoHash123456789",
        "WXYZ2345EFGH6789JKLM",
        "ipfs://QmIssuerTwoMetadata123456789"
      );

      await certificate.connect(secondIssuer).issueCertificate(
        recipient.address,
        "John Doe",
        "Frontend Development",
        "Tech University",
        0,
        "QmIssuerThreeHash123456789",
        "QRST2345EFGH6789JKLM",
        "ipfs://QmIssuerThreeMetadata123456789"
      );

      expect(await certificate.getCertificatesByIssuer(owner.address)).to.deep.equal([0n]);
      expect(await certificate.getCertificatesByIssuer(issuer.address)).to.deep.equal([1n]);
      expect(await certificate.getCertificatesByIssuer(secondIssuer.address)).to.deep.equal([2n]);
    });

    it("Should not allow non-issuer to issue certificate", async function () {
      await expect(
        certificate.connect(otherUser).issueCertificate(
          recipient.address,
          sampleCertificate.recipientName,
          sampleCertificate.courseName,
          sampleCertificate.institutionName,
          sampleCertificate.expiryDate,
          sampleCertificate.ipfsHash,
          sampleCertificate.verificationCode,
          sampleCertificate.tokenURI
        )
      ).to.be.revert(ethers);
    });

    it("Should reject duplicate verification codes", async function () {
      await certificate.issueCertificate(
        recipient.address,
        sampleCertificate.recipientName,
        sampleCertificate.courseName,
        sampleCertificate.institutionName,
        sampleCertificate.expiryDate,
        sampleCertificate.ipfsHash,
        sampleCertificate.verificationCode,
        sampleCertificate.tokenURI
      );

      await expect(
        certificate.issueCertificate(
          secondRecipient.address,
          "Jane Doe",
          "Solidity Security",
          "Tech University",
          0,
          "QmDifferentHash987654321",
          sampleCertificate.verificationCode,
          "ipfs://QmDifferentMetadata987654321"
        )
      ).to.be.revertedWith("Verification code already exists");
    });
  });

  describe("Certificate Verification", function () {
    beforeEach(async function () {
      await certificate.issueCertificate(
        recipient.address,
        sampleCertificate.recipientName,
        sampleCertificate.courseName,
        sampleCertificate.institutionName,
        sampleCertificate.expiryDate,
        sampleCertificate.ipfsHash,
        sampleCertificate.verificationCode,
        sampleCertificate.tokenURI
      );
    });

    it("Should verify valid certificate", async function () {
      const [isValid, message] = await certificate.verifyCertificate(0);
      expect(isValid).to.be.true;
      expect(message).to.equal("Certificate is valid");
    });

    it("Should resolve token by verification code", async function () {
      const [exists, tokenId] = await certificate.getTokenIdByVerificationCode(sampleCertificate.verificationCode);
      expect(exists).to.be.true;
      expect(tokenId).to.equal(0);
    });

    it("Should verify valid certificate by code", async function () {
      const [isValid, message, tokenId] = await certificate.verifyCertificateByCode(sampleCertificate.verificationCode);
      expect(isValid).to.be.true;
      expect(message).to.equal("Certificate is valid");
      expect(tokenId).to.equal(0);
    });

    it("Should return false for non-existent certificate", async function () {
      const [isValid, message] = await certificate.verifyCertificate(999);
      expect(isValid).to.be.false;
      expect(message).to.equal("Certificate does not exist");
    });

    it("Should return false for non-existent verification code", async function () {
      const [exists, tokenId] = await certificate.getTokenIdByVerificationCode("UNKNOWNCODE1234567890");
      const [isValid, message, verifyTokenId] = await certificate.verifyCertificateByCode("UNKNOWNCODE1234567890");

      expect(exists).to.be.false;
      expect(tokenId).to.equal(0);
      expect(isValid).to.be.false;
      expect(message).to.equal("Certificate does not exist");
      expect(verifyTokenId).to.equal(0);
    });

    it("Should return false for revoked certificate", async function () {
      await certificate.revokeCertificate(0);
      const [isValid, message] = await certificate.verifyCertificate(0);
      expect(isValid).to.be.false;
      expect(message).to.equal("Certificate has been revoked");
    });

    it("Should return false for revoked certificate by code", async function () {
      await certificate.revokeCertificate(0);
      const [isValid, message, tokenId] = await certificate.verifyCertificateByCode(sampleCertificate.verificationCode);
      expect(isValid).to.be.false;
      expect(message).to.equal("Certificate has been revoked");
      expect(tokenId).to.equal(0);
    });

    it("Should return false for expired certificate by code", async function () {
      const futureExpiry = 1_900_000_000;
      await certificate.issueCertificate(
        secondRecipient.address,
        "Jane Doe",
        "Auditing",
        "Tech University",
        futureExpiry,
        "QmExpiryHash123456789",
        "EXPY2345EFGH6789JKLM",
        "ipfs://QmExpiryMetadata123456789"
      );

      await ethers.provider.send("evm_setNextBlockTimestamp", [futureExpiry + 1]);
      await ethers.provider.send("evm_mine", []);

      const [isValid, message, tokenId] = await certificate.verifyCertificateByCode("EXPY2345EFGH6789JKLM");
      expect(isValid).to.be.false;
      expect(message).to.equal("Certificate has expired");
      expect(tokenId).to.equal(1);
    });
  });

  describe("Certificate Revocation", function () {
    beforeEach(async function () {
      await certificate.issueCertificate(
        recipient.address,
        sampleCertificate.recipientName,
        sampleCertificate.courseName,
        sampleCertificate.institutionName,
        sampleCertificate.expiryDate,
        sampleCertificate.ipfsHash,
        sampleCertificate.verificationCode,
        sampleCertificate.tokenURI
      );
    });

    it("Should allow issuer to revoke certificate", async function () {
      await expect(certificate.revokeCertificate(0))
        .to.emit(certificate, "CertificateRevoked");

      const [certData] = await certificate.getCertificateDetails(0);
      expect(certData.isRevoked).to.be.true;
    });

    it("Should not allow non-issuer to revoke certificate", async function () {
      await expect(
        certificate.connect(otherUser).revokeCertificate(0)
      ).to.be.revertedWith("Not authorized to revoke");
    });
  });
});
