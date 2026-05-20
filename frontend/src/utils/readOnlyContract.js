import { ethers } from 'ethers';
import { CONTRACT_ABI, CONTRACT_ADDRESS, READ_ONLY_RPC_URL } from '../config/contract';

let readOnlyProvider;
let readOnlyContract;

export function getReadOnlyContract() {
  if (!readOnlyProvider) {
    readOnlyProvider = new ethers.JsonRpcProvider(READ_ONLY_RPC_URL);
  }

  if (!readOnlyContract) {
    readOnlyContract = new ethers.Contract(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      readOnlyProvider
    );
  }

  return readOnlyContract;
}
