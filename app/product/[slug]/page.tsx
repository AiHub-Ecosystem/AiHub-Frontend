import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ALL_PRODUCTS, STATUS_LABELS, findProduct } from "@/data/api-products";
import { PRODUCT_DOCS } from "@/data/api-reference";
import "../../aihub.css";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return ALL_PRODUCTS.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = findProduct(slug);
  if (!product) return { title: "Không tìm thấy sản phẩm — AIHub" };
  return { title: `${product.name} — AIHub`, description: product.tagline };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const product = findProduct(slug);
  if (!product) notFound();
  const docs = PRODUCT_DOCS[slug];

  return (
    <div className="aihub">
      <div className="aihub-shell">
        <nav className="aihub-crumbs">
          <Link href="/product">Sản phẩm API</Link>
          <span aria-hidden="true">/</span>
          <span>{product.name}</span>
        </nav>

        <div className="aihub-card-top">
          <h1 className="aihub-title">{product.name}</h1>
          <span className="aihub-badge" data-status={product.status}>
            {STATUS_LABELS[product.status]}
          </span>
        </div>
        <p className="aihub-lede">{product.description}</p>

        <div className="aihub-shortcuts">
          {product.hasDemo && product.demoReady && (
            <Link className="aihub-card" href="/demo">
              <h3 className="aihub-card-name">Chạy thử</h3>
              <p className="aihub-card-desc">
                Thao tác từng bước trên trình duyệt và xem đúng những lệnh gọi
                mà backend thực hiện.
              </p>
              <span className="aihub-cta">Mở demo ›</span>
            </Link>
          )}
          <div className="aihub-card">
            <h3 className="aihub-card-name">Danh mục</h3>
            <p className="aihub-card-desc">{product.category.description}</p>
            <Link className="aihub-cta" href="/product">
              Xem tất cả sản phẩm ›
            </Link>
          </div>
        </div>

        {docs && (
          <section className="aihub-category">
            <div className="aihub-category-head">
              <h2 className="aihub-category-name">1. Tổng quan</h2>
              <p className="aihub-category-desc">{docs.overview.summary}</p>
            </div>
            <ul className="aihub-facts">
              {docs.overview.facts.map((fact) => (
                <li key={fact.label}>
                  <span className="aihub-facts-label">{fact.label}</span>
                  <span className="aihub-facts-value">{fact.value}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {docs && (
          <section className="aihub-category">
            <div className="aihub-category-head">
              <h2 className="aihub-category-name">2. Các bước tích hợp</h2>
              <p className="aihub-category-desc">
                Luồng tích hợp {product.name.toLowerCase()} vào hệ thống của
                bạn, theo từng bước dưới đây.
              </p>
            </div>
            <ol className="aihub-steps">
              {docs.steps.map((step) => (
                <li key={step.title}>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="aihub-category">
          <div className="aihub-category-head">
            <h2 className="aihub-category-name">3. API Reference</h2>
            <p className="aihub-category-desc">
              {product.endpoints.length > 0
                ? "Các endpoint tạo nên luồng tích hợp của sản phẩm này."
                : "Sản phẩm chưa công bố endpoint."}
            </p>
          </div>

          {product.endpoints.map((endpoint) => {
            const hasDetail = Boolean(docs?.reference[endpoint.slug]);
            const body = (
              <>
                <div className="aihub-endpoint-head">
                  <span className="aihub-method" data-method={endpoint.method}>
                    {endpoint.method}
                  </span>
                  <code className="aihub-path">{endpoint.path}</code>
                </div>
                <h3 className="aihub-card-name">{endpoint.name}</h3>
                <p className="aihub-card-desc">{endpoint.summary}</p>
                {hasDetail && <span className="aihub-cta">Xem chi tiết ›</span>}
              </>
            );
            return hasDetail ? (
              <Link
                className="aihub-endpoint"
                style={{
                  display: "block",
                  textDecoration: "none",
                  color: "inherit",
                }}
                key={endpoint.slug}
                href={`/product/${slug}/api/${endpoint.slug}`}
              >
                {body}
              </Link>
            ) : (
              <article className="aihub-endpoint" key={endpoint.slug}>
                {body}
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
