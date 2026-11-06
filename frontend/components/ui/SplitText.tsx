// @ts-nocheck
'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export interface SplitTextProps {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
  ease?: any;
  splitType?: string;
  from?: any;
  to?: any;
  threshold?: number;
  rootMargin?: string;
  textAlign?: string;
  tag?: string;
  staggerFrom?: string;
  mask?: boolean;
  effect?: string;
  trigger?: string;
  loop?: boolean;
  loopDelay?: number;
  hoverEffect?: string;
  color?: string;
  accentColor?: string;
  onLetterAnimationComplete?: () => void;
}

// Built-in DOM text splitter preserving word boundaries and uniform letter spacing
class GSAPSplitText {
  constructor(el, options = {}) {
    this.el = el;
    this.options = options;
    this.origText = el.textContent || '';
    this.chars = [];
    this.words = [];
    this.lines = [];
    this.masks = [];
    this.split();
  }

  split() {
    const text = this.origText;
    const type = this.options.type || 'chars';
    const wordsClass = this.options.wordsClass || 'split-word';
    const charsClass = this.options.charsClass || 'split-char';
    const mask = this.options.mask;

    this.el.innerHTML = '';
    this.words = [];
    this.chars = [];

    // Split text into words, preserving spaces cleanly
    const words = text.trim().split(/\s+/);

    words.forEach((word, wordIndex) => {
      const wordSpan = document.createElement('span');
      wordSpan.className = wordsClass;
      wordSpan.style.display = 'inline-block';
      wordSpan.style.whiteSpace = 'nowrap';
      // Equal word spacing between words
      if (wordIndex < words.length - 1) {
        wordSpan.style.marginRight = '0.34em';
      }

      if (type.includes('chars')) {
        const chars = Array.from(word);
        chars.forEach(char => {
          const charSpan = document.createElement('span');
          charSpan.className = charsClass;
          charSpan.style.display = 'inline-block';
          // Equal letter spacing between every character
          charSpan.style.letterSpacing = '0.04em';
          charSpan.textContent = char;

          if (mask) {
            const maskSpan = document.createElement('span');
            maskSpan.className = 'split-mask';
            maskSpan.style.display = 'inline-block';
            maskSpan.style.overflow = 'hidden';
            maskSpan.appendChild(charSpan);
            wordSpan.appendChild(maskSpan);
            this.masks.push(maskSpan);
          } else {
            wordSpan.appendChild(charSpan);
          }

          this.chars.push(charSpan);
        });
      } else {
        wordSpan.textContent = word;
      }

      this.words.push(wordSpan);
      this.el.appendChild(wordSpan);
    });

    this.lines = [this.el];

    if (typeof this.options.onSplit === 'function') {
      this.options.onSplit(this);
    }
  }

  revert() {
    this.el.textContent = this.origText;
  }
}

const DEFAULT_FROM = { opacity: 0, y: 35 };
const DEFAULT_TO = { opacity: 1, y: 0 };
const STIFFNESS = 180;
const DAMPING = 19;
const KICK = 0.024;

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const fontsAreLoaded = () => typeof document !== 'undefined' && (!document.fonts || document.fonts.status === 'loaded');

const waveEase = t => 1 - Math.cos(t * Math.PI * 1.5) * Math.pow(1 - t, 1.2);

