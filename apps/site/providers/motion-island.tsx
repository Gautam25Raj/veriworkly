"use client";

import type { ReactNode } from "react";
import { LazyMotion, MotionConfig, domAnimation } from "framer-motion";

/** Each island keeps reducedMotion="user" (the CSS kill switch misses framer's inline transforms); `strict` throws on a full `motion.*` import. */
export const MotionIsland = ({ children }: { children: ReactNode }) => (
  <LazyMotion features={domAnimation} strict>
    <MotionConfig reducedMotion="user">{children}</MotionConfig>
  </LazyMotion>
);
