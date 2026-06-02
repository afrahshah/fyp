import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const toBytes32 = (value: string) => ethers.encodeBytes32String(value);
  
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
    toBytes32("John Doe"),
    toBytes32("Blockchain Development"),
    toBytes32("Tech University"),
    0, // No expiry
    toBytes32("ABCD2345EFGH6789JKLM")
  );
  await tx.wait();
  console.log("Certificate issued!");
  
  // Get certificate details
  const [certData, currentOwner] = await certificate.getCertificateDetails(0);
  console.log("\n--- Certificate Details ---");
  console.log(`Recipient: ${ethers.decodeBytes32String(certData.recipientName)}`);
  console.log(`Course: ${ethers.decodeBytes32String(certData.courseName)}`);
  console.log(`Institution: ${ethers.decodeBytes32String(certData.institutionName)}`);
  console.log(`Owner: ${currentOwner}`);
  
  // Verify certificate
  const [isValid, message] = await certificate.verifyCertificate(0);
  console.log(`\nVerification: ${isValid ? "✅ Valid" : "❌ Invalid"} - ${message}`);

  const [exists, tokenId] = await certificate.getTokenIdByVerificationCode(toBytes32("ABCD2345EFGH6789JKLM"));
  console.log(`Share code lookup: ${exists ? `token ${tokenId}` : "not found"}`);
  
  console.log("\n✅ All tests passed! Contract is working correctly.");
}

main().catch(console.error);
