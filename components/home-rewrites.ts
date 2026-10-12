/**
 * Viết lại nội dung trang chủ (data/mirror/home.html) từ Meltano sang AIHub.
 *
 * Chỉ áp dụng cho home.html, không áp dụng cho 13 trang mirror còn lại —
 * những trang đó chưa được yêu cầu viết lại.
 *
 * Cách làm: xác định ranh giới từng khối nội dung bằng chuỗi mở thẻ duy nhất
 * của nó (`<div class="X section">`), rồi hoặc xoá cả khối (bằng chứng xã hội
 * không thật: logo khách hàng, cộng đồng Slack/GitHub, blog preview trỏ sang
 * trang Meltano chưa chuyển đổi, lưới 600+ connector) hoặc thay nguyên khối
 * bằng nội dung AIHub thật.
 *
 * Khối "workflow" (Model/Extract-Load/Transform/Analytics/Orchestrate) là một
 * hướng dẫn CLI nhiều bước rất chi tiết của riêng Meltano (`meltano run`,
 * `meltano config`, YAML pipeline...), không có tương đương ở AIHub và không
 * đáng để cấy ghép câu lệnh giả — nên bỏ hẳn, thay bằng AIWRITING_FEATURE.
 *
 * AIWRITING_FEATURE giới thiệu TÍNH NĂNG và GIÁ TRỊ của Micro-Exercise, không
 * phải hợp đồng API. Endpoint, bảng trường, JSON request/response thuộc trang
 * tài liệu (/product/exercise-generation) — trang chủ chỉ dẫn khách sang đó.
 *
 * Ba giới hạn về nội dung, áp cho mọi khối hướng ra khách hàng ở trang này:
 * 1. Không nêu tên hệ thống nội bộ (WISPACE...) — khách không biết chúng là gì.
 * 2. Không kể backend xoay xở thế nào ở bên trong.
 * 3. Không kẹp một dòng chữ nhỏ căn giữa ngay dưới câu banner để giải thích lại
 *    câu banner — đọc rất không tự nhiên. Câu banner tự đứng một mình.
 * 4. Số liệu phải đếm được từ `ERROR_CODES_TAXONOMY`
 *    (backend/src/domain/academic/taxonomy.ts): 28 mã lỗi (TR 11, CC 5, LR 6,
 *    GRA_ACC 4, GRA_COM 2), 7 dạng bài, 5 tiêu chí, 2 task. Taxonomy đổi thì
 *    sửa lại các con số ở đây.
 */

function findSectionBounds(html: string, startMarker: string, endMarker: string) {
  const start = html.indexOf(startMarker);
  if (start === -1) return null;
  const end = html.indexOf(endMarker, start);
  if (end === -1) return null;
  return { start, end };
}

function removeSection(html: string, startMarker: string, endMarker: string): string {
  const bounds = findSectionBounds(html, startMarker, endMarker);
  if (!bounds) return html;
  return html.slice(0, bounds.start) + html.slice(bounds.end);
}

function replaceSection(
  html: string,
  startMarker: string,
  endMarker: string,
  replacement: string,
): string {
  const bounds = findSectionBounds(html, startMarker, endMarker);
  if (!bounds) return html;
  return html.slice(0, bounds.start) + replacement + html.slice(bounds.end);
}

const LOGOS_START = '<div class="logos-section loved-by-data-teams section">';
const SOURCES_START = '<div class="sources glow-bg section">';
const PARAGRAPHS_START = '<div class="paragraphs-with-links section">';
const WORKFLOW_START = '<div class="workflow section">';
const COMMUNITY_START = '<div class="community section">';
const BLOG_START = '<div class="blog-content section">';
const CTA_START = '<div class="cta section">';

const VALUE_PROPS = `<div class="paragraphs-with-links section"><div class="container"><div class="paragraphs-with-links-table ml-margins"><div class="paragraphs-with-links-item"><div class="paragraphs-with-links-item-info"><h3>Đúng lỗi <br><em>thật</em></h3><p class="p2">Bài tập bám đúng lỗi sai thật của học viên trong bài làm đã được gán nhãn, không phải lỗi chung chung soạn sẵn.</p></div><a href="/product/exercise-generation" class="btn colorful-btn" aria-label="Xem tài liệu"><span></span>Xem tài liệu</a></div><div class="paragraphs-with-links-item"><div class="paragraphs-with-links-item-info"><h3>Tự động <br><em>hoá</em></h3><p class="p2">Dạng bài và số câu do chính mã lỗi quyết định — không cần chọn tay, không cấu hình rườm rà.</p></div><a href="/product/exercise-generation" class="btn colorful-btn" aria-label="Xem tài liệu"><span></span>Xem tài liệu</a></div><div class="paragraphs-with-links-item"><div class="paragraphs-with-links-item-info"><h3>Minh bạch <br><em>từng bước</em></h3><p class="p2">Chạy thử ngay trên trình duyệt và thấy đúng những lệnh gọi mà backend thực hiện — không hộp đen.</p></div><a href="/demo/exercise-generation" class="btn colorful-btn" aria-label="Chạy thử"><span></span>Chạy thử</a></div><div class="paragraphs-with-links-item"><div class="paragraphs-with-links-item-info"><h3>Mở rộng <br><em>dễ dàng</em></h3><p class="p2">Kiến trúc registry — API mới publish là Marketplace, Developer Portal và Gateway đều nhận được ngay.</p></div><a href="/product" class="btn colorful-btn" aria-label="Xem tất cả API"><span></span>Xem tất cả API</a></div></div></div></div>`;

