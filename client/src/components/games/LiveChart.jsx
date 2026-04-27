import React, { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import { RefreshCw } from 'lucide-react';

/** lightweight-charts requires consistent UTCTimestamp (seconds). Objects/strings from APIs cause "Cannot update oldest data, last time=[object Object]". */
function normalizeChartTime(t) {
  if (t == null) return null;
  if (typeof t === 'number' && Number.isFinite(t)) {
    return t > 1e12 ? Math.floor(t / 1000) : Math.floor(t);
  }
  if (typeof t === 'string') {
    const ms = Date.parse(t);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  }
  if (typeof t === 'object') {
    if ('year' in t && 'month' in t && 'day' in t) {
      const y = Number(t.year);
      const m = Number(t.month);
      const d = Number(t.day);
      if ([y, m, d].every(Number.isFinite)) {
        return Math.floor(Date.UTC(y, m - 1, d) / 1000);
      }
    }
  }
  return null;
}

const LiveChart = ({ 
  symbol, 
  isBTC, 
  livePrice, 
  isLiveConnected, 
  priceLines = [],
  historicalData = []
}) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const priceLineRefs = useRef({});
  const lastBarTimeRef = useRef(null);
  /** Last candle from history + live: update() must use this bar's time (Kite/interval), never `Date.now` — that created fake 1m bars. */
  const lastFormingCandleRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [chartReady, setChartReady] = useState(false);

  const getDefaultChartHeight = () =>
    Math.max(180, Math.min(320, Math.round((typeof window !== 'undefined' ? window.innerHeight : 600) * 0.28)));

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const el = chartContainerRef.current;
    const w = Math.max(200, el.clientWidth || 300);
    const h = Math.max(160, el.clientHeight || getDefaultChartHeight());

    const chart = createChart(el, {
      layout: {
        background: { color: '#1a1a1a' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#2a2a2a' },
        horzLines: { color: '#2a2a2a' },
      },
      width: w,
      height: h,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#2a2a2a',
      },
      rightPriceScale: {
        borderColor: '#2a2a2a',
      },
      crosshair: {
        mode: 1,
      },
      localization: {
        timeFormatter: (time) => {
          const date = new Date(time * 1000);
          return date.toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
        },
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    setChartReady(true);
    console.log('LiveChart - Chart initialized');

    const applySize = () => {
      if (!chartContainerRef.current || !chartRef.current) return;
      const cw = Math.max(200, chartContainerRef.current.clientWidth);
      const ch = Math.max(160, chartContainerRef.current.clientHeight || getDefaultChartHeight());
      chartRef.current.applyOptions({ width: cw, height: ch });
    };

    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => applySize())
      : null;
    if (ro) ro.observe(el);

    window.addEventListener('resize', applySize);

    return () => {
      window.removeEventListener('resize', applySize);
      if (ro) ro.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
      }
      setChartReady(false);
    };
  }, []);

  // Load historical data
  useEffect(() => {
    console.log('LiveChart - Historical data:', historicalData?.length, 'candles', 'Chart ready:', chartReady);
    
    if (!chartReady || !candleSeriesRef.current) {
      console.log('LiveChart - Waiting for chart to be ready');
      return;
    }
    
    if (!historicalData || historicalData.length === 0) {
      console.log('LiveChart - No historical data available yet');
      return;
    }

    try {
      setLoading(true);
      const formattedData = historicalData
        .map((candle) => {
          const time =
            normalizeChartTime(candle.time) ??
            normalizeChartTime(candle.timestamp) ??
            (candle.timestamp != null
              ? Math.floor(new Date(candle.timestamp).getTime() / 1000)
              : null);
          if (time == null || !Number.isFinite(time)) return null;
          return {
            time,
            open: Number(candle.open),
            high: Number(candle.high),
            low: Number(candle.low),
            close: Number(candle.close),
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.time - b.time);

      if (formattedData.length === 0) {
        setLoading(false);
        lastBarTimeRef.current = null;
        lastFormingCandleRef.current = null;
        return;
      }

      const deduped = [];
      for (const row of formattedData) {
        if (deduped.length && deduped[deduped.length - 1].time === row.time) {
          deduped[deduped.length - 1] = row;
        } else {
          deduped.push(row);
        }
      }

      candleSeriesRef.current.setData(deduped);
      const last = deduped[deduped.length - 1];
      lastBarTimeRef.current = last.time;
      lastFormingCandleRef.current = {
        time: last.time,
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
      };
      setLoading(false);
    } catch (error) {
      console.error('LiveChart - Error loading historical data:', error);
      setLoading(false);
    }
  }, [historicalData, chartReady]);

  // Update the forming candle in place: same `time` as the last Kite/Binance bar (5m/15m/30m/1h). Never use wall-clock `now` as bar time
  // or the chart will inject extra sub-interval bars and the x-axis will look like 1m ticks.
  useEffect(() => {
    if (!candleSeriesRef.current || livePrice == null || !Number.isFinite(Number(livePrice))) return;

    const base = lastFormingCandleRef.current;
    if (base == null || base.time == null) return;

    const p = Number(livePrice);
    const open = Number(base.open);
    const hi0 = Number(base.high);
    const lo0 = Number(base.low);
    if (![open, hi0, lo0].every((x) => Number.isFinite(x))) return;

    const next = {
      time: base.time,
      open,
      high: Math.max(hi0, p),
      low: Math.min(lo0, p),
      close: p,
    };

    try {
      candleSeriesRef.current.update(next);
      lastFormingCandleRef.current = next;
    } catch (e) {
      console.warn('LiveChart - update skipped:', e?.message || e);
    }
  }, [livePrice, isLiveConnected]);

  // Draw price lines for active trades
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    // Remove old price lines
    Object.values(priceLineRefs.current).forEach(line => {
      if (line) {
        candleSeriesRef.current.removePriceLine(line);
      }
    });
    priceLineRefs.current = {};

    // Add new price lines
    priceLines.forEach(pl => {
      const color = pl.prediction === 'UP' || pl.prediction === 'BUY' ? '#10b981' : '#ef4444';
      const priceLine = candleSeriesRef.current.createPriceLine({
        price: pl.price,
        color: color,
        lineWidth: 2,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: pl.prediction,
      });
      priceLineRefs.current[pl.id] = priceLine;
    });
  }, [priceLines]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[min(280px,35vh)] min-h-[180px] w-full bg-dark-700 rounded-lg">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto mb-2 text-gray-400" size={24} />
          <div className="text-sm text-gray-400">Loading chart...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[min(30vh,240px)] min-h-[160px] sm:h-[min(32vh,260px)] md:h-[280px] lg:h-[300px] lg:min-h-[300px]">
      <div ref={chartContainerRef} className="rounded-lg overflow-hidden w-full h-full" />
      {!isLiveConnected && (
        <div className="absolute top-2 right-2 bg-yellow-900/80 text-yellow-300 px-3 py-1 rounded text-xs font-medium">
          Historical Data
        </div>
      )}
      {isLiveConnected && (
        <div className="absolute top-2 right-2 bg-green-900/80 text-green-300 px-3 py-1 rounded text-xs font-medium flex items-center gap-1">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          LIVE
        </div>
      )}
    </div>
  );
};

export default LiveChart;
