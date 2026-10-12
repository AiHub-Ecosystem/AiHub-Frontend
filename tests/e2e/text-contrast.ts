import type { Page } from "@playwright/test";

/**
 * A page can render, grade correctly and still be unreadable. A global
 * stylesheet belonging to an unrelated site theme paints bare `h2` and `h3`
 * white; on this page's light card that made a heading invisible until
 * selected. Nothing else in the suite would have noticed.
 *
 * So this walks every text leaf inside the demo root and compares it against
 * the background it actually sits on, compositing alpha rather than trusting
 * the nearest declared colour. Scoping to the demo root matters: the site
 * header and footer are not this page's responsibility and sit on a dark
 * backdrop, so walking the whole document reports them as unreadable.
 */
export interface UnreadableText {
  text: string;
  selector: string;
  color: string;
  background: string;
  ratio: number;
  floor: number;
}

const WCAG_AA = 4.5;
const WCAG_AA_LARGE = 3;

export async function unreadableText(page: Page): Promise<UnreadableText[]> {
  return page.evaluate(
    ({ aa, aaLarge }) => {
      const parse = (value: string) => {
        const parts = value.match(/[\d.]+/g);
        if (!parts) return null;
        return {
          r: Number(parts[0]),
          g: Number(parts[1]),
          b: Number(parts[2]),
          a: parts[3] === undefined ? 1 : Number(parts[3]),
        };
      };
      const over = (fg: number, bg: number, alpha: number) =>
        fg * alpha + bg * (1 - alpha);

      const luminance = (c: { r: number; g: number; b: number }) => {
        const ch = (v: number) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
      };

      const root = document.querySelector<HTMLElement>(
        ".aihub-demo-flow, .aihub-demo"
      );
      if (!root) throw new Error("the demo root is missing");

      // Composite every layer down to the first fully opaque one, so a
      // translucent panel over a dark page is judged as the colour it renders.
      const backgroundOf = (
        el: Element
      ): { r: number; g: number; b: number } => {
        const layers: Array<{ r: number; g: number; b: number; a: number }> =
          [];
        let node: Element | null = el;
        while (node) {
          const c = parse(getComputedStyle(node).backgroundColor);
          if (c && c.a > 0) {
            layers.push(c);
            if (c.a === 1) break;
          }
          node = node.parentElement;
        }
        let out = { r: 255, g: 255, b: 255 };
        for (const layer of layers.reverse()) {
          out = {
            r: over(layer.r, out.r, layer.a),
            g: over(layer.g, out.g, layer.a),
            b: over(layer.b, out.b, layer.a),
          };
        }
        return out;
      };

      const describe = (el: Element) => {
        const id = el.id ? `#${el.id}` : "";
        const cls =
          typeof el.className === "string" && el.className.trim()
            ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}`
            : "";
        return `${el.tagName.toLowerCase()}${id}${cls}`;
      };

      const bad: Array<{
        text: string;
        selector: string;
        color: string;
        background: string;
        ratio: number;
        floor: number;
      }> = [];

      const visit = (el: Element) => {
        for (const child of Array.from(el.children)) {
          const text = Array.from(child.childNodes)
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => n.textContent ?? "")
            .join("")
            .trim();
          if (text) {
            const style = getComputedStyle(child);
            const fgRaw = parse(style.color);
            const bg = backgroundOf(child);
            if (fgRaw) {
              const fg = {
                r: over(fgRaw.r, bg.r, fgRaw.a),
                g: over(fgRaw.g, bg.g, fgRaw.a),
                b: over(fgRaw.b, bg.b, fgRaw.a),
              };
              const l1 = luminance(fg);
              const l2 = luminance(bg);
              const ratio =
                (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
              const size = parseFloat(style.fontSize);
              const bold = Number(style.fontWeight) >= 700;
              const floor =
                size >= 24 || (size >= 18.66 && bold) ? aaLarge : aa;
              if (ratio < floor) {
                bad.push({
                  text: text.slice(0, 60),
                  selector: describe(child),
                  color: `rgb(${fg.r.toFixed(0)}, ${fg.g.toFixed(0)}, ${fg.b.toFixed(0)})`,
                  background: `rgb(${bg.r.toFixed(0)}, ${bg.g.toFixed(0)}, ${bg.b.toFixed(0)})`,
                  ratio: Math.round(ratio * 100) / 100,
                  floor,
                });
              }
            }
          }
          visit(child);
        }
      };
      visit(root);
      return bad;
    },
    { aa: WCAG_AA, aaLarge: WCAG_AA_LARGE }
  ) as Promise<UnreadableText[]>;
}

/** Throws with the offending leaves named, so a failure says which text. */
export function expectReadable(page: Page) {
  return unreadableText(page).then((bad) => {
    if (bad.length === 0) return;
    const detail = bad
      .map(
        (b) =>
          `  ${b.ratio}:1 (needs ${b.floor}) ${b.selector} "${b.text}" ${b.color} on ${b.background}`
      )
      .join("\n");
    throw new Error(
      `${bad.length} text leaves below the contrast floor:\n${detail}`
    );
  });
}
