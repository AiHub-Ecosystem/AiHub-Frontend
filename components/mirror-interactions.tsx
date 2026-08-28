"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type CostConnector = { name: string; range: string; logo: string };

const costCategories: Array<{ name: string; connectors: CostConnector[] }> = [
  {
    name: "Marketing",
    connectors: [
      { name: "Facebook Ads", range: "45-65%", logo: "/meltano-mirror/external/e48053a0d9-vector-facebook-social-media-icon-illustration_534308-21672.avif" },
      { name: "Google Ads", range: "45-65%", logo: "/meltano-mirror/external/d8c5dba6cd-google-ads-logo_578229-305.avif" },
      { name: "MySQL", range: "55-75%", logo: "/meltano-mirror/external/a3b86ab643-download-7.png" },
      { name: "Bing Ads", range: "45-65%", logo: "/meltano-mirror/external/16dfc9a041-bing-ads-logo-png_seeklogo-308101.png" },
      { name: "GA4", range: "45-65%", logo: "/meltano-mirror/external/f2150e1a4f-images.png" },
    ],
  },
  {
    name: "Logistics",
    connectors: [
      { name: "Google Sheet", range: "25-45%", logo: "/meltano-mirror/external/cost-google-sheets.jpeg" },
      { name: "MySQL", range: "55-75%", logo: "/meltano-mirror/external/a3b86ab643-download-7.png" },
      { name: "Salesforce", range: "25-45%", logo: "/meltano-mirror/external/cost-salesforce.png" },
    ],
  },
  {
    name: "E-commerce",
    connectors: [
      { name: "Shopify", range: "25-45%", logo: "/meltano-mirror/external/cost-shopify.svg" },
      { name: "Klaviyo", range: "25-45%", logo: "/meltano-mirror/external/cost-klaviyo.png" },
      { name: "Google Ads", range: "45-65%", logo: "/meltano-mirror/external/d8c5dba6cd-google-ads-logo_578229-305.avif" },
      { name: "GA4", range: "45-65%", logo: "/meltano-mirror/external/f2150e1a4f-images.png" },
      { name: "Veeqo", range: "20-40%", logo: "/meltano-mirror/external/cost-veeqo.webp" },
    ],
  },
  {
    name: "Finance",
    connectors: [
      { name: "Oracle", range: "60-80%", logo: "/meltano-mirror/external/cost-oracle.png" },
      { name: "Salesforce", range: "25-45%", logo: "/meltano-mirror/external/cost-salesforce.png" },
    ],
  },
];