const AIWRITING_FEATURE = `<div class="how-it-works section" style="padding:96px 0;background:#fff">
<div class="container">
<div style="max-width:760px;margin:0 auto 44px;text-align:center">
<div style="display:inline-block;padding:6px 14px;border-radius:999px;background:#eae5fc;color:#3a64fa;font-size:12px;font-weight:800;letter-spacing:0.06em;margin-bottom:18px">AIWRITING · MICRO-EXERCISE</div>
<h2 style="font-size:clamp(28px,3.6vw,40px);font-weight:800;letter-spacing:-0.02em;color:#1d2838;margin:0">Đa dạng bài tập, luyện tập đúng lỗi sai</h2>
</div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;max-width:1100px;margin:0 auto 20px">
<div style="border:1px solid #e4e7ec;border-radius:14px;padding:20px;text-align:center;background:#f8fafc"><div style="font-size:30px;font-weight:800;letter-spacing:-0.02em;color:#3a64fa;line-height:1.1">28</div><div style="font-size:13px;font-weight:600;color:#475467;margin-top:6px">mã lỗi được nhận diện</div></div>
<div style="border:1px solid #e4e7ec;border-radius:14px;padding:20px;text-align:center;background:#f8fafc"><div style="font-size:30px;font-weight:800;letter-spacing:-0.02em;color:#3a64fa;line-height:1.1">7</div><div style="font-size:13px;font-weight:600;color:#475467;margin-top:6px">dạng bài luyện tập</div></div>
<div style="border:1px solid #e4e7ec;border-radius:14px;padding:20px;text-align:center;background:#f8fafc"><div style="font-size:30px;font-weight:800;letter-spacing:-0.02em;color:#3a64fa;line-height:1.1">5</div><div style="font-size:13px;font-weight:600;color:#475467;margin-top:6px">tiêu chí chấm IELTS</div></div>
<div style="border:1px solid #e4e7ec;border-radius:14px;padding:20px;text-align:center;background:#f8fafc"><div style="font-size:30px;font-weight:800;letter-spacing:-0.02em;color:#3a64fa;line-height:1.1">2</div><div style="font-size:13px;font-weight:600;color:#475467;margin-top:6px">Task 1 và Task 2</div></div>
</div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;max-width:1100px;margin:0 auto">
<div style="border:1px solid #e4e7ec;border-radius:16px;padding:26px;background:#eae5fc">
<h3 style="font-size:16px;font-weight:800;color:#1d2838;margin:0 0 10px">Luyện đúng chỗ học viên sai</h3>
<p style="font-size:14px;line-height:1.7;color:#475467;margin:0">Đưa vào câu viết sai của chính học viên, bài tập sinh ra sẽ xoay quanh đúng câu đó. Học viên luyện lại lỗi của mình chứ không làm bài tập chung chung.</p>
</div>
<div style="border:1px solid #e4e7ec;border-radius:16px;padding:26px;background:#eae5fc">
<h3 style="font-size:16px;font-weight:800;color:#1d2838;margin:0 0 10px">Không phải tự thiết kế bài tập</h3>
<p style="font-size:14px;line-height:1.7;color:#475467;margin:0">Chọn lỗi cần luyện là xong. Dạng bài và số câu tự suy ra từ chính mã lỗi đó — trắc nghiệm, điền khuyết, sắp xếp câu, khoanh lỗi hay viết lại câu.</p>
</div>
<div style="border:1px solid #e4e7ec;border-radius:16px;padding:26px;background:#eae5fc">
<h3 style="font-size:16px;font-weight:800;color:#1d2838;margin:0 0 10px">Giao cho học viên được ngay</h3>
<p style="font-size:14px;line-height:1.7;color:#475467;margin:0">Mỗi bài kèm đề bài, gợi ý, đáp án mẫu và giải thích. Riêng dạng viết lại câu còn có thang chấm 1–10 để chấm bài học viên tự động.</p>
</div>
</div>
<div style="text-align:center;margin-top:40px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
<a href="/product/exercise-generation" style="display:inline-block;min-width:196px;padding:14px 32px;border-radius:999px;background:#1d2838;color:#fff;font-weight:700;font-size:15px;text-align:center;text-decoration:none">Xem tài liệu</a>
<a href="/demo/exercise-generation" style="display:inline-block;min-width:196px;padding:14px 32px;border-radius:999px;background:#fff;color:#1d2838;border:1px solid #d0d5dd;font-weight:700;font-size:15px;text-align:center;text-decoration:none">Xem Demo</a>
</div>
</div>
</div>`;

