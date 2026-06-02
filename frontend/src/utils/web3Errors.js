const REVERT_PATTERNS = [
  /execution reverted:?\s*(.+)$/i,
  /reverted with reason string ['"](.+?)['"]/i,
  /VM Exception while processing transaction: reverted with reason string ['"](.+?)['"]/i,
  /reason="?([^"\n]+)"?/i
];

function normalizeKnownMessage(message) {
  if (!message) {
    return '';
  }

  if (
    message.includes('user rejected') ||
    message.includes('user denied') ||
    message.includes('action rejected')
  ) {
    return 'Transaction rejected in wallet';
  }

  if (message.includes('invalid recipient address')) {
    return 'Invalid Ethereum address';
  }

  if (message.includes('expiry must be in future')) {
    return 'Expiry must be in future';
  }

  if (message.includes('verification code already exists')) {
    return 'Verification code already exists';
  }

  if (message.includes('certificate already exists')) {
    return 'Certificate already exists';
  }

  if (
    message.includes('404 not found') ||
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('network error') ||
    message.includes('request timeout') ||
    message.includes('timeout') ||
    message.includes('unable to connect to a sepolia read-only rpc') ||
    message.includes('rpc responded with')
  ) {
    return 'Unable to reach the Sepolia network right now';
  }

  if (
    message.includes('could not decode result data') ||
    message.includes('bad data') ||
    message.includes('no matching fragment')
  ) {
    return 'The configured contract does not match the expected certificate verifier interface';
  }

  if (message.includes('accesscontrol') || message.includes('not authorized')) {
    return 'You are not authorized to issue certificates';
  }

  return '';
}

function extractRevertReason(message) {
  if (!message) {
    return '';
  }

  for (const pattern of REVERT_PATTERNS) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return message.trim();
}

function isGenericMessage(message) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes('missing revert data') ||
    normalized.includes('could not decode result data') ||
    normalized === 'execution reverted'
  );
}

export function getWeb3ErrorMessage(error, fallback = 'Something went wrong') {
  if (!error) {
    return fallback;
  }

  if (error.code === 4001 || error.code === 'ACTION_REJECTED' || error.code === 'ACTION_REJECTED_ERROR') {
    return 'Transaction rejected in wallet';
  }

  const candidates = [
    error.info?.error?.message,
    error.error?.reason,
    error.error?.message,
    error.data?.message,
    error.reason,
    error.shortMessage,
    error.info?.message,
    error.message
  ].filter(Boolean);

  for (const candidate of candidates) {
    const extracted = extractRevertReason(candidate);
    if (!extracted || isGenericMessage(extracted)) {
      continue;
    }

    const normalized = normalizeKnownMessage(extracted.toLowerCase());
    if (normalized) {
      return normalized;
    }

    return extracted;
  }

  return fallback;
}
