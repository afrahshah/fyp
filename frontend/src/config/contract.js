// Import the ABI directly from your JSON file
import CertificateABI from './Certificate.json';

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
    // Public RPC URL for reading data (MetaMask handles the writing)
    rpcUrl: "https://rpc.sepolia.org" 
  }
};

// CHANGE 1: Set the default network to Sepolia!
export const DEFAULT_NETWORK = NETWORKS.sepolia;
export const READ_ONLY_RPC_URL = import.meta.env.VITE_RPC_URL || DEFAULT_NETWORK.rpcUrl;

// Contract configuration
// CHANGE 2: Replace this placeholder with your real Sepolia 0x... address!
export const CONTRACT_ADDRESS = "0x05cE48785649226C726c1aece7531E145C8b06e4"; 

// CHANGE 3: Automatically use the ABI from the imported JSON
export const CONTRACT_ABI = CertificateABI.abi;