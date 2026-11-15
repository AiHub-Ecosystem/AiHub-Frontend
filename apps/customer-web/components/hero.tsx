import Image from "next/image";
import Link from "next/link";

export function Hero() {
  return (
    <section className="meltano-hero">
      <div className="meltano-hero-copy">
        <h1>
          Hệ sinh thái API AI cho Giáo dục với
          <br />
          <em>AiHub</em>
        </h1>
        <p>
          AiHub cung cấp các giải pháp API AI chuyên sâu cho các tổ chức giáo dục & EdTech —
          <br className="hidden sm:block" /> từ sinh bài tập cá nhân hoá, chấm điểm tự động, đến trợ lý học tập AI thông minh.
        </p>
        <Link
          href="/demo"
          className="meltano-main-button"
        >
          Khám phá giải pháp
        </Link>
      </div>

      <div className="meltano-hero-art" aria-hidden="true">
        <Image className="meltano-cloud-left" src="/meltano/clouds-1.webp" alt="" width={420} height={205} priority />
        <Image className="meltano-cloud-right" src="/meltano/clouds-2.webp" alt="" width={382} height={186} priority />
        <Image className="meltano-castle" src="/meltano/hero-castle.webp" alt="" width={1137} height={710} priority />
        <Image className="meltano-waterfall" src="/meltano/hero-waterfall.webp" alt="" width={800} height={710} priority />
        <Image className="meltano-mountains meltano-mountains-back" src="/meltano/Mountainsback.1bef34c0.svg" alt="" width={4000} height={286} priority />
        <Image className="meltano-mountains meltano-mountains-front" src="/meltano/Mountainsfront.f78aed9f.svg" alt="" width={4000} height={247} priority />
      </div>
    </section>
  );
}
