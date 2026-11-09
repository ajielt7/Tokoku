function pair(code, value) {
  return `${code}\n${value}\n`;
}

function safeText(value) {
  return [...String(value ?? "").normalize("NFC").replace(/[\r\n\x00-\x1f]/g, " ").slice(0, 80)]
    .map((character) => {
      const codePoint = character.codePointAt(0);
      if (codePoint <= 0x7e) return character;
      if (codePoint <= 0xffff) return `\\U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
      const adjusted = codePoint - 0x10000;
      const high = 0xd800 + (adjusted >> 10);
      const low = 0xdc00 + (adjusted & 0x3ff);
      return `\\U+${high.toString(16).toUpperCase()}\\U+${low.toString(16).toUpperCase()}`;
    }).join("");
}

export function parsePlateSize(sizeText) {
  const match = String(sizeText ?? "").match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm)\b/i);
  if (!match) throw new Error("Ukuran tetap harus berisi lebar × tinggi dan satuan mm atau cm.");
  const factor = match[3].toLowerCase() === "cm" ? 10 : 1;
  const width = Number(match[1].replace(",", ".")) * factor;
  const height = Number(match[2].replace(",", ".")) * factor;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 50 || height < 30 || width > 2000 || height > 2000) {
    throw new Error("Ukuran gambar harus antara 50 dan 2000 mm.");
  }
  return { width, height };
}

export function createDxf({ width, height, productName, values, fieldSnapshot }) {
  const margin = Math.min(12, width * 0.04, height * 0.1);
  const usableWidth = width - margin * 2;
  const fields = (Array.isArray(fieldSnapshot) ? fieldSnapshot : [])
    .filter((field) => field && typeof field.key === "string")
    .slice(0, 3)
    .map((field) => ({ field, value: safeText(values?.[field.key]) }));
  const longestText = Math.max(5, ...fields.map(({ value }) => value.length), ...(!fields.some(({ value }) => value) ? [safeText(productName).length] : []));
  const mainSize = Math.min(height * 0.3, usableWidth / Math.max(5, longestText * 0.72));
  const labelSize = Math.max(3, Math.min(5, height * 0.055));
  const entities = [];
  const line = (x1, y1, x2, y2, layer) => {
    entities.push(pair(0, "LINE"), pair(8, layer), pair(10, x1), pair(20, y1), pair(30, 0), pair(11, x2), pair(21, y2), pair(31, 0));
  };
  const text = (value, x, y, size, layer) => {
    const content = safeText(value);
    if (!content) return;
    entities.push(pair(0, "TEXT"), pair(8, layer), pair(10, x), pair(20, y), pair(30, 0), pair(40, size), pair(1, content), pair(50, 0), pair(7, "STANDARD"), pair(72, 1), pair(73, 2), pair(11, x), pair(21, y), pair(31, 0));
  };

  line(0, 0, width, 0, "OUTLINE");
  line(width, 0, width, height, "OUTLINE");
  line(width, height, 0, height, "OUTLINE");
  line(0, height, 0, 0, "OUTLINE");
  const textPositions = [height * 0.66, height * 0.43, height * 0.24];
  const textSizes = [mainSize, Math.min(height * 0.14, mainSize * 0.55), Math.min(height * 0.1, mainSize * 0.42)];
  fields.forEach(({ value }, index) => text(value, width / 2, textPositions[index], textSizes[index], "ENGRAVE"));
  if (!fields.some(({ value }) => value)) text(productName, width / 2, height * 0.48, labelSize * 2, "ENGRAVE");

  return [
    pair(0, "SECTION"), pair(2, "HEADER"), pair(9, "$ACADVER"), pair(1, "AC1009"), pair(0, "ENDSEC"),
    pair(0, "SECTION"), pair(2, "TABLES"),
    pair(0, "TABLE"), pair(2, "LTYPE"), pair(70, 1),
    pair(0, "LTYPE"), pair(2, "CONTINUOUS"), pair(70, 0), pair(3, "Solid line"), pair(72, 65), pair(73, 0), pair(40, 0),
    pair(0, "ENDTAB"),
    pair(0, "TABLE"), pair(2, "STYLE"), pair(70, 1),
    pair(0, "STYLE"), pair(2, "STANDARD"), pair(70, 0), pair(40, 0), pair(41, 1), pair(50, 0), pair(71, 0), pair(42, 2.5), pair(3, "txt"), pair(4, ""),
    pair(0, "ENDTAB"),
    pair(0, "TABLE"), pair(2, "LAYER"), pair(70, 3),
    pair(0, "LAYER"), pair(2, "0"), pair(70, 0), pair(62, 7), pair(6, "CONTINUOUS"),
    pair(0, "LAYER"), pair(2, "OUTLINE"), pair(70, 0), pair(62, 7), pair(6, "CONTINUOUS"),
    pair(0, "LAYER"), pair(2, "ENGRAVE"), pair(70, 0), pair(62, 3), pair(6, "CONTINUOUS"),
    pair(0, "ENDTAB"), pair(0, "ENDSEC"),
    pair(0, "SECTION"), pair(2, "BLOCKS"), pair(0, "ENDSEC"),
    pair(0, "SECTION"), pair(2, "ENTITIES"), ...entities, pair(0, "ENDSEC"), pair(0, "EOF"),
  ].join("");
}
