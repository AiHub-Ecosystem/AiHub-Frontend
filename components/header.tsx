"use client";

import { useState } from "react";
import Link from "next/link";
import { AiHubLogo } from "@/components/svg/brand";
import {
  ArrowRightIcon,
  CloseIcon,
  GithubIcon,
  MenuIcon,
} from "@/components/svg/icons";
import { navCompany, navProduct, navResources, type NavGroup } from "@/data/site";

type MenuKey = "product" | "resources" | "company" | null;

function MegaMenu({ group }: { group: NavGroup }) {
  return (
    <div className="absolute left-1/2 top-full z-50 w-[560px] -translate-x-1/2 pt-4">
      <div className="overflow-hidden rounded-2xl border border-line bg-card p-4 shadow-2xl dark:shadow-black/60">
        <div className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-widest text-soft">
          {group.title}
        </div>
        <div className="grid grid-cols-1">
          {group.links.map((link) => (
            <Link
              key={link.label + link.href}
              href={link.href}
              className="group flex items-start justify-between gap-4 rounded-xl px-3 py-2.5 transition-colors hover:bg-brand-blue/10"
            >
              <span>
                <span className="block font-semibold text-ink transition-colors group-hover:text-brand-blue">
                  {link.label}
                </span>
                {link.description && (
                  <span className="block text-sm text-soft">{link.description}</span>
                )}
              </span>
              <ArrowRightIcon className="mt-1 h-4 w-4 shrink-0 text-brand-blue opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Header() {
  const [openMenu, setOpenMenu] = useState<MenuKey>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const linkBase =
    "rounded-full px-3 py-2 text-sm font-semibold transition-colors hover:text-brand-blue";

  const close = () => {
    setOpenMenu(null);
    setMobileOpen(false);
  };

  return (
    <header className="meltano-header fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" className="shrink-0 text-ink" onClick={close}>
          <AiHubLogo />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          <div
            className="relative"
            onMouseEnter={() => setOpenMenu("product")}
            onMouseLeave={() => setOpenMenu(null)}
          >
            <button className={`${linkBase} ${openMenu === "product" ? "text-brand-blue" : ""}`}>
              Sản phẩm
            </button>
            {openMenu === "product" && <MegaMenu group={navProduct} />}
          </div>

          <Link href="/specs" className={`${linkBase} flex items-center gap-1.5 font-bold text-brand-cyan`} onClick={close}>
            <span>⚡ Spec & cURL Hub</span>
            <span className="rounded-full bg-brand-cyan/20 px-2 py-0.5 text-[10px] font-black uppercase text-brand-cyan">
              Live
            </span>
          </Link>

          <Link href="/lab" className={`${linkBase} flex items-center gap-1.5 font-bold text-brand-blue`} onClick={close}>
            <span>🧪 Academic Lab</span>
            <span className="rounded-full bg-brand-blue/20 px-2 py-0.5 text-[10px] font-black uppercase text-brand-blue">
              Review
            </span>
          </Link>

          <Link href="/demo" className={linkBase} onClick={close}>
            🎮 Demo
          </Link>

          <Link href="/pricing" className={linkBase} onClick={close}>
            Bảng giá
          </Link>

          <div
            className="relative"
            onMouseEnter={() => setOpenMenu("resources")}
            onMouseLeave={() => setOpenMenu(null)}
          >
            <button className={`${linkBase} ${openMenu === "resources" ? "text-brand-blue" : ""}`}>
              Tài nguyên
            </button>
            {openMenu === "resources" && <MegaMenu group={navResources} />}
          </div>

          <div
            className="relative"
            onMouseEnter={() => setOpenMenu("company")}
            onMouseLeave={() => setOpenMenu(null)}
          >
            <button className={`${linkBase} ${openMenu === "company" ? "text-brand-blue" : ""}`}>
              Về AiHub
            </button>
            {openMenu === "company" && <MegaMenu group={navCompany} />}
          </div>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/specs"
            className="hidden items-center justify-center rounded-full border border-brand-cyan/40 px-3.5 py-1.5 text-xs font-bold text-brand-cyan transition-colors hover:bg-brand-cyan/10 sm:flex"
          >
            ⚡ Spec & cURL Hub
          </Link>

          <Link
            href="/lab"
            className="hidden items-center justify-center rounded-full border border-brand-blue/40 px-3.5 py-1.5 text-xs font-bold text-brand-blue transition-colors hover:bg-brand-blue/10 sm:flex"
          >
            🧪 Phòng Lab
          </Link>

          <Link
            href="/demo"
            className="btn-gradient hidden rounded-full px-4 py-2 text-xs font-bold text-white md:inline-flex"
          >
            Trải nghiệm Demo
          </Link>

          <button
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink lg:hidden"
          >
            {mobileOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-line bg-card lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4">
            <Link href="/lab" className="flex items-center justify-between rounded-lg bg-brand-blue/10 px-3 py-2.5 font-bold text-brand-blue" onClick={close}>
              <span>🧪 Phòng Lab Academic</span>
              <span className="rounded bg-brand-blue text-[10px] text-white px-1.5 py-0.5">REVIEW TOOL</span>
            </Link>
            <Link href="/demo" className="rounded-lg px-3 py-2.5 font-semibold hover:bg-brand-blue/10" onClick={close}>
              🎮 Interactive Demo AIHub
            </Link>
            <Link href="/product" className="rounded-lg px-3 py-2.5 font-semibold hover:bg-brand-blue/10" onClick={close}>
              Sản phẩm & API Specs
            </Link>
            <Link href="/pricing" className="rounded-lg px-3 py-2.5 font-semibold hover:bg-brand-blue/10" onClick={close}>
              Bảng giá API
            </Link>
            <Link href="/about" className="rounded-lg px-3 py-2.5 font-semibold hover:bg-brand-blue/10" onClick={close}>
              Giới thiệu
            </Link>
            <Link
              href="/demo"
              className="btn-gradient mt-2 rounded-full px-5 py-3 text-center text-sm font-bold text-white"
              onClick={close}
            >
              Bắt đầu Demo ngay
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
