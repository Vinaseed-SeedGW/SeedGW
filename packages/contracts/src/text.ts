const COMBINING_MARKS = /\p{M}/gu;

// Phai cho ket qua giong cot search_text trong database.
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();
}

export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}
