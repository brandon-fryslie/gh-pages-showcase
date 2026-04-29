import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

export interface ScrollPinProps {
  /** Children rendered inside the pinned card. */
  children: ReactNode;
  /**
   * How long the pin holds, expressed as ScrollTrigger's `end` value.
   * Default `"+=180%"` — 1.8 viewports of pin scrolling.
   */
  pinLength?: string;
  /**
   * Of the pin scroll, what fraction is the lock-in animation
   * (windowed → fullscreen). The remainder is "hold at fullscreen."
   * Default 0.45.
   */
  lockInRatio?: number;
  /** Initial windowed inset in pixels. Default 28. */
  inset?: number;
  /** Initial windowed border-radius in pixels. Default 16. */
  radius?: number;
  /**
   * Disable the pin below this viewport width. Below the breakpoint the
   * card flows linearly with no Lenis or pin. Default 760.
   */
  mobileBreakpoint?: number;
  /** scrub setting passed to ScrollTrigger. Default 0.6. */
  scrub?: number | boolean;
  /** Optional className applied to the section root. */
  className?: string;
  /** Optional style applied to the section root. */
  style?: CSSProperties;
}

/**
 * Soft-locks its children into the viewport while the user scrolls past.
 * Recipe: Lenis (global wheel intercept + inertial easing) + GSAP
 * ScrollTrigger (pin + scrub). The card starts as a windowed inset and
 * animates to fullscreen as the pin engages, then holds for the rest of
 * the pin range, then releases.
 *
 * Note: instantiating this twice on a page will create two Lenis instances,
 * which is wrong. If you need multiple pins, lift Lenis up into your app
 * and use ScrollPin's lower-level building blocks instead. The single-pin
 * case is by far the common one.
 */
export function ScrollPin({
  children,
  pinLength = '+=180%',
  lockInRatio = 0.45,
  inset = 28,
  radius = 16,
  mobileBreakpoint = 760,
  scrub = 0.6,
  className,
  style,
}: ScrollPinProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const card = cardRef.current;
    if (!section || !card) return;

    const mq = `(min-width: ${mobileBreakpoint + 1}px)`;
    let lenis: Lenis | null = null;
    let mm: ReturnType<typeof gsap.matchMedia> | null = null;

    const tick = (time: number) => {
      if (lenis) lenis.raf(time * 1000);
    };

    mm = gsap.matchMedia();
    mm.add(mq, () => {
      lenis = new Lenis({
        duration: 1.05,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        wheelMultiplier: 1.0,
      });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      // [LAW:one-source-of-truth] Lenis owns scroll position; hide the native
      // scrollbar so it doesn't compete visually with the locked-in chrome.
      document.documentElement.classList.add('sk-lenis-active');

      const holdRatio = Math.max(0, 1 - lockInRatio);
      const tl = gsap.timeline({
        defaults: { ease: 'power3.out' },
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: pinLength,
          pin: true,
          pinSpacing: true,
          scrub,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });
      tl.to(section, { padding: 0, duration: lockInRatio }, 0)
        .to(card, {
          borderRadius: 0,
          boxShadow: '0 0 0 rgba(0,0,0,0)',
          duration: lockInRatio,
        }, 0)
        .to({}, { duration: holdRatio });

      return () => {
        tl.scrollTrigger?.kill();
        tl.kill();
        gsap.ticker.remove(tick);
        if (lenis) {
          lenis.destroy();
          lenis = null;
        }
        document.documentElement.classList.remove('sk-lenis-active');
        gsap.set(section, { clearProps: 'all' });
        gsap.set(card, { clearProps: 'all' });
      };
    });

    return () => {
      mm?.revert();
    };
  }, [pinLength, lockInRatio, scrub, mobileBreakpoint]);

  return (
    <section
      ref={sectionRef}
      className={['sk-pin-section', className].filter(Boolean).join(' ')}
      style={{ ['--sk-pin-inset' as string]: `${inset}px`, ...style }}
    >
      <div
        ref={cardRef}
        className="sk-pin-card"
        style={{ ['--sk-pin-radius' as string]: `${radius}px` }}
      >
        {children}
      </div>
    </section>
  );
}
