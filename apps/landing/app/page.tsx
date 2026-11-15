import { readFileSync } from "node:fs";
import path from "node:path";
import { rewriteHomeBody } from "../lib/home-rewrites";

export default function LandingPage() {
  const source = readFileSync(
    path.join(process.cwd(), "data/home.html"),
    "utf8"
  );
  const headerEnd = source.indexOf("</header>");
  const footerStart = source.lastIndexOf("<footer");
  const body = rewriteHomeBody(
    source.slice(
      headerEnd < 0 ? 0 : headerEnd + 9,
      footerStart < 0 ? source.length : footerStart
    )
  )
    .replaceAll('href="/product', 'href="/app/product')
    .replaceAll('href="/demo', 'href="/app/demo')
    .replaceAll('src="/meltano-mirror/', 'src="/app/meltano-mirror/')
    .replaceAll('src="/assets/', 'src="/app/assets/');

  return <div dangerouslySetInnerHTML={{ __html: body }} />;
}
