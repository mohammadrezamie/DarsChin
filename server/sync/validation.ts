export const MAX_SYNC_CHUNK_INDEX = 9_999;
export const MAX_SYNC_RECORDS_PER_CHUNK = 1_000;
export const MAX_SYNC_CHUNK_BYTES = 1_000_000;

export type SyncChunkValidation =
  | { valid: true; data: Record<string, unknown>[]; serialized: string }
  | { valid: false; error: string };

/**
 * Validate untrusted extension/import payloads before persisting a snapshot.
 * This deliberately validates transport shape only; it does not infer or alter
 * academic rules or assume any particular live Educationalyar DOM structure.
 */
export function validateSyncChunk(input: {
  chunkIndex: unknown;
  data: unknown;
  isFinal?: unknown;
}): SyncChunkValidation {
  const { chunkIndex, data, isFinal } = input;

  if (!Number.isSafeInteger(chunkIndex) || (chunkIndex as number) < 0 || (chunkIndex as number) > MAX_SYNC_CHUNK_INDEX) {
    return { valid: false, error: 'شماره بخش همگام‌سازی نامعتبر است.' };
  }

  if (!Array.isArray(data)) {
    return { valid: false, error: 'داده بخش همگام‌سازی باید آرایه باشد.' };
  }

  if (data.length > MAX_SYNC_RECORDS_PER_CHUNK) {
    return { valid: false, error: `هر بخش حداکثر می‌تواند ${MAX_SYNC_RECORDS_PER_CHUNK} رکورد داشته باشد.` };
  }

  if (isFinal !== undefined && typeof isFinal !== 'boolean') {
    return { valid: false, error: 'مقدار پایان همگام‌سازی نامعتبر است.' };
  }

  for (const record of data) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      return { valid: false, error: 'هر رکورد همگام‌سازی باید یک شیء معتبر باشد.' };
    }
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(data);
  } catch {
    return { valid: false, error: 'ساختار داده همگام‌سازی قابل پردازش نیست.' };
  }

  if (Buffer.byteLength(serialized, 'utf8') > MAX_SYNC_CHUNK_BYTES) {
    return { valid: false, error: `حجم هر بخش نباید از ${MAX_SYNC_CHUNK_BYTES} بایت بیشتر باشد.` };
  }

  return { valid: true, data: data as Record<string, unknown>[], serialized };
}

/** Return true only when the supplied chunk indices form the exact 0..finalIndex range. */
export function hasCompleteChunkSequence(indices: number[], finalIndex: number): boolean {
  if (!Number.isSafeInteger(finalIndex) || finalIndex < 0 || finalIndex > MAX_SYNC_CHUNK_INDEX) return false;
  const unique = new Set(indices);
  if (unique.size !== finalIndex + 1) return false;
  for (let index = 0; index <= finalIndex; index += 1) {
    if (!unique.has(index)) return false;
  }
  return true;
}
