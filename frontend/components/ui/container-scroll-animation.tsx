"use client";
import React, { useRef, useState, useEffect } from "react";
import { useScroll, useTransform, motion, MotionValue } from "framer-motion";

export const ContainerScroll = ({
  titleComponent,
  children,
  className = "",
}: {
  titleComponent: string | React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  const scaleDimensions = () => {
    return isMobile ? [0.88, 0.98] : [1.03, 1];
  };

  const rotate = useTransform(scrollYProgress, [0, 0.55], [18, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.55], scaleDimensions());
  const translate = useTransform(scrollYProgress, [0, 0.55], [0, -30]);

  return (
    <div
      className={`min-h-[44rem] sm:min-h-[50rem] md:min-h-[66rem] w-full flex items-center justify-center relative px-2 sm:px-4 md:px-6 overflow-hidden ${className}`}
      ref={containerRef}
    >
      <div className="pt-8 sm:pt-8 md:pt-14 pb-0 sm:pb-6 md:pb-14 w-full max-w-7xl mx-auto flex flex-col items-center justify-center relative">
        <Header translate={translate} titleComponent={titleComponent} />
        <div
          className="w-full flex items-center justify-center"
          style={{
            perspective: "1000px",
          }}
        >
          <Card rotate={rotate} translate={translate} scale={scale}>
            {children}
          </Card>
        </div>
      </div>
    </div>
  );
};

export const Header = ({
  translate,
  titleComponent,
}: {
  translate: MotionValue<number>;
  titleComponent: React.ReactNode;
}) => {
  return (
    <motion.div
      style={{
        translateY: translate,
      }}
      className="w-full flex flex-col items-center justify-center text-center mx-auto mb-4 sm:mb-6 md:mb-8"
    >
      {titleComponent}
    </motion.div>
  );
};

export const Card = ({
  rotate,
  scale,
  children,
}: {
  rotate: MotionValue<number>;
  scale: MotionValue<number>;
  translate: MotionValue<number>;
  children: React.ReactNode;
}) => {
  return (
    <motion.div
      style={{
        rotateX: rotate,
        scale,
        transformStyle: "preserve-3d",
        willChange: "transform",
      }}
      className="max-w-6xl -mt-4 sm:-mt-8 mx-auto w-full border-2 md:border-4 border-border p-2 sm:p-3 md:p-4 bg-card rounded-[24px] sm:rounded-[32px] shadow-2xl transition-colors duration-200"
    >
      <div className="h-full w-full overflow-hidden rounded-xl sm:rounded-2xl bg-card border border-border">
        {children}
      </div>
    </motion.div>
  );
};
