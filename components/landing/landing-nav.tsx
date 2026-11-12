import Link from "next/link";

const NAV = [
  { label: "Sản phẩm", href: "/product" },
  { label: "Tài liệu", href: "/docs" },
  { label: "Bảng giá", href: "#bang-gia" },
  { label: "Demo", href: "/demo" },
];

export function LandingLogo() {
  return (
    <Link href="/" className="al-logo" aria-label="AiHub trang chủ">
      <span className="al-logo-mark">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </span>
      <span className="al-logo-word">AiHub</span>
    </Link>
  );
}

export function LandingNav({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="al-nav-bar">
      <nav aria-label="Chính" className="al-nav">
        <LandingLogo />
        <div className="al-nav-links">
          {NAV.map((item) => (
            <Link key={item.label} href={item.href}>
              {item.label}
            </Link>
          ))}
        </div>
        <div className="al-nav-actions">
          <span className="al-status al-mono al-muted">
            <span className="al-pulse" />
            API hoạt động
          </span>
          {signedIn ? (
            <Link href="/console" className="al-btn al-btn-primary al-btn-sm">
              Console
            </Link>
          ) : (
            <>
              <Link href="/login" className="al-btn al-btn-line al-btn-sm">
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="al-btn al-btn-primary al-btn-sm"
              >
                Lấy API key
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
