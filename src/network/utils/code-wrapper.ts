export type CodeType = 'OFFER' | 'ANSWER';

interface UnwrappedCode {
  code: string;
  type: CodeType | null;
}

const getHeader = (type: CodeType) => `-----BEGIN CHAOS-CHESS ${type}-----`;
const getFooter = (type: CodeType) => `-----END CHAOS-CHESS ${type}-----`;

/**
 * Wraps a connection code (offer or answer) with a PGP-style header and footer.
 * @param code The raw connection code.
 * @param type The type of code ('OFFER' or 'ANSWER').
 * @returns The wrapped code block.
 */
export const wrapCode = (code: string, type: CodeType): string => {
  if (!code) return '';
  return `${getHeader(type)}\n${code}\n${getFooter(type)}`;
};

/**
 * Unwraps a connection code, removing the PGP-style header and footer.
 * The parsing is robust and tolerates partial headers/footers.
 * If no headers are found, it returns the input, assuming it's a raw code.
 * @param wrappedCode The potentially wrapped code block.
 * @returns An object containing the raw code and its detected type.
 */
export const unwrapCode = (wrappedCode: string): UnwrappedCode => {
  if (!wrappedCode) return { code: '', type: null };

  const trimmedCode = wrappedCode.trim();
  const lines = trimmedCode.split('\n');

  const beginLineIndex = lines.findIndex(line => line.includes('BEGIN CHAOS-CHESS'));
  const endLineIndex = lines.findIndex(line => line.includes('END CHAOS-CHESS'));

  if (beginLineIndex !== -1 && endLineIndex !== -1 && beginLineIndex < endLineIndex) {
    const headerLine = lines[beginLineIndex];
    const type = headerLine.includes('OFFER') ? 'OFFER' : headerLine.includes('ANSWER') ? 'ANSWER' : null;
    
    const code = lines.slice(beginLineIndex + 1, endLineIndex).join('\n').trim();
    return { code, type };
  }

  // No valid headers found, assume it's a raw code
  return { code: trimmedCode, type: null };
};
