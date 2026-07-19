'use client';

import { ChromaFlow, Shader, Swirl } from 'shaders/react';

export default function ShaderBackground() {
  return (
    <Shader className="h-full w-full">
      <Swirl
        colorA="#6C47FF"
        colorB="#F59E0B"
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
        baseColor="#09090B"
        upColor="#6C47FF"
        downColor="#F59E0B"
        leftColor="#10B981"
        rightColor="#6C47FF"
        intensity={0.9}
        radius={1.8}
        momentum={25}
        maskType="alpha"
        opacity={0.97}
      />
    </Shader>
  );
}
