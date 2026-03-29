import { Pattern } from '../context/CaptureContext';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function inferPattern(confirmedText: string, context: string): Pattern {
  const text = confirmedText.trim();
  const len = text.length;

  // Analyze character composition
  const hasDigits = /\d/.test(text);
  const hasLetters = /[a-zA-Z]/.test(text);
  const hasSpecial = /[^a-zA-Z0-9]/.test(text);

  let regexStr = '';
  let description = '';

  // Build pattern by analyzing character groups
  const groups: string[] = [];
  let currentType = '';
  let currentCount = 0;

  for (const char of text) {
    let type: string;
    if (/\d/.test(char)) type = 'digit';
    else if (/[a-zA-Z]/.test(char)) type = 'alpha';
    else type = 'literal:' + char;

    if (type === currentType) {
      currentCount++;
    } else {
      if (currentType) {
        groups.push(`${currentType}:${currentCount}`);
      }
      currentType = type;
      currentCount = 1;
    }
  }
  if (currentType) {
    groups.push(`${currentType}:${currentCount}`);
  }

  // Build regex from groups with some flexibility (+/- 1 char)
  const parts = groups.map(group => {
    const [type, countStr] = group.split(':');
    const count = parseInt(countStr, 10);

    if (type === 'digit') {
      const min = Math.max(1, count - 1);
      const max = count + 1;
      return `\\d{${min},${max}}`;
    } else if (type === 'alpha') {
      const min = Math.max(1, count - 1);
      const max = count + 1;
      return `[a-zA-Z]{${min},${max}}`;
    } else {
      // Literal character (separator like -, ., /, space)
      const literal = type.replace('literal:', '');
      return escapeRegex(literal);
    }
  });

  regexStr = `^${parts.join('')}$`;

  // Describe the pattern
  if (hasDigits && !hasLetters && !hasSpecial) {
    description = `Numero com ${len} digitos`;
  } else if (hasDigits && !hasLetters && hasSpecial) {
    description = `Codigo numerico formatado (${len} caracteres)`;
  } else if (hasLetters && hasDigits) {
    description = `Codigo alfanumerico (${len} caracteres)`;
  } else if (hasLetters && !hasDigits) {
    description = `Texto alfabetico (${len} caracteres)`;
  } else {
    description = `Padrao com ${len} caracteres`;
  }

  return {
    regex: new RegExp(regexStr),
    length: len,
    description,
  };
}

export function matchesPattern(text: string, pattern: Pattern): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;

  // Check regex match
  if (pattern.regex.test(trimmed)) return true;

  // Fallback: check if length is similar (within 20%) and same char composition
  const lenRatio = trimmed.length / pattern.length;
  if (lenRatio < 0.8 || lenRatio > 1.2) return false;

  return false;
}

export function findMatchingTexts(
  texts: string[],
  pattern: Pattern
): string[] {
  return texts
    .map(t => t.trim())
    .filter(t => t.length > 0 && matchesPattern(t, pattern));
}
