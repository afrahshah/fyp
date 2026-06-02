import { ethers } from 'ethers';
import { normalizeVerificationCode } from './verification';

export const MAX_BYTES32_TEXT_LENGTH = 31;

export function getUtf8ByteLength(value) {
  return ethers.toUtf8Bytes(value).length;
}

export function encodeBytes32Text(value, fieldName) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new Error(`${fieldName} is required`);
  }

  if (getUtf8ByteLength(normalizedValue) > MAX_BYTES32_TEXT_LENGTH) {
    throw new Error(`${fieldName} must be ${MAX_BYTES32_TEXT_LENGTH} bytes or less`);
  }

  return ethers.encodeBytes32String(normalizedValue);
}

export function encodeVerificationCode(value) {
  const normalizedCode = normalizeVerificationCode(value);

  if (!normalizedCode) {
    throw new Error('Verification code is required');
  }

  if (getUtf8ByteLength(normalizedCode) > MAX_BYTES32_TEXT_LENGTH) {
    throw new Error(`Verification code must be ${MAX_BYTES32_TEXT_LENGTH} bytes or less`);
  }

  return ethers.encodeBytes32String(normalizedCode);
}

export function decodeBytes32Text(value) {
  if (!value) {
    return '';
  }

  try {
    return ethers.decodeBytes32String(value);
  } catch {
    return '';
  }
}
