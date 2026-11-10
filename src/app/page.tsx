'use client';

import dynamic from 'next/dynamic';

// The dashboard renders client-side only (Recharts and Framer Motion need the browser)
const PlantPulseApp = dynamic(() => import('../App'), {
  ssr: false,
  loading: () => (
    <div className="scene grid place-items-center">
      <div className="flex flex-col items-center gap-3">
        <p className="mono text-[12px] text-[var(--ink-2)]">Loading Plant Pulse…</p>
      </div>
    </div>
  ),
});

export default function Page() {
  return <PlantPulseApp />;
}
