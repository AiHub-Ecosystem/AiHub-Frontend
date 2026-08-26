"use client";

import { useState } from "react";
import Link from "next/link";
import { API_CATEGORIES, STATUS_LABELS } from "@/data/api-products";

export function DemoCatalog() {
  const [activeSlug, setActiveSlug] = useState(API_CATEGORIES[0]?.slug ?? "");
  const active = API_CATEGORIES.find((c) => c.slug === activeSlug);

  return (
    <div className="aihub-split">
      <div className="aihub-split-left">
        <p className="aihub-crumb-static">Danh mục sản phẩm</p>
        <h1 className="aihub-title">
          Cùng chinh phục các thử thách cùng hệ sinh thái API của AIHub
        </h1>
        <p className="aihub-lede">
          Chọn một danh mục để xem các giải pháp API chuyên biệt, rồi chạy thử ngay trên
          trình duyệt.
        </p>

        <ul className="aihub-catlist">
          {API_CATEGORIES.map((category) => (
            <li key={category.slug}>
              <button
                type="button"
                className="aihub-catitem"
                aria-current={category.slug === activeSlug}
                onClick={() => setActiveSlug(category.slug)}
              >
                <span className="aihub-card-name">{category.name}</span>
                <span className="aihub-card-desc">{category.description}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="aihub-split-right">
        {active && (
          <>
            <h2 className="aihub-category-name">{active.name}</h2>
            <p className="aihub-sublabel">Sản phẩm chi tiết</p>

            <ul className="aihub-prodlist">
              {active.products.map((product) => {
                const ready = product.hasDemo && product.demoReady;
                return (
                  <li
                    key={product.slug}
                    className="aihub-prodrow"
                    data-status={ready ? product.status : "coming-soon"}
                  >
                    <div>
                      <div className="aihub-card-top">
                        <span className="aihub-card-name">{product.name}</span>
                        <span
                          className="aihub-badge"
                          data-status={ready ? product.status : "coming-soon"}
                        >
                          {ready ? STATUS_LABELS[product.status] : STATUS_LABELS["coming-soon"]}
                        </span>
                      </div>
                      <p className="aihub-card-desc">{product.tagline}</p>
                    </div>
                    {ready && (
                      <Link className="aihub-cta" href={`/demo/${product.slug}`}>
                        Chi tiết ›
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
