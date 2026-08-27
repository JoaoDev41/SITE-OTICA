(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const hasGSAP = typeof window.gsap !== "undefined";
  const hasScrollTrigger = typeof window.ScrollTrigger !== "undefined";
  const hasSplitText = typeof window.SplitText !== "undefined";

  if (hasGSAP && hasScrollTrigger) {
    const plugins = [window.ScrollTrigger];
    if (hasSplitText) plugins.push(window.SplitText);
    window.gsap.registerPlugin(...plugins);
  }

  const q = (selector, scope = document) => scope.querySelector(selector);
  const qa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  function initNavigation() {
    const header = q("[data-header]");
    const toggle = q(".menu-toggle");
    const links = qa(".primary-nav a");

    if (!header || !toggle) return;

    const closeMenu = () => {
      header.classList.remove("menu-is-open");
      document.body.classList.remove("menu-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Abrir menu");
    };

    toggle.addEventListener("click", () => {
      const willOpen = !header.classList.contains("menu-is-open");
      header.classList.toggle("menu-is-open", willOpen);
      document.body.classList.toggle("menu-open", willOpen);
      toggle.setAttribute("aria-expanded", String(willOpen));
      toggle.setAttribute("aria-label", willOpen ? "Fechar menu" : "Abrir menu");
    });

    links.forEach((link) => link.addEventListener("click", closeMenu));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
  }

  function splitElement(element, type = "lines", options = {}) {
    if (!element || !hasSplitText) return null;

    return new window.SplitText(element, {
      type,
      linesClass: "line",
      wordsClass: "word",
      ...options
    });
  }

  function initHeroVideo() {
    const hero = q(".hero");
    const video = q("#heroVideo");
    const header = q("[data-header]");
    const phrases = qa("[data-phrase]");

    if (!hero || !video || !phrases.length) return;

    video.pause();

    if (reducedMotion.matches || !hasGSAP || !hasScrollTrigger) {
      phrases.forEach((phrase, index) => {
        phrase.style.opacity = index === 0 ? "1" : "0";
        phrase.style.transform = index === 0 ? "none" : "translateY(20px)";
      });

      const updateStaticHeader = () => {
        header?.classList.toggle("is-on-light", window.scrollY > hero.offsetHeight - 80);
      };

      updateStaticHeader();
      window.addEventListener("scroll", updateStaticHeader, { passive: true });
      return;
    }

    const phraseWords = phrases.map((phrase) => {
      const split = splitElement(phrase, "words");
      return split ? split.words : [phrase];
    });

    window.gsap.set(phrases, { autoAlpha: 0 });
    phraseWords.forEach((words) => window.gsap.set(words, { y: 24, autoAlpha: 0 }));
    window.gsap.set(phrases[0], { autoAlpha: 1 });
    window.gsap.set(phraseWords[0], { y: 0, autoAlpha: 1 });

    let currentPhrase = 0;
    let phraseTimeline = null;
    let frameRequest = null;
    let requestedTime = 0;

    const setPhrase = (nextIndex) => {
      if (nextIndex === currentPhrase) return;

      currentPhrase = nextIndex;
      if (phraseTimeline) phraseTimeline.kill();

      const outgoingPhrases = phrases.filter((_, index) => index !== nextIndex);
      const outgoingWords = phraseWords.flatMap((words, index) => index === nextIndex ? [] : words);

      phrases.forEach((phrase, index) => {
        phrase.classList.toggle("is-active", index === nextIndex);
      });

      phraseTimeline = window.gsap.timeline({ defaults: { overwrite: "auto" } });
      phraseTimeline
        .to(outgoingWords, {
          y: -18,
          autoAlpha: 0,
          duration: 0.3,
          stagger: 0.006,
          ease: "power2.in"
        })
        .set(outgoingPhrases, { autoAlpha: 0 })
        .set(phrases[nextIndex], { autoAlpha: 1 }, "-=0.08")
        .fromTo(
          phraseWords[nextIndex],
          { y: 22, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            duration: 0.58,
            stagger: 0.035,
            ease: "power3.out"
          },
          "-=0.08"
        );
    };

    const requestVideoFrame = (time) => {
      requestedTime = time;
      if (frameRequest) return;

      frameRequest = window.requestAnimationFrame(() => {
        frameRequest = null;
        if (Math.abs(video.currentTime - requestedTime) > 0.016) {
          try {
            video.currentTime = requestedTime;
          } catch (_) {
            // Browsers may briefly reject seeking while the media buffer initializes.
          }
        }
      });
    };

    const createVideoScroll = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0 || video.dataset.scrollReady) return;
      video.dataset.scrollReady = "true";

      const playhead = { time: 0 };

      window.gsap.to(playhead, {
        time: Math.max(0, video.duration - 0.035),
        ease: "none",
        onUpdate: () => requestVideoFrame(playhead.time),
        scrollTrigger: {
          id: "hero-video",
          trigger: hero,
          start: "top top",
          end: () => `+=${Math.max(2800, Math.min(4400, window.innerHeight * 4.6))}`,
          pin: true,
          scrub: 0.3,
          anticipatePin: 1,
          refreshPriority: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const progress = self.progress;
            const nextPhrase = progress < 0.25 ? 0 : progress < 0.48 ? 1 : progress < 0.72 ? 2 : 3;
            setPhrase(nextPhrase);
            hero.style.setProperty("--hero-progress", progress.toFixed(4));
          },
          onLeave: () => header?.classList.add("is-on-light"),
          onEnterBack: () => header?.classList.remove("is-on-light")
        }
      });

      requestVideoFrame(0.01);
      window.ScrollTrigger.refresh();
    };

    if (video.readyState >= 1) {
      createVideoScroll();
    } else {
      video.addEventListener("loadedmetadata", createVideoScroll, { once: true });
    }
  }

  function initCollections() {
    if (reducedMotion.matches || !hasGSAP || !hasScrollTrigger) return;

    const section = q(".collections");
    const heading = q(".section-intro h2");
    const copy = q(".section-intro__copy");
    const eyebrow = q(".section-intro .eyebrow");
    const cards = qa(".collection-card");
    if (!section || !cards.length) return;

    const split = splitElement(heading, "lines", { mask: "lines" });
    const titleTargets = split ? split.lines : [heading];

    const introTimeline = window.gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top 86%",
        end: "top 32%",
        scrub: 0.65
      }
    });

    introTimeline
      .fromTo(
        eyebrow,
        { y: 22, autoAlpha: 0, letterSpacing: "0.28em" },
        { y: 0, autoAlpha: 1, letterSpacing: "0.16em", duration: 0.3, ease: "power2.out" }
      )
      .fromTo(
        titleTargets,
        { yPercent: 125, autoAlpha: 0, rotate: 2.5 },
        {
          yPercent: 0,
          autoAlpha: 1,
          rotate: 0,
          duration: 0.62,
          stagger: 0.08,
          ease: "power3.out"
        },
        0.08
      )
      .fromTo(
        copy,
        { y: 28, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.32, ease: "power2.out" },
        0.56
      );

    const mediaQuery = window.gsap.matchMedia();

    mediaQuery.add(
      {
        desktop: "(min-width: 761px)",
        mobile: "(max-width: 760px)"
      },
      (context) => {
        const { desktop } = context.conditions;

        cards.forEach((card, index) => {
          const figure = q("figure", card);
          const details = [q(".collection-card__top", card), q(".collection-card__content", card)];
          const startPosition = desktop ? 91 - index * 4 : 90;
          const endPosition = desktop ? 39 - index * 2 : 35;

          const cardTimeline = window.gsap.timeline({
            scrollTrigger: {
              trigger: card,
              start: `top ${startPosition}%`,
              end: `top ${endPosition}%`,
              scrub: 0.75,
              invalidateOnRefresh: true
            }
          });

          cardTimeline
            .from(card, {
              y: desktop ? 90 : 58,
              autoAlpha: 0,
              duration: 1,
              ease: "power3.out"
            })
            .fromTo(
              card,
              { clipPath: "inset(100% 0% 0% 0%)" },
              {
                clipPath: "inset(0% 0% 0% 0%)",
                duration: 1,
                ease: "power3.inOut"
              },
              0
            )
            .fromTo(
              figure,
              { scale: 1.18, yPercent: 7 },
              {
                scale: 1,
                yPercent: 0,
                duration: 1.18,
                ease: "power2.out"
              },
              0
            )
            .fromTo(
              details,
              { y: 30, autoAlpha: 0 },
              {
                y: 0,
                autoAlpha: 1,
                duration: 0.42,
                stagger: 0.1,
                ease: "power2.out"
              },
              0.5
            );
        });
      }
    );
  }

  function initMarquee() {
    if (reducedMotion.matches || !hasGSAP) return;

    window.gsap.to(".marquee__group", {
      xPercent: -100,
      duration: 22,
      repeat: -1,
      ease: "none"
    });
  }

  function initLenses() {
    if (reducedMotion.matches || !hasGSAP || !hasScrollTrigger) return;

    const visual = q(".lenses__visual");
    const media = q(".lenses__media");
    const image = q(".lenses__image");
    const shade = q(".lenses__shade");
    const headingRowItems = qa(".lenses__heading-row > *");
    const heading = q(".lenses__content h2");
    const copy = q(".lenses__content p");
    const button = q(".lenses__content .button");
    if (!visual || !media || !image) return;

    const split = splitElement(heading, "lines", { mask: "lines" });
    const titleTargets = split ? split.lines : [heading];

    window.gsap.fromTo(
      image,
      { yPercent: -5 },
      {
        yPercent: 5,
        ease: "none",
        scrollTrigger: {
          trigger: visual,
          start: "top bottom",
          end: "bottom top",
          scrub: 1
        }
      }
    );

    const revealTimeline = window.gsap.timeline({
      scrollTrigger: {
        trigger: visual,
        start: "top 92%",
        end: "top 16%",
        scrub: 0.85,
        invalidateOnRefresh: true
      }
    });

    revealTimeline
      .fromTo(
        visual,
        { clipPath: "inset(15% 9% 15% 9%)" },
        {
          clipPath: "inset(0% 0% 0% 0%)",
          duration: 1,
          ease: "power3.inOut"
        }
      )
      .fromTo(
        media,
        { scale: 1.16 },
        { scale: 1, duration: 1.15, ease: "power2.out" },
        0
      )
      .fromTo(
        shade,
        { opacity: 0.18 },
        { opacity: 1, duration: 0.85, ease: "power2.out" },
        0.08
      )
      .fromTo(
        headingRowItems,
        { y: 20, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.28, stagger: 0.06, ease: "power2.out" },
        0.08
      )
      .fromTo(
        titleTargets,
        { yPercent: 125, autoAlpha: 0, rotate: 1.5 },
        {
          yPercent: 0,
          autoAlpha: 1,
          rotate: 0,
          duration: 0.55,
          stagger: 0.09,
          ease: "power3.out"
        },
        0.36
      )
      .fromTo(
        copy,
        { y: 24, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.3, ease: "power2.out" },
        0.66
      )
      .fromTo(
        button,
        { y: 20, scale: 0.94, autoAlpha: 0 },
        { y: 0, scale: 1, autoAlpha: 1, duration: 0.32, ease: "power2.out" },
        0.76
      );
  }

  function initFooterAnimations() {
    if (reducedMotion.matches || !hasGSAP || !hasScrollTrigger) return;

    const finale = q(".finale");
    const frame = q(".finale__frame");
    const glasses = q(".finale__frame img");
    const eyebrow = q(".finale__content .eyebrow");
    const heading = q(".finale__content h2");
    const links = qa(".footer-links > div");
    const button = q(".finale__content .button");
    if (!finale) return;

    const split = splitElement(heading, "lines");
    const titleTargets = split ? split.lines : [heading];

    window.gsap.timeline({
      scrollTrigger: {
        trigger: finale,
        start: "top 68%",
        once: true
      }
    })
      .from(frame, { x: -80, autoAlpha: 0, duration: 1.1, ease: "power3.out" })
      .from(eyebrow, { y: 12, autoAlpha: 0, duration: 0.5, ease: "power2.out" }, "-=0.75")
      .from(titleTargets, { yPercent: 110, autoAlpha: 0, duration: 0.9, stagger: 0.08, ease: "power3.out" }, "-=0.45")
      .from(links, { y: 22, autoAlpha: 0, duration: 0.65, stagger: 0.08, ease: "power2.out" }, "-=0.4")
      .from(button, { y: 14, autoAlpha: 0, duration: 0.55, ease: "power2.out" }, "-=0.35");

    window.gsap.fromTo(
      glasses,
      { yPercent: -3 },
      {
        yPercent: 3,
        ease: "none",
        scrollTrigger: {
          trigger: finale,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.8
        }
      }
    );
  }

  function refreshScrollTrigger() {
    if (hasScrollTrigger && !reducedMotion.matches) {
      window.requestAnimationFrame(() => window.ScrollTrigger.refresh());
    }
  }

  function initSite() {
    initNavigation();
    q("[data-year]").textContent = new Date().getFullYear();

    const startAnimations = () => {
      initHeroVideo();
      initCollections();
      initMarquee();
      initLenses();
      initFooterAnimations();
      refreshScrollTrigger();
    };

    if (document.fonts?.ready) {
      document.fonts.ready.then(startAnimations);
    } else {
      startAnimations();
    }

    window.addEventListener("load", refreshScrollTrigger, { once: true });
    window.addEventListener("resize", refreshScrollTrigger, { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSite, { once: true });
  } else {
    initSite();
  }
})();
