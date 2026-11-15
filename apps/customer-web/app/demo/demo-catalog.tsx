import Link from "next/link";
import { API_CATEGORIES, STATUS_LABELS } from "@/data/api-products";

export function DemoCatalog() {
  return (
    <div className="aihub-demo-catalog">
      <div className="aihub-demo-intro">
        <p className="aihub-crumb-static">Danh mục sản phẩm</p>
        <h1 className="aihub-title">
          Cùng chinh phục các thử thách cùng hệ sinh thái API của AIHub
        </h1>
        <p className="aihub-lede">
          Chọn một danh mục để xem các giải pháp API chuyên biệt, rồi chạy thử ngay trên
          trình duyệt.
        </p>
      </div>

      <div className="aihub-demo-category-grid">
        {API_CATEGORIES.map((category) => (
          <section className="aihub-demo-category" key={category.slug}>
            <div className="aihub-demo-category-head">
              <p className="aihub-eyebrow">API category</p>
              <h2>{category.name}</h2>
              <p>{category.description}</p>
            </div>
            <ul className="aihub-demo-product-list">
              {category.products.map((product) => {
                const ready = product.hasDemo && product.demoReady;
                return (
                  <li className="aihub-demo-product" data-status={ready ? product.status : "coming-soon"} key={product.slug}>
                    <div>
                      <div className="aihub-card-top">
                        <h3 className="aihub-card-name">{product.name}</h3>
                        <span className="aihub-badge" data-status={ready ? product.status : "coming-soon"}>
                          {ready ? STATUS_LABELS[product.status] : STATUS_LABELS["coming-soon"]}
                        </span>
                      </div>
                      <p className="aihub-card-desc">{product.tagline}</p>
                    </div>
                    {ready && <Link className="aihub-cta" href={`/demo/${product.slug}`}>Mở demo <span aria-hidden="true">→</span></Link>}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
