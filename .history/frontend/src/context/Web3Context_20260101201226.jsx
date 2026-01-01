import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contract';
import toast from 'react-hot-toast';
import { Web3Context } from './Web3ContextDef';

export function Web3Provider({ children }) {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isIssuer, setIsIssuer] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [networkName, setNetworkName] = useState('');

  // Check roles
  const checkRoles = useCallback(async (contractInstance, address) => {
    try {
      const [issuerStatus, adminStatus] = await Promise.all([
        contractInstance.isIssuer(address),
        contractInstance.isAdmin(address)
      ]);
      setIsIssuer(issuerStatus);
      setIsAdmin(adminStatus);
    } catch (error) {
      console.error('Error checking roles:', error);
    }
  }, []);

  // Connect wallet
  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      toast.error('Please install MetaMask to use this app');
      return;
    }

    setIsConnecting(true);
    try {
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send('eth_requestAccounts', []);
      const network = await browserProvider.getNetwork();
      const signerInstance = await browserProvider.getSigner();
      
      const contractInstance = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signerInstance
      );

      setProvider(browserProvider);
      setSigner(signerInstance);
      setContract(contractInstance);
      setAccount(accounts[0]);
      setNetworkName(network.name === 'unknown' ? 'Local Network' : network.name);

      await checkRoles(contractInstance, accounts[0]);
      toast.success('Wallet connected successfully!');
    } catch (error) {
      console.error('Connection error:', error);
      toast.error('Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  }, [checkRoles]);

  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setContract(null);
    setIsIssuer(false);
    setIsAdmin(false);
    setNetworkName('');
    toast.success('Wallet disconnected');
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          setAccount(accounts[0]);
          if (contract) {
            checkRoles(contract, accounts[0]);
          }
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners('accountsChanged');
        window.ethereum.removeAllListeners('chainChanged');
      }
    };
  }, [contract, checkRoles, disconnectWallet]);

  const connectLocalDevAccount = useCallback(async () => {
    // Don't override if a wallet is already connected
    if (account || provider) return { ok: false, reason: 'already_connected' };

    try {
      const localRpc = process.env.REACT_APP_LOCAL_RPC || 'http://127.0.0.1:8545';
      const localProvider = new ethers.JsonRpcProvider(localRpc);

      // Get first available signer on the local node
      const signerInstance = localProvider.getSigner(0);
      const signerAddress = await signerInstance.getAddress();

      // Make sure the contract exists at the configured address
      const code = await localProvider.getCode(CONTRACT_ADDRESS);
      if (!code || code === '0x') {
        console.debug('No contract code at', CONTRACT_ADDRESS);
        return { ok: false, reason: 'no_contract' };
      }

      // Read contract via provider and check roles
      const contractWithProvider = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, localProvider);
      const [adminStatus, issuerStatus] = await Promise.all([
        contractWithProvider.isAdmin(signerAddress),
        contractWithProvider.isIssuer(signerAddress)
      ]);

      if (!adminStatus) {
        console.debug('Local signer is not admin:', signerAddress);
        return { ok: false, reason: 'not_admin' };
      }

      const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signerInstance);
      setProvider(localProvider);
      setSigner(signerInstance);
      setContract(contractInstance);
      setAccount(signerAddress);
      setNetworkName('Local Node');

      // If admin but not issuer, auto-grant issuer in development to allow issuing
      if (adminStatus && !issuerStatus && process.env.NODE_ENV !== 'production') {
        try {
          toast.loading('Granting issuer role to local admin...', { id: 'grantIssuer' });
          const tx = await contractInstance.addIssuer(signerAddress);
          await tx.wait();
          toast.success('Issuer role granted to local admin', { id: 'grantIssuer' });
        } catch (err) {
          console.error('Failed to auto-add issuer:', err);
          toast.error('Failed to auto-grant issuer role to local admin');
        }
      }

      await checkRoles(contractInstance, signerAddress);
      toast.success('Connected to local node as admin (dev fallback)');
      return { ok: true };
    } catch (err) {
      console.debug('connectLocalDevAccount error', err);
      return { ok: false, reason: 'error', error: err?.message };
    }
  }, [account, provider, checkRoles]);

  // Auto-run on mount in non-production environments
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      connectLocalDevAccount();
    }
  }, [connectLocalDevAccount]);

  const value = {
    account,
    provider,
    signer,
    contract,
    isConnecting,
    isIssuer,
    isAdmin,
    networkName,
    connectWallet,
    disconnectWallet,
    connectLocalDevAccount
  };

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
}
