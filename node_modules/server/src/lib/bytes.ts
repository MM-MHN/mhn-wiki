export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0B";
  if (bytes < 1024) return `${Math.round(bytes)}B`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb >= 10 ? Math.round(kb) : Number(kb.toFixed(1))}KB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : Number(mb.toFixed(1))}MB`;
}

export function sizeLimitMessage(maxBytes: number, uploadedBytes?: number): string {
  const max = formatBytes(maxBytes);
  if (uploadedBytes != null) {
    return `Exceeds maximum allowed size of ${max}; uploaded size was ${formatBytes(uploadedBytes)}`;
  }
  return `Exceeds maximum allowed size of ${max}`;
}