const CTA_OLD =
  '<div class="cta section"><div class="container"><div class="cta-banner ml-margins">' +
  '<div class="cta-banner-info"><h2>Intrigued<span class="pink">?</span></h2>' +
  '<p class="p2">You haven’t seen nothing yet!</p>' +
  '<div class="cta-banner-buttons"><a href="https://meetings.hubspot.com/kyle-john" ' +
  'target="_blank" class="btn alt-blue-btn" rel="noreferrer">Book a demo</a></div>' +
  '</div></div></div></div>';

const CTA_NEW =
  '<div class="cta section"><div class="container"><div class="cta-banner ml-margins">' +
  '<div class="cta-banner-info"><h2>Sẵn sàng<span class="pink">?</span></h2>' +
  '<p class="p2">Chạy thử ngay trên trình duyệt, không cần đăng ký.</p>' +
  '<div class="cta-banner-buttons"><a href="/demo" class="btn alt-blue-btn">Xem Demo</a></div>' +
  '</div></div></div></div>';

export function rewriteHomeBody(html: string): string {
  let out = html;

  // Xoá hẳn nút nổi "OPEN" (portal-top) cạnh hero
  const portalTopStart = out.indexOf('<a href="https://docs.meltano.com" target="_blank" rel="noreferrer" class="portal-top');
  if (portalTopStart !== -1) {
    const portalTopEnd = out.indexOf("</a>", portalTopStart) + 4;
    out = out.slice(0, portalTopStart) + out.slice(portalTopEnd);
  }

  out = out.replace(
    '<h1 class="hero-title align-center">Dependable data by<br><em>default</em></h1>' +
      '<p class="hero-description p1 align-center">Meltano is an ETL platform built on ' +
      'open-source foundations, <br> engineered by experts for cloud scale, efficiency, ' +
      'and reliability.</p>' +
      '<div class="hero-buttons"><a href="https://meetings.hubspot.com/kyle-john" ' +
      'class="btn main-btn" target="_blank" rel="noopener noreferrer">Book a demo </a></div>',
    '<h1 class="hero-title align-center">Hệ sinh thái API AI cho Giáo dục với<br>' +
      '<em>AiHub</em></h1>' +
      '<p class="hero-description p1 align-center">AiHub cung cấp các giải pháp API AI chuyên sâu cho các tổ chức giáo dục & EdTech — ' +
      'từ sinh bài tập cá nhân hoá, chấm điểm tự động, đến trợ lý học tập AI thông minh.</p>' +
      '<div class="hero-buttons"><a href="/demo" class="btn main-btn">Khám phá giải pháp</a></div>',
  );

  // Logo khách hàng (CitySprint, Little Bike, ...) — không có thật cho AIHub.
  out = removeSection(out, LOGOS_START, SOURCES_START);
  // Lưới 600+ connector — khái niệm ETL, không áp dụng cho AIHub.
  out = removeSection(out, SOURCES_START, PARAGRAPHS_START);
  // 4 giá trị cốt lõi — giữ cấu trúc, đổi nội dung.
  out = replaceSection(out, PARAGRAPHS_START, WORKFLOW_START, VALUE_PROPS);
  // Hướng dẫn CLI Model/Extract-Load/Transform/Analytics/Orchestrate — thay
  // bằng khối giới thiệu tính năng & giá trị của AIWriting Micro-Exercise.
  out = replaceSection(out, WORKFLOW_START, COMMUNITY_START, AIWRITING_FEATURE);
  // Cộng đồng Slack/GitHub — số liệu của Meltano, không có thật cho AIHub.
  out = removeSection(out, COMMUNITY_START, BLOG_START);
  // Blog preview — trỏ sang /blog vẫn còn nguyên nội dung Meltano.
  out = removeSection(out, BLOG_START, CTA_START);
  // CTA cuối trang.
  out = out.replace(CTA_OLD, CTA_NEW);

  return out;
}
