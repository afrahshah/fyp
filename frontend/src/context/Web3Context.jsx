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
    disconnectWallet
  };

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
}
