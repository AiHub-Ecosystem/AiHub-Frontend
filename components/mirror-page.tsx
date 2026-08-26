import { readFileSync } from "node:fs";
import path from "node:path";
import { rewriteHomeBody } from "@/components/home-rewrites";
import { stripChrome } from "@/components/site-chrome";

export type MirrorPageName =
  | "home"
  | "about"
  | "blog"
  | "case-studies"
  | "community"
  | "connectors"
  | "contact"
  | "meltano-vs-fivetran"
  | "podcasts"
  | "pricing"
  | "pricingcalculator"
  | "privacy-policy"
  | "product"
  | "terms-of-service";

export function MirrorPage({ name }: { name: MirrorPageName }) {
  const file = path.join(process.cwd(), "data", "mirror", `${name}.html`);
  let html: string;
  try {
    html = stripChrome(readFileSync(file, "utf8"));
    if (name === "home") html = rewriteHomeBody(html);
  } catch {
    // data/mirror không được version — xem .gitignore. Trang nào chưa được thay
    // bằng bản viết tay thì hiện chỗ trống thay vì làm sập build.
    return (
      <div id="__next">
        <div className="container ml-margins" style={{ padding: "120px 0" }}>
          <p>Nội dung mirror của trang “{name}” không có trên máy này.</p>
        </div>
      </div>
    );
  }
  return <div id="__next" dangerouslySetInnerHTML={{ __html: html }} />;
}
