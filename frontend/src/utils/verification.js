const VERIFICATION_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const VERIFICATION_CODE_LENGTH = 20;
const VERIFICATION_GROUP_SIZE = 4;

export function generateVerificationCode() {
  const randomValues = new Uint32Array(VERIFICATION_CODE_LENGTH);
  crypto.getRandomValues(randomValues);

  return Array.from(randomValues, (value) => (
    VERIFICATION_ALPHABET[value % VERIFICATION_ALPHABET.length]
  )).join('');
}

export function normalizeVerificationCode(rawValue) {
  if (!rawValue) {
    return '';
  }

  const trimmed = rawValue.trim();

  if (!trimmed) {
    return '';
  }

  try {
    const parsedUrl = new URL(
      trimmed,
      typeof window === 'undefined' ? 'http://localhost' : window.location.origin
    );
    const codeFromQuery = parsedUrl.searchParams.get('code');

    if (codeFromQuery) {
      return normalizeVerificationCode(codeFromQuery);
    }
  } catch {
    // Non-URL input falls through to canonical normalization.
  }

  return trimmed
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function formatVerificationCode(code) {
  const normalizedCode = normalizeVerificationCode(code);

  return normalizedCode.replace(
    new RegExp(`(.{${VERIFICATION_GROUP_SIZE}})`, 'g'),
    '$1-'
  ).replace(/-$/, '');
}

export function buildShareLink(code) {
  const normalizedCode = normalizeVerificationCode(code);

  if (typeof window === 'undefined') {
    return `/verify?code=${encodeURIComponent(normalizedCode)}`;
  }

  return `${window.location.origin}/verify?code=${encodeURIComponent(normalizedCode)}`;
}

export function getVerificationCodeLength() {
  return VERIFICATION_CODE_LENGTH;
}