const getEffect = (effect, em) => {
  switch (effect) {
    case 'fade':
      return { from: { opacity: 0 }, to: { opacity: 1 }, ease: 'power2.inOut' };
    case 'blur':
      return {
        from: { opacity: 0, filter: `blur(${Math.round(em * 1.4) / 10}px)` },
        to: { opacity: 1, filter: 'blur(0px)' },
        ease: 'power2.out'
      };
    case 'flip': {
      const setup = { transformPerspective: em * 6, transformOrigin: '50% 100%' };
      return {
        from: { ...setup, opacity: 0, rotationX: -90 },
        to: { ...setup, opacity: 1, rotationX: 0 },
        ease: 'power3.out'
      };
    }
    case 'pop':
      return { from: { opacity: 0, scale: 0 }, to: { opacity: 1, scale: 1 }, ease: 'back.out(1.6)' };
    case 'skew':
      return {
        from: { transformOrigin: '50% 100%', opacity: 0, x: -em * 0.4, skewX: -24 },
        to: { transformOrigin: '50% 100%', opacity: 1, x: 0, skewX: 0 },
        ease: 'expo.out'
      };
    case 'wave':
      return { from: { opacity: 0, y: em * 0.45 }, to: { opacity: 1, y: 0 }, ease: waveEase };
    default:
      return { from: { ...DEFAULT_FROM }, to: { ...DEFAULT_TO }, ease: 'power3.out' };
  }
};

