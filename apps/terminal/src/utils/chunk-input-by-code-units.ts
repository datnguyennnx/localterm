import {
  UNICODE_HIGH_SURROGATE_MIN,
  UNICODE_HIGH_SURROGATE_MAX,
  UNICODE_LOW_SURROGATE_MIN,
  UNICODE_LOW_SURROGATE_MAX,
} from "@/lib/constants";

export const chunkInputByCodeUnits = (data: string, maxLength: number): string[] => {
  if (data.length <= maxLength) return [data];
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < data.length) {
    let end = Math.min(cursor + maxLength, data.length);
    if (end < data.length) {
      const lastCodeUnit = data.charCodeAt(end - 1);
      if (
        lastCodeUnit >= UNICODE_HIGH_SURROGATE_MIN &&
        lastCodeUnit <= UNICODE_HIGH_SURROGATE_MAX
      ) {
        end -= 1;
      }
    }
    if (end === cursor) end = cursor + maxLength;
    if (end < data.length) {
      const nextCodeUnit = data.charCodeAt(end);
      if (nextCodeUnit >= UNICODE_LOW_SURROGATE_MIN && nextCodeUnit <= UNICODE_LOW_SURROGATE_MAX) {
        end += 1;
      }
    }
    chunks.push(data.slice(cursor, end));
    cursor = end;
  }
  return chunks;
};
