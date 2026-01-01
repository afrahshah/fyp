import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("Certificate Contract", function () {
  let certificate: any;
  let owner: any;
  let issuer: any;
  let recipient: any;
  let otherUser: any;

  const sampleCertificate = {
    recipientName: "John Doe",
    courseName: "Blockchain Development",
    institutionName: "Tech University",
    expiryDate: 0,
    ipfsHash: "QmTestHash123456789",
    tokenURI: "ipfs://QmTestMetadata123456789"
  };

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    owner = signers[0];
    issuer = signers[1];
    recipient = signers[2];
    otherUser = signers[3];

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
        sampleCertificate.tokenURI
      );

      const [certData, currentOwner] = await certificate.getCertificateDetails(0);
      
      expect(certData.recipientName).to.equal(sampleCertificate.recipientName);
      expect(certData.courseName).to.equal(sampleCertificate.courseName);
      expect(certData.institutionName).to.equal(sampleCertificate.institutionName);
      expect(certData.recipientAddress).to.equal(recipient.address);
      expect(certData.issuerAddress).to.equal(owner.address);
      expect(certData.isRevoked).to.be.false;
      expect(currentOwner).to.equal(recipient.address);
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
          sampleCertificate.tokenURI
        )
      ).to.be.revert(ethers);
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
        sampleCertificate.tokenURI
      );
    });

    it("Should verify valid certificate", async function () {
      const [isValid, message] = await certificate.verifyCertificate(0);
      expect(isValid).to.be.true;
      expect(message).to.equal("Certificate is valid");
    });

    it("Should return false for non-existent certificate", async function () {
      const [isValid, message] = await certificate.verifyCertificate(999);
      expect(isValid).to.be.false;
      expect(message).to.equal("Certificate does not exist");
    });

    it("Should return false for revoked certificate", async function () {
      await certificate.revokeCertificate(0);
      const [isValid, message] = await certificate.verifyCertificate(0);
      expect(isValid).to.be.false;
      expect(message).to.equal("Certificate has been revoked");
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
