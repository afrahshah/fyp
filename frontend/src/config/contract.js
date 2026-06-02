import CertificateABI from './Certificate.json';

export const NETWORKS = {
  hardhat: {
    chainId: 31337,
    name: "Hardhat Local",
    rpcUrls: ["http://127.0.0.1:8545"]
  },
  sepolia: {
    chainId: 11155111,
    name: "Sepolia Testnet",
    rpcUrls: [
      "https://sepolia.drpc.org",
      "https://ethereum-sepolia.publicnode.com",
      "https://ethereum-sepolia-rpc.publicnode.com"
    ]
  }
};

export const DEFAULT_NETWORK = NETWORKS.sepolia;

const configuredRpcUrls = [
  import.meta.env.VITE_RPC_URL,
  ...(import.meta.env.VITE_RPC_URLS || '').split(',')
]
  .map((url) => url?.trim())
  .filter(Boolean);

export const READ_ONLY_RPC_URLS = Array.from(
  new Set([...configuredRpcUrls, ...DEFAULT_NETWORK.rpcUrls])
);

export const READ_ONLY_RPC_URL = READ_ONLY_RPC_URLS[0];

export const CONTRACT_ADDRESS = "0xf66D0eD7aC3e5E4efb69ac2a3b786ABAB6568C27"; 
export const CONTRACT_ABI = CertificateABI.abi;
