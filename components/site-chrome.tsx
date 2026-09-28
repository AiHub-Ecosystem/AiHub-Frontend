import { readFileSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import { cookies } from "next/headers";
import { getWebSession, WEB_SESSION_COOKIE } from "@/lib/auth-session";

/**
 * Header và footer giống hệt nhau từng byte trên cả 14 trang mirror, nên ta
 * lấy một bản từ home.html rồi render chung ở layout. Nhờ vậy sửa nav một chỗ
 * là áp dụng cho toàn site, thay vì phải sửa 14 file HTML.
 */

const CHROME_SOURCE = path.join(process.cwd(), "data", "mirror", "home.html");

const HEADER_END = "</header>";
const FOOTER_START = "<footer";

/** Nav gốc của Meltano, viết lại theo cấu trúc AIHub. */
const NAV_REWRITES = [
  {
    find: '<li class="has-sub has-sub-items mobile-menu-item--active"><a href="/product">',
    replaceWith: '<li><a href="/product">Document</a></li>',
  },
  {
    // Resources trỏ sang docs.meltano.com kèm query string tracking của HubSpot.
    find: '<li class="has-sub has-sub-items"><a href="https://docs.meltano.com/?',
    replaceWith:
      '<li><a href="/docs">Hướng dẫn</a></li><li><a href="/demo">Demo</a></li><li><a href="/lab">Lab</a></li>',
  },
  // Tạm ẩn Connectors và Company khỏi nav — chưa có nội dung AIHub cho 2 mục
  // này. Route vẫn còn, chỉ ẩn lối vào từ nav; xoá replaceWith rỗng để bật lại.
  {
    find: '<li class="hide-m"><a href="/connectors">Connectors</a></li>',
    replaceWith: "",
  },
  {
    find: '<li class="has-sub hide-d has-one-sub"><a href="/connectors">Connectors</a>',
    replaceWith: "",
  },
  {
    find: '<li class="has-sub has-one-sub"><a href="/about">Company</a>',
    replaceWith: "",
  },
];

/** Thay nguyên chuỗi, dùng cho phần nằm ngoài `<nav>`. */
const TEXT_REWRITES = [
  {
    // Trùng với mục "Demo" đã có trong nav — bỏ hẳn nút này thay vì đổi chữ.
    find:
      '<a href="https://meetings.hubspot.com/kyle-john" target="_blank" ' +
      'id="get-started-btn" class="btn clear-btn" rel="noreferrer">Book a demo</a>',
    replaceWith: "",
  },
];

const FOOTER_TEXT_REWRITES = [
  {
    find: '<p class="p3">Stay current with all things Meltano</p>',
    replaceWith: '<p class="p3">Stay current with all things AiHub</p>',
  },
  {
    find: '<div class="footer-col"><div class="footer-col-info"><p class="footer-col-title">Product</p><ul><li><a href="/product"><p class="footer-list-title">Overview</p><p class="footer-list-info">The only EL tool built for data engineers</p></a></li><li><a href="https://sdk.meltano.com/en/latest/" target=""><p class="footer-list-title">Meltano/SDK</p><p class="footer-list-info">Build a connector for any data source under the sun</p></a></li><li><a href="https://edk.meltano.com/en/latest/" target=""><p class="footer-list-title">Meltano/EDK</p><p class="footer-list-info">Integrate any existing data tool for any data source</p></a></li><li><a href="https://hub.meltano.com/extractors/" target=""><p class="footer-list-title">Meltano/Hub</p><p class="footer-list-info">Connectors for 600+ sources and destinations</p></a></li><li><a href="/meltano-vs-fivetran"><p class="footer-list-title">Meltano vs Fivetran</p><p class="footer-list-info">See how much you&#x27;d save by leaving Fivetran</p></a></li></ul></div></div>',
    replaceWith:
      '<div class="footer-col"><div class="footer-col-info"><p class="footer-col-title">Product</p><ul><li><a href="/product"><p class="footer-list-title">Overview</p><p class="footer-list-info">AI API ecosystem platform for education</p></a></li><li><a href="/product/exercise-generation"><p class="footer-list-title">Exercise Generation</p><p class="footer-list-info">Generate targeted writing exercises from learner errors</p></a></li><li><a href="/demo"><p class="footer-list-title">Interactive Demo</p><p class="footer-list-info">Experience AiHub APIs directly in your browser</p></a></li><li><a href="/product"><p class="footer-list-title">API Reference</p><p class="footer-list-info">Complete OpenAPI contracts and schema definitions</p></a></li></ul></div></div>',
  },
  {
    find: '<div class="footer-col"><div class="footer-col-info"><p class="footer-col-title">Resources</p><ul><li><a href="https://docs.meltano.com/" target="_blank"><p class="footer-list-title">Documentation</p><p class="footer-list-info">Learn how to use Meltano and where to get started</p></a></li><li><a href="/community"><p class="footer-list-title">Community</p><p class="footer-list-info">Join 5,500+ data professionals on Slack and GitHub</p></a></li><li><a href="/blog"><p class="footer-list-title">Blog</p><p class="footer-list-info">Stay up to date on Meltano &amp; data engineering</p></a></li><li><a href="/case-studies"><p class="footer-list-title">Case studies</p><p class="footer-list-info">Real-world stories from teams building with Meltano</p></a></li><li><a href="/podcasts"><p class="footer-list-title">Podcasts</p><p class="footer-list-info">Conversations with data engineers and practitioners</p></a></li></ul></div></div>',
    replaceWith:
      '<div class="footer-col"><div class="footer-col-info"><p class="footer-col-title">Resources</p><ul><li><a href="/docs"><p class="footer-list-title">Hướng dẫn tích hợp</p><p class="footer-list-info">Từng bước đưa AiHub vào hệ thống của bạn</p></a></li><li><a href="/product"><p class="footer-list-title">API reference</p><p class="footer-list-info">Endpoint, request schema và lỗi của từng API</p></a></li><li><a href="/community"><p class="footer-list-title">Community</p><p class="footer-list-info">Join developers and educators building with AiHub</p></a></li><li><a href="/blog"><p class="footer-list-title">Blog</p><p class="footer-list-info">Stay up to date on AiHub &amp; AI engineering</p></a></li><li><a href="/case-studies"><p class="footer-list-title">Case studies</p><p class="footer-list-info">Real-world stories from teams building with AiHub</p></a></li><li><a href="/podcasts"><p class="footer-list-title">Podcasts</p><p class="footer-list-info">Conversations with AI engineers and practitioners</p></a></li></ul></div></div>',
  },
  {
    find: '<div class="footer-col"><div class="footer-col-info"><p class="footer-col-title">Company</p><ul><li><a href="/about"><p class="footer-list-title">About</p><p class="footer-list-info">Meltano is an open source project by Matatika</p></a></li><li><a href="/contact"><p class="footer-list-title">Contact</p><p class="footer-list-info">The Meltano team is here to help. Ask us anything, or give us your feedback!</p></a></li></ul></div></div>',
    replaceWith:
      '<div class="footer-col"><div class="footer-col-info"><p class="footer-col-title">Company</p><ul><li><a href="/about"><p class="footer-list-title">About</p><p class="footer-list-info">AiHub is an AI API ecosystem platform</p></a></li><li><a href="/contact"><p class="footer-list-title">Contact</p><p class="footer-list-info">The AiHub team is here to help. Ask us anything, or give us your feedback!</p></a></li></ul></div></div>',
  },
  {
    find: '<a href="/">© Meltano 2026</a>',
    replaceWith: '<a href="/">© AiHub 2026</a>',
  },
  {
    find: 'href="https://github.com/meltano/meltano"',
    replaceWith: 'href="https://github.com"',
  },
  {
    find: 'aria-label="Meltano on GitHub"',
    replaceWith: 'aria-label="AiHub on GitHub"',
  },
  {
    find: 'href="https://meltano.com/slack"',
    replaceWith: 'href="https://slack.com"',
  },
  {
    find: 'aria-label="Meltano Community on Slack"',
    replaceWith: 'aria-label="AiHub Community on Slack"',
  },
  {
    find: 'href="https://twitter.com/meltanodata"',
    replaceWith: 'href="https://twitter.com"',
  },
  { find: 'aria-label="Meltano on X"', replaceWith: 'aria-label="AiHub on X"' },
  {
    find: 'href="https://www.linkedin.com/company/meltano/ "',
    replaceWith: 'href="https://linkedin.com"',
  },
  {
    find: 'aria-label="Meltano on LinkedIn"',
    replaceWith: 'aria-label="AiHub on LinkedIn"',
  },
  {
    find: 'href="https://www.youtube.com/@meltano"',
    replaceWith: 'href="https://youtube.com"',
  },
  {
    find: 'aria-label="Matatika on YouTube"',
    replaceWith: 'aria-label="AiHub on YouTube"',
  },
  {
    find: 'href="https://www.crunchbase.com/organization/matatika"',
    replaceWith: 'href="https://crunchbase.com"',
  },
  {
    find: 'aria-label="Matatika on Crunchbase"',
    replaceWith: 'aria-label="AiHub on Crunchbase"',
  },
  {
    find: '<a href="https://docs.meltano.com/" target="_blank" class="portal-bottom portal-meltano" rel="noreferrer" aria-label="Open Meltano documentation">',
    replaceWith:
      '<a href="/product" class="portal-bottom portal-meltano" aria-label="Xem tài liệu AiHub">',
  },
];

function wordmark(fontSize: number) {
  return (
    `<span class="aihub-logo-text" style="font-weight:800;font-size:${fontSize}px;letter-spacing:-0.02em;` +
    `font-family:inherit;line-height:1">Ai<span style="color:#3a64fa">Hub</span></span>`
  );
}

/**
 * Logo là SVG vẽ tay chữ "meltano" (không phải text), nên không thể string-
 * replace từng chữ. Có 2 bản: một trong header (`aria-label="Go to Meltano
 * homepage"`), một trong footer (`class="footer-logo"`, không có aria-label
 * riêng). Thay cả hai bằng cùng một wordmark chữ. Đã xác nhận cả hai khối đều
 * không có `<a>` lồng bên trong nên chỉ cần tìm `</a>` đầu tiên sau điểm bắt
 * đầu, không cần đếm độ sâu như endOfListItem.
 */
function replaceLogoBlock(
  html: string,
  marker: string,
  fontSize: number,
  ariaLabel: string
): string {
  const markerAt = html.indexOf(marker);
  if (markerAt === -1) return html;
  const start = html.lastIndexOf("<a", markerAt);
  const end = html.indexOf("</a>", markerAt) + 4;
  if (start === -1 || end === 3) return html;
  return (
    html.slice(0, start) +
    `<a aria-label="${ariaLabel}" href="/">${wordmark(fontSize)}</a>` +
    html.slice(end)
  );
}

function replaceLogo(header: string): string {
  return replaceLogoBlock(
    header,
    'aria-label="Go to Meltano homepage"',
    22,
    "Về trang chủ AiHub"
  );
}

function replaceFooterLogo(footer: string): string {
  return replaceLogoBlock(footer, 'class="footer-logo"', 20, "AiHub");
}

/**
 * Trả về vị trí ngay sau `</li>` đóng của `<li>` bắt đầu tại `start`.
 *
 * Phải khớp đúng ranh giới thẻ: header có thẻ SVG `<line>` cũng bắt đầu bằng
 * "<li", nếu đếm lỏng thì độ sâu lệch và cắt sai.
 */
function isOpeningListItem(html: string, i: number): boolean {
  return html.startsWith("<li>", i) || html.startsWith("<li ", i);
}

function endOfListItem(html: string, start: number): number {
  let depth = 0;
  let i = start;
  while (i < html.length) {
    if (isOpeningListItem(html, i)) {
      depth += 1;
      i += 3;
    } else if (html.startsWith("</li>", i)) {
      depth -= 1;
      i += 5;
      if (depth === 0) return i;
    } else {
      i += 1;
    }
  }
  return -1;
}

function rewriteHeader(header: string): string {
  const withLogo = replaceLogo(header);
  const withNav = NAV_REWRITES.reduce((html, { find, replaceWith }) => {
    const start = html.indexOf(find);
    if (start === -1) return html;
    const end = endOfListItem(html, start);
    return end === -1
      ? html
      : html.slice(0, start) + replaceWith + html.slice(end);
  }, withLogo);
  return TEXT_REWRITES.reduce(
    (html, { find, replaceWith }) => html.replace(find, replaceWith),
    withNav
  );
}

function rewriteFooter(footer: string): string {
  const withLogo = replaceFooterLogo(footer);
  return FOOTER_TEXT_REWRITES.reduce(
    (html, { find, replaceWith }) => html.replace(find, replaceWith),
    withLogo
  );
}

type Chrome = { header: string; footer: string };

let cached: Chrome | null | undefined;

function readChrome(): Chrome | null {
  if (cached !== undefined) return cached;
  try {
    const html = readFileSync(CHROME_SOURCE, "utf8");
    const headerEnd = html.indexOf(HEADER_END);
    const footerStart = html.lastIndexOf(FOOTER_START);
    cached =
      headerEnd === -1 || footerStart === -1
        ? null
        : {
            header: rewriteHeader(html.slice(0, headerEnd + HEADER_END.length)),
            footer: rewriteFooter(html.slice(footerStart)),
          };
  } catch {
    // data/mirror không được version (xem .gitignore) nên bản clone sạch sẽ
    // không có file này. Rơi về nav tối giản thay vì làm sập cả app.
    cached = null;
  }
  return cached;
}

/** Cắt bỏ header/footer khỏi một trang mirror để layout render bản dùng chung. */
export function stripChrome(html: string): string {
  const headerEnd = html.indexOf(HEADER_END);
  const footerStart = html.lastIndexOf(FOOTER_START);
  return html.slice(
    headerEnd === -1 ? 0 : headerEnd + HEADER_END.length,
    footerStart === -1 ? html.length : footerStart
  );
}

const FALLBACK_NAV = [
  { label: "Document", href: "/product" },
  { label: "Pricing", href: "/pricing" },
  { label: "Demo", href: "/demo" },
  { label: "Lab", href: "/lab" },
];

function authActions(signedIn: boolean) {
  return signedIn
    ? '<div class="auth-actions site-auth-actions"><a href="/console">Console</a><details class="account-menu"><summary>Tài khoản</summary><form action="/api/auth/logout" method="post"><button type="submit">Đăng xuất</button></form></details></div>'
    : '<div class="site-auth-actions"><a href="/login">Đăng nhập</a><a href="/register">Đăng ký</a></div>';
}

function replaceMenuExtras(header: string, signedIn: boolean) {
  const start = header.indexOf('<div class="menu-extras">');
  const end = header.indexOf("</div>", start);
  if (start === -1 || end === -1) return header;
  return `${header.slice(0, start)}${authActions(signedIn)}${header.slice(end + 6)}`;
}

export async function SiteHeader() {
  const chrome = readChrome();
  const sessionId = (await cookies()).get(WEB_SESSION_COOKIE)?.value;
  let signedIn = false;
  if (sessionId) {
    try {
      signedIn = !!(await getWebSession(sessionId));
    } catch {
      // Redis trouble should not make public pages unavailable.
    }
  }
  if (chrome) {
    const header = replaceMenuExtras(chrome.header, signedIn);
    return <div dangerouslySetInnerHTML={{ __html: header }} />;
  }
  return (
    <header>
      <div className="container">
        <div className="menu ml-margins">
          <Link href="/">AIHub</Link>
          <nav className="main-nav">
            <ul>
              {FALLBACK_NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="site-auth-actions">
            {signedIn ? (
              <>
                <Link href="/console">Console</Link>
                <details className="account-menu">
                  <summary>Tài khoản</summary>
                  <form action="/api/auth/logout" method="post">
                    <button type="submit">Đăng xuất</button>
                  </form>
                </details>
              </>
            ) : (
              <>
                <Link href="/login">Đăng nhập</Link>
                <Link href="/register">Đăng ký</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const chrome = readChrome();
  if (!chrome) return null;
  return <div dangerouslySetInnerHTML={{ __html: chrome.footer }} />;
}
