const vietnameseNumber = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

export function formatVnd(value: number): string {
  return `${vietnameseNumber.format(value)} đ`;
}
