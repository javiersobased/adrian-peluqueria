import { useEffect, useMemo, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './ScrollFloat.css';

gsap.registerPlugin(ScrollTrigger);

interface ScrollFloatProps {
  children: React.ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'div';
  scrollContainerRef?: React.RefObject<HTMLElement>;
  containerClassName?: string;
  textClassName?: string;
  animationDuration?: number;
  ease?: string;
  scrollStart?: string;
  scrollEnd?: string;
  stagger?: number;
}

export default function ScrollFloat({
  children,
  as = 'h2',
  scrollContainerRef,
  containerClassName = '',
  textClassName = '',
  animationDuration = 1,
  ease = 'back.inOut(2)',
  scrollStart = 'center bottom+=50%',
  scrollEnd = 'bottom bottom-=40%',
  stagger = 0.03,
}: ScrollFloatProps) {
  const containerRef = useRef<HTMLHeadingElement>(null);
  const Tag = as;

  const splitText = useMemo(() => {
    const text = typeof children === 'string' ? children : '';
    return text.split('').map((char, index) => (
      <span className="char" key={index} style={{ display: 'inline-block', whiteSpace: 'pre' }}>
        {char === ' ' ? '\u00A0' : char}
      </span>
    ));
  }, [children]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const charElements = el.querySelectorAll('.char');
    if (!charElements.length) return;

    const rect = el.getBoundingClientRect();
    const inInitialView = rect.top < window.innerHeight && window.scrollY < 100;

    let anim: gsap.core.Tween | gsap.core.Timeline;

    if (inInitialView) {
      // Direct stagger entrance float so the user visibly sees it on page load
      anim = gsap.fromTo(
        charElements,
        {
          willChange: 'opacity, transform',
          opacity: 0,
          yPercent: 70,
          scaleY: 1.4,
          scaleX: 0.9,
          transformOrigin: '50% 0%',
        },
        {
          duration: animationDuration,
          ease: 'power3.out',
          opacity: 1,
          yPercent: 0,
          scaleY: 1,
          scaleX: 1,
          stagger,
          delay: 0.2,
        }
      );
    } else {
      const scroller = scrollContainerRef?.current ?? window;
      anim = gsap.fromTo(
        charElements,
        {
          willChange: 'opacity, transform',
          opacity: 0,
          yPercent: 60,
          scaleY: 1.4,
          scaleX: 0.9,
          transformOrigin: '50% 0%',
        },
        {
          duration: animationDuration,
          ease,
          opacity: 1,
          yPercent: 0,
          scaleY: 1,
          scaleX: 1,
          stagger,
          scrollTrigger: {
            trigger: el,
            scroller,
            start: scrollStart,
            end: scrollEnd,
            scrub: 0.5,
          },
        }
      );
    }

    return () => {
      if ((anim as any).scrollTrigger) {
        (anim as any).scrollTrigger.kill();
      }
      anim.kill();
    };
  }, [scrollContainerRef, animationDuration, ease, scrollStart, scrollEnd, stagger]);

  return (
    <Tag ref={containerRef as any} className={`scroll-float ${containerClassName}`}>
      <span className={`scroll-float-text inline-block ${textClassName}`} style={{ display: 'inline-block' }}>
        {splitText}
      </span>
    </Tag>
  );
}
