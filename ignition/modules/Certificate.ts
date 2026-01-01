import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Ignition module for deploying the Certificate NFT contract
 * This module deploys the main Certificate contract for the
 * Immutable Digital Recognition System
 */
const CertificateModule = buildModule("CertificateModule", (m) => {
  // Deploy the Certificate contract
  const certificate = m.contract("Certificate");

  return { certificate };
});

export default CertificateModule;
