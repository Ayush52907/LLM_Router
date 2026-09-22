'use client';

import React from 'react';
import { Info } from 'lucide-react';

export const FooterDisclosure: React.FC = () => {
  return (
    <footer className="w-full bg-[#0a0f1d]/90 border-t border-slate-800/80 px-4 py-2.5 mt-auto">
      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>
            <strong>Methodology Disclosure:</strong> Cloud vs local carbon uses different measurement boundaries.
            Cloud = provider-modeled estimate (EcoLogits). Local = measured energy × live grid intensity (CodeCarbon × Electricity Maps).
            Differences below ~0.0001 kgCO₂eq are not necessarily meaningful. PII redaction is best-effort NER.
          </span>
        </div>
        <div className="text-[10px] text-slate-500 shrink-0 ml-4">
          v4 Final Spec · Bangalore Hackathon 2026
        </div>
      </div>
    </footer>
  );
};
