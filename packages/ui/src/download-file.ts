const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function downloadFile({ fileName, base64 }: { fileName: string; base64: string }) {
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: XLSX_MIME }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
