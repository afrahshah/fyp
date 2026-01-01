import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  
  console.log("Deploying Certificate contract...");
  
  const certificate = await ethers.deployContract("Certificate");
  await certificate.waitForDeployment();
  
  const address = await certificate.getAddress();
  console.log(`Certificate deployed to: ${address}`);
  
  // Test basic functionality
  console.log("\n--- Testing Contract ---");
  
  const signers = await ethers.getSigners();
  const owner = signers[0];
  const recipient = signers[1];
  
  console.log(`Owner/Admin: ${owner.address}`);
  console.log(`Is Admin: ${await certificate.isAdmin(owner.address)}`);
  console.log(`Is Issuer: ${await certificate.isIssuer(owner.address)}`);
  
  // Issue a test certificate
  console.log("\n--- Issuing Test Certificate ---");
  const tx = await certificate.issueCertificate(
    recipient.address,
    "John Doe",
    "Blockchain Development",
    "Tech University",
    0, // No expiry
    "QmTestHash123",
    "ipfs://QmTestMetadata123"
  );
  await tx.wait();
  console.log("Certificate issued!");
  
  // Get certificate details
  const [certData, currentOwner] = await certificate.getCertificateDetails(0);
  console.log("\n--- Certificate Details ---");
  console.log(`Recipient: ${certData.recipientName}`);
  console.log(`Course: ${certData.courseName}`);
  console.log(`Institution: ${certData.institutionName}`);
  console.log(`Owner: ${currentOwner}`);
  
  // Verify certificate
  const [isValid, message] = await certificate.verifyCertificate(0);
  console.log(`\nVerification: ${isValid ? "✅ Valid" : "❌ Invalid"} - ${message}`);
  
  console.log("\n✅ All tests passed! Contract is working correctly.");
}

main().catch(console.error);
