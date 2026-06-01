import { ethers } from 'ethers';
import {
  CONTRACT_ABI,
  CONTRACT_ADDRESS,
  DEFAULT_NETWORK,
  READ_ONLY_RPC_URLS
} from '../config/contract';

let readOnlyProvider;
let readOnlyContract;
let readOnlyContractPromise;

const SEPOLIA_CHAIN_ID_HEX = '0xaa36a7';

async function probeRpcUrl(url) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_chainId',
        params: []
      })
    });

    if (!response.ok) {
      throw new Error(`RPC responded with ${response.status}`);
    }

    const payload = await response.json();

    if (payload.error) {
      throw new Error(payload.error.message || 'RPC returned an error');
    }

    if (payload.result !== SEPOLIA_CHAIN_ID_HEX) {
      throw new Error(`Unexpected chain ID ${payload.result}`);
    }

    return true;
  } catch (error) {
    console.warn(`Read-only RPC probe failed for ${url}:`, error);
    return false;
  }
}

async function createReadOnlyContract() {
  let lastError;

  for (const url of READ_ONLY_RPC_URLS) {
    try {
      const isHealthy = await probeRpcUrl(url);
      if (!isHealthy) {
        continue;
      }

      readOnlyProvider = new ethers.JsonRpcProvider(url, DEFAULT_NETWORK.chainId);
      readOnlyContract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        readOnlyProvider
      );

      return readOnlyContract;
    } catch (error) {
      lastError = error;
      console.warn(`Read-only provider setup failed for ${url}:`, error);
    }
  }

  throw lastError || new Error('Unable to connect to a Sepolia read-only RPC');
}

export async function getReadOnlyContract() {
  if (readOnlyContract) {
    return readOnlyContract;
  }

  if (!readOnlyContractPromise) {
    readOnlyContractPromise = createReadOnlyContract().catch((error) => {
      readOnlyProvider = undefined;
      readOnlyContract = undefined;
      readOnlyContractPromise = undefined;
      throw error;
    });
  }

  return readOnlyContractPromise;
}
