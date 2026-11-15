import type { Metadata } from "next";
import Link from "next/link";
import { API_CATEGORIES, STATUS_LABELS, type ApiProduct } from "@/data/api-products";
import "../aihub.css";

export const metadata: Metadata = {
  title: "Document — AIHub",
  description: "Tài liệu các API AI của AIHub — tổng quan, cách tích hợp và API reference.",
};

function ProductCard({ slug, product }: { slug: string; product: ApiProduct }) {
  const available = product.status !== "coming-soon";
  const body = (
    <>
      <div className="aihub-card-top">
        <h3 className="aihub-card-name">{product.name}</h3>
        <span className="aihub-badge" data-status={product.status}>
          {STATUS_LABELS[product.status]}
        </span>
      </div>
      <p className="aihub-card-tagline">{product.tagline}</p>
      <p className="aihub-card-desc">{product.description}</p>
      <div className="aihub-card-foot">
        <span>
          {product.endpoints.length > 0
            ? `${product.endpoints.length} endpoint`
            : "Chưa công bố endpoint"}
        </span>
        {available && <span className="aihub-cta">Xem tài liệu ›</span>}
      </div>
    </>
  );

  if (!available) {
    return (
      <div className="aihub-card" data-status={product.status}>
        {body}
      </div>
    );
  }

  return (
    <Link className="aihub-card" data-status={product.status} href={`/product/${slug}`}>
      {body}
    </Link>
  );
}

export default function Page() {
  return (
    <div className="aihub">
      <div className="aihub-shell">
        <p className="aihub-eyebrow">Document</p>
        <h1 className="aihub-title">Tài liệu API của AIHub</h1>
        <p className="aihub-lede">
          Chọn một sản phẩm để xem tổng quan, các bước tích hợp và API reference — cùng dữ liệu
          dùng để tra cứu khi lập trình.
        </p>

        {API_CATEGORIES.map((category) => (
          <section className="aihub-category" key={category.slug}>
            <div className="aihub-category-head">
              <h2 className="aihub-category-name">{category.name}</h2>
              <p className="aihub-category-desc">{category.description}</p>
            </div>
            <div className="aihub-grid">
              {category.products.map((product) => (
                <ProductCard key={product.slug} slug={product.slug} product={product} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
