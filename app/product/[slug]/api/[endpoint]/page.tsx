import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ALL_PRODUCTS, findProduct } from "@/data/api-products";
import {
  PRODUCT_DOCS,
  type RequestHeader,
  type SchemaField,
} from "@/data/api-reference";
import { ReferenceTabs } from "../reference-tabs";
import "../../../../aihub.css";

type Props = { params: Promise<{ slug: string; endpoint: string }> };

export function generateStaticParams() {
  return ALL_PRODUCTS.flatMap((product) => {
    const docs = PRODUCT_DOCS[product.slug];
    if (!docs) return [];
    return Object.keys(docs.reference).map((endpoint) => ({
      slug: product.slug,
      endpoint,
    }));
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, endpoint } = await params;
  const product = findProduct(slug);
  const ref = PRODUCT_DOCS[slug]?.reference[endpoint];
  const meta = product?.endpoints.find((e) => e.slug === endpoint);
  if (!product || !ref || !meta)
    return { title: "Không tìm thấy endpoint — AIHub" };
  return {
    title: `${meta.name} — ${product.name} — AIHub`,
    description: meta.summary,
  };
}

/** Giá trị mẫu do tác giả viết, nên ký tự shell phải được vô hiệu hoá. */
function escapeSampleValue(value: string) {
  return value.replace(/([\\"$`])/g, "\\$1");
}

function curl(
  method: string,
  url: string,
  headers: RequestHeader[],
  body: unknown,
  formFields: SchemaField[]
) {
  const lines = [`curl -X ${method} '${url}'`];
  for (const header of headers) {
    lines.push(`  -H "${header.name}: ${header.value}"`);
  }
  for (const field of formFields) {
    // `formValue` is written to reference a shell variable, so it is left
    // alone; a `sampleValue` is copied verbatim and must be quoted literally.
    const value =
      field.formValue ??
      (field.sampleValue && escapeSampleValue(field.sampleValue));
    if (value === undefined) continue;
    lines.push(`  -F "${field.name}=${value}"`);
  }
  if (formFields.length === 0 && body !== null && body !== undefined) {
    lines.push(`  -d '${JSON.stringify(body, null, 2)}'`);
  }
  return lines.join(" \\\n");
}

export default async function Page({ params }: Props) {
  const { slug, endpoint } = await params;
  const product = findProduct(slug);
  const docs = PRODUCT_DOCS[slug];
  const ref = docs?.reference[endpoint];
  const meta = product?.endpoints.find((e) => e.slug === endpoint);
  if (!product || !docs || !ref || !meta) notFound();

  // The catalog documents a query parameter as `{name}`; the generated example
  // substitutes the field's sample value so the command is runnable as written.
  const examplePath = meta.path.replace(/\{(\w+)\}/g, (placeholder, name) => {
    const field = ref.requestFields.find(
      (candidate) => candidate.name === name
    );
    return field?.sampleValue ?? placeholder;
  });
  const fullUrl = meta.path.startsWith("/internal")
    ? meta.path
    : `https://${docs.overview.baseUrl}${examplePath}`;
  const headers = ref.headers ?? docs.headers;
  const multipartFields = ref.requestBody === "form" ? ref.requestFields : [];
  // An endpoint that declares its own failures replaces the product's
  // wholesale — including dropping the retry policy, which otherwise leaks
  // through the shallow merge and would describe grading runs this operation
  // cannot have.
  const errors = ref.errors
    ? { ...docs.errors, ...ref.errors, retryPolicy: ref.errors.retryPolicy }
    : docs.errors;
  const requestCode = [
    ...(ref.requestPreamble ?? []),
    curl(meta.method, fullUrl, headers, ref.requestExample, multipartFields),
  ].join("\n");
  const responseCode = JSON.stringify(ref.responseExample, null, 2);
  const showsSampleValues = ref.requestFields.some(
    (field) => field.sampleValue !== undefined
  );

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
        <h1
          className="aihub-title"
          style={{ fontSize: "clamp(24px, 3vw, 34px)" }}
        >
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
                  {showsSampleValues && <th>Giá trị mẫu</th>}
                  <th>Bắt buộc</th>
                  <th>Mô tả</th>
                </tr>
              </thead>
              <tbody>
                {ref.requestFields.map((f) => (
                  <tr key={f.name}>
                    <td>{f.name}</td>
                    <td>{f.type}</td>
                    {showsSampleValues && (
                      <td>
                        <code>{f.sampleValue ?? ""}</code>
                      </td>
                    )}
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
            <ReferenceTabs
              requestCode={requestCode}
              responseCode={responseCode}
            />
          </div>
        </div>

        <section className="aihub-category">
          <div className="aihub-category-head">
            <h2 className="aihub-category-name">Lỗi thường gặp</h2>
            <p className="aihub-category-desc">{errors.intro}</p>
          </div>
          {errors.retryPolicy && (
            <div className="aihub-endpoint">
              <strong>Chính sách retry</strong>
              <ul className="aihub-notes">
                {errors.retryPolicy.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </div>
          )}
          {errors.items.map((err) => (
            <article
              className="aihub-endpoint"
              key={`${err.status}:${err.code ?? ""}`}
            >
              <div className="aihub-endpoint-head">
                <span className="aihub-status" data-tone={err.tone}>
                  {err.status}
                </span>
                {err.code && <code>{err.code}</code>}
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
