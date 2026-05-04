const HIGH_SURROGATE_MIN = 0xd800;
const HIGH_SURROGATE_MAX = 0xdbff;

export const chunkInputByCodeUnits = (data: string, maxLength: number): string[] => {
  if (data.length <= maxLength) return [data];
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < data.length) {
    let end = Math.min(cursor + maxLength, data.length);
    if (end < data.length) {
      const lastCodeUnit = data.charCodeAt(end - 1);
      if (lastCodeUnit >= HIGH_SURROGATE_MIN && lastCodeUnit <= HIGH_SURROGATE_MAX) {
        end -= 1;
      }
    }
    if (end === cursor) end = cursor + maxLength;
    chunks.push(data.slice(cursor, end));
    cursor = end;
  }
  return chunks;
};