function rangeAverage(range: string) {
  const values = range.match(/[\d.]+/g)?.map(Number) ?? [];
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function MirrorInteractions() {
  const pathname = usePathname();

  useEffect(() => {
    const cleanups: Array<() => void> = [];
    const timeouts: number[] = [];
    const listen = (
      element: EventTarget,
      event: string,
      handler: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions,
    ) => {
      element.addEventListener(event, handler, options);
      cleanups.push(() => element.removeEventListener(event, handler, options));
    };

    if (pathname === "/" || pathname === "/lab") {
      document.body.classList.add("home", "dark", "light-header", "dark-footer");

      const workflowTitle = document.querySelector<HTMLElement>(".workflow .heading .title-inline");
      const workflowDescription = document.querySelector<HTMLElement>(".workflow .heading-description");
      if (workflowTitle && !workflowTitle.textContent?.trim()) {
        workflowTitle.innerHTML = "Efficient <em>Extract and Load</em> for modern data teams";
      }
      if (workflowDescription && !workflowDescription.textContent?.trim()) {
        workflowDescription.textContent = "Model, Extract and Load, Transformation, Analytics, Notebooks, and Orchestration - we’ve got you covered.  Easily manage your pipelines as code, with our Lab, or with the help of AI Agents.  Dependable data pipelines are now business as usual.";
      }
    } else if (pathname === "/product" || pathname === "/connectors") {
      document.body.classList.add("dark", "dark-header", "dark-footer");
    }

    const heroTitleEmphasis = [...document.querySelectorAll<HTMLElement>(".hero-title em")];
    if (heroTitleEmphasis.length === 1) heroTitleEmphasis[0].style.display = "inline-block";

    const header = document.querySelector("header");
    const portal = document.querySelector<HTMLElement>(".portal-top");
    if (portal) portal.style.transition = "transform .4s linear";

    const cloudLeft = document.querySelector<HTMLElement>(".cloud-left");
    const cloudRight = document.querySelector<HTMLElement>(".cloud-right");
    const castle = document.querySelector<HTMLElement>(".hero-castle");
    const waterfall = document.querySelector<HTMLElement>(".hero-waterfall");
    const backgrounds = [...document.querySelectorAll<HTMLElement>(".background-elements .hero-bg")];
    const heroElements = [cloudLeft, cloudRight, castle, waterfall].filter(Boolean) as HTMLElement[];

    timeouts.push(window.setTimeout(() => {
      heroElements.forEach((element) => element.classList.add("show"));
    }, 300));
    timeouts.push(window.setTimeout(() => {
      backgrounds.forEach((element) => element.classList.add("show"));
    }, 500));

    let animationFrame = 0;
    let heroHasScrolled = window.scrollY > 0;
    const updateScrollEffects = () => {
      animationFrame = 0;
      const scroll = window.scrollY;
      const shrink = scroll > 10;
      header?.classList.toggle("shrink-menu", shrink);
      if (portal) portal.style.transform = `translateY(${shrink ? -20 : 0}px)`;

      if (heroHasScrolled && castle && waterfall && backgrounds.length >= 2 && cloudLeft && cloudRight) {
        const distance = 0.7 * scroll;
        const landscape = window.innerWidth / window.innerHeight > 1 && window.innerWidth > 768;
        const scale = 1 + (landscape ? distance / 1200 : distance / 100);
        const verticalShift = landscape ? distance / 200 : distance / 1000;
        const cloudShift = landscape ? distance / 50 : distance / 10;

        cloudLeft.style.marginLeft = `-${cloudShift}vw`;
        cloudRight.style.marginRight = `-${cloudShift}vw`;
        cloudLeft.style.marginTop = `-${cloudShift}vw`;
        cloudRight.style.marginTop = `-${cloudShift}vw`;
        backgrounds[0].style.transform = `translateY(${distance / 8}%) scale(${scale})`;
        backgrounds[1].style.transform = `translateY(${landscape ? distance / 20 : distance / 2}%) scale(${scale})`;
        castle.style.transform = `translateX(${landscape ? -distance / 2 : -distance}px) scale(${scale}) translateY(-${verticalShift}%)`;
        waterfall.style.transform = `translateX(${landscape ? distance / 2 : distance}px) scale(${scale}) translateY(-${verticalShift}%)`;
      }

      const workflow = document.querySelector<HTMLElement>(".workflow");
      const workflowBackground = document.querySelector<HTMLElement>(".workflow-bg");
      if (workflow && workflowBackground) {
        const start = workflow.offsetTop - window.innerHeight;
        const distance = workflow.offsetHeight + window.innerHeight;
        const progress = Math.min(1, Math.max(0, (scroll - start) / distance));
        workflowBackground.style.willChange = "transform";
        workflowBackground.style.transform = `translateY(${500 - progress * 1000}px)`;
      }
    };
    const queueScrollEffects = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(updateScrollEffects);
    };
    const onScroll = () => {
      heroHasScrolled = true;
      queueScrollEffects();
    };
    listen(window, "scroll", onScroll, { passive: true });
    listen(window, "resize", queueScrollEffects, { passive: true });
    updateScrollEffects();

    const hamburger = document.querySelector("#hamburger-menu");
    if (hamburger) {
      listen(hamburger, "click", () => {
        document.body.classList.toggle("menu-opened");
        hamburger.classList.toggle("menu-opened");
        hamburger.classList.toggle("menu-closed");
      });
    }

    document.querySelectorAll("nav > ul > li").forEach((item) => {
      listen(item, "mouseenter", () => item.classList.add("active"));
      listen(item, "mouseleave", () => item.classList.remove("active"));
    });

    if (pathname === "/connectors") {
      const main = document.querySelector("main");
      const search = main?.querySelector<HTMLInputElement>('input[placeholder="Search connectors.."]');
      const cards = [...(main?.querySelectorAll<HTMLAnchorElement>('a[href^="/connectors/"]') ?? [])];
      const categoryButtons = [...(main?.querySelectorAll<HTMLButtonElement>("button") ?? [])]
        .filter((button) => ["All", "Meltano Cloud", "Meltano Community"].includes(button.textContent?.trim() ?? ""));

      if (search && cards.length && categoryButtons.length === 3) {
        const activeClass = categoryButtons[0].className;
        const inactiveClass = categoryButtons[1].className;
        let query = search.value.trim().toLowerCase();
        let category = "All";

        const filterConnectors = () => {
          cards.forEach((card) => {
            const text = card.innerText.toLowerCase();
            const matchesSearch = !query || text.includes(query);
            const matchesCategory = category === "All" || text.includes(category.toLowerCase());
            card.style.display = matchesSearch && matchesCategory ? "" : "none";
          });
        };

        listen(search, "input", () => {
          query = search.value.trim().toLowerCase();
          filterConnectors();
        });

        categoryButtons.forEach((button) => {
          listen(button, "click", () => {
            category = button.textContent?.trim() || "All";
            categoryButtons.forEach((item) => {
              item.className = item === button ? activeClass : inactiveClass;
            });
            filterConnectors();
          });
        });
      }
    }

    const videoObserver = "IntersectionObserver" in window
      ? new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            const video = entry.target as HTMLVideoElement;
            if (entry.isIntersecting) {
              if (video.dataset.autoplayDisabled !== "true") void video.play().catch(() => undefined);
            } else {
              video.pause();
            }
          });
        }, { threshold: 0.35 })
      : null;

    document.querySelectorAll<HTMLElement>(".workflow-terminal.tabsToggle").forEach((tabs) => {
      const buttons = [...tabs.querySelectorAll<HTMLButtonElement>(".toggle-btn")];
      const terminal = tabs.querySelector<HTMLElement>(".tab-terminal");
      const videoPanel = tabs.querySelector<HTMLElement>(".video-ui-tab");
      const video = videoPanel?.querySelector<HTMLVideoElement>("video");
      if (video) videoObserver?.observe(video);

      const showUi = () => {
        buttons.forEach((button, index) => button.classList.toggle("active", index === 0));
        if (terminal) terminal.style.display = "none";
        if (videoPanel) videoPanel.style.display = "block";
        if (video) {
          video.dataset.autoplayDisabled = "false";
          void video.play().catch(() => undefined);
        }
      };
      const showCli = () => {
        buttons.forEach((button, index) => button.classList.toggle("active", index === 1));
        if (terminal) terminal.style.display = "block";
        if (videoPanel) videoPanel.style.display = "none";
        if (video) {
          video.dataset.autoplayDisabled = "true";
          video.pause();
          video.controls = false;
        }
      };
      if (buttons[0]) listen(buttons[0], "click", showUi);
      if (buttons[1]) listen(buttons[1], "click", showCli);
      if (videoPanel && video) {
        listen(videoPanel, "mouseenter", () => { video.controls = true; });
        listen(videoPanel, "mouseleave", () => { video.controls = false; });
        listen(videoPanel, "click", () => { video.controls = true; });
        listen(videoPanel, "touchstart", () => { video.controls = true; }, { passive: true });
      }
    });
    cleanups.push(() => videoObserver?.disconnect());

    const costTabs = document.querySelector<HTMLElement>(".costComparison .tabsToggle");
    if (costTabs) {
      const buttons = [...costTabs.querySelectorAll<HTMLButtonElement>(".toggle-container .toggle-btn")];
      const body = costTabs.querySelector<HTMLTableSectionElement>("tbody");
      const saving = costTabs.querySelector<HTMLElement>(".cost-comparison__saving");
      buttons.forEach((button, index) => {
        listen(button, "click", () => {
          const category = costCategories[index];
          if (!category || !body) return;
          buttons.forEach((item, itemIndex) => item.classList.toggle("active", itemIndex === index));
          const rows = category.connectors.map((connector) => {
            const row = document.createElement("tr");
            row.className = "cost-comparison__row";
            const connectorCell = document.createElement("td");
            connectorCell.className = "cost-comparison__connector";
            const company = document.createElement("span");
            company.className = "company";
            const logoWrap = document.createElement("span");
            logoWrap.className = "logoIcon";
            const logo = document.createElement("img");
            logo.className = "cost-comparison__logo";
            logo.src = connector.logo;
            logo.alt = connector.name;
            logoWrap.append(logo);
            company.append(logoWrap, document.createTextNode(connector.name));
            connectorCell.append(company);
            const rangeCell = document.createElement("td");
            rangeCell.className = "cost-comparison__our-price";
            rangeCell.textContent = connector.range;
            row.append(connectorCell, rangeCell);
            return row;
          });
          body.replaceChildren(...rows);
          const average = Math.round(category.connectors.reduce((sum, item) => sum + rangeAverage(item.range), 0) / category.connectors.length);
          if (saving) saving.textContent = `Avg. savings: ${average}%`;
        });
      });
    }

    const community = document.querySelector<HTMLElement>(".community");
    const communityCards = [...document.querySelectorAll<HTMLElement>(".community-item")];
    if (community && communityCards.length) {
      let points: Array<{ x: number; y: number; timestamp: number }> = [];
      let glowFrame = 0;
      const renderGlow = () => {
        const now = Date.now();
        points = points.filter((point) => now - point.timestamp <= 100);
        const point = points[0];
        if (point) {
          communityCards.forEach((card) => {
            const rect = card.getBoundingClientRect();
            const pageLeft = rect.left + window.scrollX;
            const pageTop = rect.top + window.scrollY;
            const x = Math.round(((point.x - pageLeft) / card.clientWidth) * 100);
            const y = Math.round(((point.y - pageTop) / card.clientHeight) * 100);
            card.style.background = `radial-gradient(circle 260px at ${x}% ${y}%, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.02))`;
          });
        }
        if (points.length) glowFrame = window.requestAnimationFrame(renderGlow);
        else glowFrame = 0;
      };
      listen(community, "mousemove", ((event: MouseEvent) => {
        points.push({ x: event.pageX, y: event.pageY, timestamp: Date.now() });
        if (!glowFrame) glowFrame = window.requestAnimationFrame(renderGlow);
      }) as EventListener);
      cleanups.push(() => { if (glowFrame) window.cancelAnimationFrame(glowFrame); });
    }

    document.querySelectorAll(".faq-item, .faq-accordion-item").forEach((item) => {
      const trigger = item.querySelector("button") ?? item;
      listen(trigger, "click", () => item.classList.toggle("active"));
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      document.body.classList.remove("home", "dark", "light-header", "dark-header", "dark-footer", "menu-opened");
    };
  }, [pathname]);

  return null;
}
