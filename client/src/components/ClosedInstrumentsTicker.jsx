import { useEffect, useState } from 'react';
import axios from 'axios';

/**
 * Autoscrolling notice of instruments Super Admin closed (admin-locked) recently.
 */
export default function ClosedInstrumentsTicker() {
  const [instruments, setInstruments] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await axios.get('/api/instruments/closed-strip');
        setInstruments(Array.isArray(data?.instruments) ? data.instruments : []);
      } catch {
        setInstruments([]);
      }
    };
    load();
    const t = setInterval(load, 120000);
    return () => clearInterval(t);
  }, []);

  if (!instruments.length) return null;

  const line = instruments
    .map(
      (i) =>
        `${i.tradingSymbol || i.symbol} — closed for trading (${i.displaySegment || i.exchange || '—'})`
    )
    .join('     •     ');

  return (
    <div className="shrink-0 bg-amber-950/50 border-b border-amber-700/40 text-amber-100/95 text-xs py-1.5 overflow-hidden">
      <div className="relative flex items-center gap-2 px-2">
        <span className="shrink-0 font-semibold text-amber-300/90 uppercase tracking-wide">Notice</span>
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
            <span className="pr-20 whitespace-nowrap">{line}</span>
            <span className="pr-20 whitespace-nowrap">{line}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
