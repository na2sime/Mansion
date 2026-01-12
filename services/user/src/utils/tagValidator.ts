/**
 * Validates user tag format: AAAAAAA#BBB
 * - 8 alphanumeric characters before #
 * - Maximum 3 alphanumeric characters after #
 */
export const isValidUserTag = (tag: string): boolean => {
  const tagRegex = /^[A-Za-z0-9]{8}#[A-Za-z0-9]{1,3}$/;
  return tagRegex.test(tag);
};

/**
 * Generates a random user tag
 */
export const generateRandomTag = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let tag = '';

  // Generate 8 characters for the first part
  for (let i = 0; i < 8; i++) {
    tag += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  tag += '#';

  // Generate 3 characters for the second part
  for (let i = 0; i < 3; i++) {
    tag += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return tag;
};

/**
 * Normalizes a user tag to uppercase
 */
export const normalizeTag = (tag: string): string => {
  return tag.toUpperCase();
};
