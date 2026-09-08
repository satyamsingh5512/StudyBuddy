'use client';

import { ChromaFlow, Shader, Swirl } from 'shaders/react';

export default function ShaderBackground() {
  return (
    <Shader className="h-full w-full">
      <Swirl
        colorA="#0066cc"
        colorB="#2997ff"
        speed={0.8}
        detail={0.8}
        blend={50}
        coarseX={40}
        coarseY={40}
        mediumX={40}
        mediumY={40}
        fineX={40}
        fineY={40}
      />
      <ChromaFlow
        baseColor="#000000"
        upColor="#0071e3"
        downColor="#2997ff"
        leftColor="#0066cc"
        rightColor="#0071e3"
        intensity={0.9}
        radius={1.8}
        momentum={25}
        maskType="alpha"
        opacity={0.97}
      />
    </Shader>
  );
}
