import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  
  console.log("Deploying Certificate contract to localhost...");
  
  const certificate = await ethers.deployContract("Certificate");
  await certificate.waitForDeployment();
  
  const address = await certificate.getAddress();
  console.log(`\n✅ Certificate deployed to: ${address}`);
  console.log("\nUpdate this address in frontend/src/config/contract.js if different");
  
  const signers = await ethers.getSigners();
  const owner = signers[0];
  
  console.log(`\n📋 Contract Info:`);
  console.log(`   Admin/Issuer: ${owner.address}`);
  console.log(`   Is Admin: ${await certificate.isAdmin(owner.address)}`);
  console.log(`   Is Issuer: ${await certificate.isIssuer(owner.address)}`);
}

main().catch(console.error);
