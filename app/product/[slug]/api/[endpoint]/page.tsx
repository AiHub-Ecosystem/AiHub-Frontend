import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ALL_PRODUCTS, findProduct } from "@/data/api-products";
import { COMMON_ERROR_RESPONSES, PRODUCT_DOCS } from "@/data/api-reference";
import { ReferenceTabs } from "../reference-tabs";
import "../../../../aihub.css";

type Props = { params: Promise<{ slug: string; endpoint: string }> };

export function generateStaticParams() {
  return ALL_PRODUCTS.flatMap((product) => {
    const docs = PRODUCT_DOCS[product.slug];
    if (!docs) return [];
    return Object.keys(docs.reference).map((endpoint) => ({ slug: product.slug, endpoint }));
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, endpoint } = await params;
  const product = findProduct(slug);
  const ref = PRODUCT_DOCS[slug]?.reference[endpoint];
  const meta = product?.endpoints.find((e) => e.slug === endpoint);
  if (!product || !ref || !meta) return { title: "Không tìm thấy endpoint — AIHub" };
  return { title: `${meta.name} — ${product.name} — AIHub`, description: meta.summary };
}

function curl(method: string, url: string, body: unknown) {
  return `curl -X ${method} '${url}' \\\n  -H 'Content-Type: application/json' \\\n  -d '${JSON.stringify(body, null, 2)}'`;
}

export default async function Page({ params }: Props) {
  const { slug, endpoint } = await params;
  const product = findProduct(slug);
  const docs = PRODUCT_DOCS[slug];
  const ref = docs?.reference[endpoint];
  const meta = product?.endpoints.find((e) => e.slug === endpoint);
  if (!product || !docs || !ref || !meta) notFound();

  const baseUrlFact = docs.overview.facts.find((f) => f.label === "Base URL")?.value ?? "";
  const fullUrl = meta.path.startsWith("/internal") ? meta.path : `https://${baseUrlFact}${meta.path}`;
  const requestCode = curl(meta.method, fullUrl, ref.requestExample);
  const responseCode = JSON.stringify(ref.responseExample, null, 2);

  return (
    <div className="aihub">
      <div className="aihub-shell">
        <nav className="aihub-crumbs">
          <Link href="/product">Sản phẩm API</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/product/${slug}`}>{product.name}</Link>
          <span aria-hidden="true">/</span>
          <span>{meta.name}</span>
        </nav>

        <div className="aihub-endpoint-head">
          <span className="aihub-method" data-method={meta.method}>
            {meta.method}
          </span>
          <code className="aihub-path">{fullUrl}</code>
        </div>
        <h1 className="aihub-title" style={{ fontSize: "clamp(24px, 3vw, 34px)" }}>
          {meta.name}
        </h1>
        <p className="aihub-lede">{meta.summary}</p>

        <div className="aihub-refdetail">
          <div>
            <h2 className="aihub-category-name">Request</h2>
            <table className="aihub-schema">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Type</th>
                  <th>Bắt buộc</th>
                  <th>Mô tả</th>
                </tr>
              </thead>
              <tbody>
                {ref.requestFields.map((f) => (
                  <tr key={f.name}>
                    <td>{f.name}</td>
                    <td>{f.type}</td>
                    <td>
                      {f.required ? (
                        <span className="aihub-required">BẮT BUỘC</span>
                      ) : (
                        <span className="aihub-optional">tuỳ chọn</span>
                      )}
                    </td>
                    <td>{f.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2 className="aihub-category-name" style={{ marginTop: 28 }}>
              Response
            </h2>
            <p className="aihub-card-desc">{ref.responseDescription}</p>

            {ref.notes.length > 0 && (
              <>
                <h2 className="aihub-category-name" style={{ marginTop: 28 }}>
                  Lưu ý
                </h2>
                <ul className="aihub-notes">
                  {ref.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div>
            <ReferenceTabs requestCode={requestCode} responseCode={responseCode} />
          </div>
        </div>

        <section className="aihub-category">
          <div className="aihub-category-head">
            <h2 className="aihub-category-name">Lỗi thường gặp</h2>
            <p className="aihub-category-desc">
              Áp dụng chung cho các endpoint sinh bài tập trong docs/doc-api-micro.md.
            </p>
          </div>
          {COMMON_ERROR_RESPONSES.map((err) => (
            <article className="aihub-endpoint" key={err.status}>
              <div className="aihub-endpoint-head">
                <span className="aihub-status" data-tone={err.tone}>
                  {err.status}
                </span>
                <strong>{err.title}</strong>
              </div>
              <p className="aihub-card-desc">{err.description}</p>
              <pre className="aihub-code" style={{ marginTop: 10 }}>
                {JSON.stringify(err.example, null, 2)}
              </pre>
            </article>
          ))}
        </section>

        <div style={{ marginTop: 32 }}>
          <Link className="aihub-cta" href={`/product/${slug}`}>
            ‹ Quay lại {product.name}
          </Link>
        </div>
      </div>
    </div>
  );
}
