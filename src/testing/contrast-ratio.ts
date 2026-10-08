/** WCAG 2 contrast ratio between two hex colours — the formula the token gate measures with. */
export function contrastRatio(foreground: string, background: string): number {
  const l1 = luminance(foreground);
  const l2 = luminance(background);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);

  return (hi + 0.05) / (lo + 0.05);
}

function channels(hex: string): [number, number, number] {
  let h = hex.replace("#", "");

  if (h.length === 3) {
    h = [...h].map((c) => c + c).join("");
  }

  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;

    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