const SplitText = ({
  text,
  className = '',
  delay = 35,
  duration = 1.1,
  ease,
  splitType = 'chars',
  from,
  to,
  threshold = 0.1,
  rootMargin = '-50px',
  textAlign = 'center',
  tag = 'span',
  staggerFrom = 'start',
  mask = false,
  effect = 'rise',
  trigger = 'load',
  loop = false,
  loopDelay = 1.5,
  hoverEffect = 'lift',
  color,
  accentColor,
  onLetterAnimationComplete
}: SplitTextProps) => {
  const ref = useRef<HTMLElement | null>(null);
  const completedTextRef = useRef<string | null>(null);
  const onCompleteRef = useRef(onLetterAnimationComplete);
  const [ready, setReady] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(fontsAreLoaded);

  const liveRef = useRef({ hoverEffect, trigger, accentColor });
  liveRef.current = { hoverEffect, trigger, accentColor };

  useIsoLayoutEffect(() => {
    onCompleteRef.current = onLetterAnimationComplete;
  }, [onLetterAnimationComplete]);

  useIsoLayoutEffect(() => {
    if (fontsLoaded) return;
    let active = true;
    const checkFonts = () => {
      if (fontsAreLoaded() && active) setFontsLoaded(true);
    };
    checkFonts();
    if (document.fonts?.ready) {
      document.fonts.ready.then(checkFonts);
    }
    return () => {
      active = false;
    };
  }, [fontsLoaded]);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || !text) return;

      const finish = () => {
        if (completedTextRef.current === text) return;
        completedTextRef.current = text;
        onCompleteRef.current?.();
      };

      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        setReady(true);
        finish();
        return;
      }

      const em = parseFloat(getComputedStyle(el).fontSize) || 24;
      const custom = from !== undefined || to !== undefined;
      const look = getEffect(effect, em);
      const fromVars = custom ? { ...(from || DEFAULT_FROM) } : look.from;
      const toVars = custom ? { ...(to || DEFAULT_TO) } : look.to;
      const easing = ease || (custom ? 'power3.out' : look.ease);
      const settle = custom ? 'willChange' : 'transform,filter,willChange';

      let pieces = [];
      let movers = [];
      let order = gsap.utils.distribute({ each: delay / 1000, from: staggerFrom });
      let revealed = completedTextRef.current === text;
      let raf = 0;
      let last = 0;
      let centers = null;
      const lift = em * 0.18;
      const springs = [];
      const kicks = [];
      const pointer = { x: 0, y: 0, inside: false };

      const reveal = () => {
        const tl = gsap.timeline({
          onComplete: () => {
            revealed = true;
            finish();
          }
        });
        tl.fromTo(
          pieces,
          { ...fromVars, willChange: 'transform, opacity' },
          { ...toVars, duration, ease: easing, stagger: order },
          0
        );
        tl.set(pieces, { clearProps: settle });
        return tl;
      };

      const measure = () => {
        const box = el.getBoundingClientRect();
        centers = movers.map((node, i) => {
          const rect = node.getBoundingClientRect();
          return {
            x: rect.left + rect.width / 2 - box.left,
            y: rect.top + rect.height / 2 - box.top - (springs[i]?.y || 0)
          };
        });
      };

      const tick = now => {
        raf = 0;
        const dt = Math.min(0.032, Math.max(0.001, (now - last) / 1000));
        last = now;
        const spots = liveRef.current.hoverEffect === 'lift' && pointer.inside && revealed ? centers : null;
        const radius = em * 1.2;
        let moving = false;

        movers.forEach((node, i) => {
          const spring = springs[i] || (springs[i] = { y: 0, v: 0 });
          const spot = spots?.[i];
          let target = 0;
          if (spot) {
            const dx = (spot.x - pointer.x) / radius;
            const dy = (spot.y - pointer.y) / (radius * 1.4);
            target = -lift * Math.exp(-(dx * dx + dy * dy) * 0.5);
          }
          spring.v += (STIFFNESS * (target - spring.y) - DAMPING * spring.v) * dt;
          spring.y += spring.v * dt;
          if (Math.abs(target - spring.y) < 0.02 && Math.abs(spring.v) < 0.05) {
            spring.y = target;
            spring.v = 0;
          } else {
            moving = true;
          }
          node.style.transform = Math.abs(spring.y) > 0.01 ? `translateY(${spring.y.toFixed(2)}px)` : '';
        });
        if (moving) raf = requestAnimationFrame(tick);
      };

      const wake = () => {
        if (raf) return;
        last = performance.now();
        raf = requestAnimationFrame(tick);
      };

      const locate = e => {
        const box = el.getBoundingClientRect();
        pointer.x = e.clientX - box.left;
        pointer.y = e.clientY - box.top;
      };

      const onEnter = e => {
        locate(e);
        pointer.inside = true;
        if (!revealed || liveRef.current.hoverEffect === 'none') return;
        measure();
        wake();
      };

      const onMove = e => {
        locate(e);
        pointer.inside = true;
        if (!revealed || liveRef.current.hoverEffect !== 'lift') return;
        if (!centers) measure();
        wake();
      };

      const onLeave = () => {
        pointer.inside = false;
        wake();
      };

      const splitInstance = new GSAPSplitText(el, {
        type: splitType,
        mask: mask ? 'chars' : undefined,
        onSplit: self => {
          pieces = self.chars.length ? self.chars : self.words;
          movers = self.chars.length ? self.chars : self.words;
          order = gsap.utils.distribute({ each: delay / 1000, from: staggerFrom });
          centers = null;
          springs.length = 0;
          kicks.length = 0;

          setReady(true);

          if (!revealed) {
            if (trigger === 'view') {
              ScrollTrigger.create({
                trigger: el,
                start: 'top 95%',
                once: true,
                onEnter: () => reveal()
              });
              // Immediate fallback in case element is already in viewport
              const rect = el.getBoundingClientRect();
              if (rect.top < window.innerHeight) {
                reveal();
              }
            } else {
              reveal();
            }
          }
        }
      });

      el.addEventListener('pointerenter', onEnter);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerleave', onLeave);

      return () => {
        cancelAnimationFrame(raf);
        el.removeEventListener('pointerenter', onEnter);
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerleave', onLeave);
        movers.forEach(node => {
          node.style.transform = '';
        });
        ScrollTrigger.getAll().forEach(st => {
          if (st.trigger === el) st.kill();
        });
        splitInstance.revert();
      };
    },
    {
      dependencies: [text, delay, duration, ease, splitType, trigger, effect, fontsLoaded],
      scope: ref,
      revertOnUpdate: true
    }
  );

  const Tag = tag || 'span';

  return (
    <Tag
      key={text}
      ref={ref}
      className={`split-parent inline-block whitespace-normal ${className}`}
      style={{
        textAlign,
        color,
        visibility: ready ? undefined : 'visible'
      }}
    >
      {text}
    </Tag>
  );
};

export default SplitText;
export { SplitText };
