import React, { useState, useEffect, useRef } from 'react';
import { ArrowUp, ArrowDown, Minus, Clock } from 'lucide-react';

const NIFTY_UP_DOWN_MIN_ROUND_SEC = 900; // 15 minutes

function formatIstClockFromSec(sec) {
  if (!sec || sec < 0) return '';
  const h = Math.floor(sec / 3600) % 24;
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function getTotalSecondsIST() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  const istTime = new Date(now.getTime() + istOffset);
  return istTime.getHours() * 3600 + istTime.getMinutes() * 60 + istTime.getSeconds();
}

function niftyChainedOpenPriceForWindow(windowNumber, gameResults) {
  if (!gameResults?.length) return null;
  const sorted = [...gameResults].sort((a, b) => b.windowNumber - a.windowNumber);
  const latest = sorted.find(gr => gr.windowNumber < windowNumber && gr.openPrice);
  return latest?.openPrice || null;
}

function pickLatestGameResultForWindow(gameResults, windowNumber) {
  if (!gameResults?.length) return null;
  return gameResults.find(gr => gr.windowNumber === windowNumber);
}

export default function NiftyUpDown({ 
  game, 
  user, 
  settings, 
  activeTrades, 
  gameResults, 
  onSettlePendingWindow, 
  onRefreshBalance,
  onFetchGameResults 
}) {
  const [pendingWindows, setPendingWindows] = useState([]);
  const [lastCompletedWindow, setLastCompletedWindow] = useState(null);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [currentWindow, setCurrentWindow] = useState(null);
  const [betAmount, setBetAmount] = useState('');
  const [prediction, setPrediction] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  
  const currentPriceRef = useRef(currentPrice);
  const lastNonZeroPriceRef = useRef(null);
  const activeTradesRef = useRef(activeTrades);
  const gameResultsRef = useRef(gameResults);
  const settlingWindowNumbersRef = useRef(new Set());
  
  // Update refs
  useEffect(() => {
    currentPriceRef.current = currentPrice;
    activeTradesRef.current = activeTrades;
    gameResultsRef.current = gameResults;
  }, [currentPrice, activeTrades, gameResults]);

  // Update current price from trades
  useEffect(() => {
    if (activeTrades?.length > 0) {
      const latestTrade = activeTrades[activeTrades.length - 1];
      if (latestTrade?.price && latestTrade.price > 0) {
        setCurrentPrice(latestTrade.price);
        lastNonZeroPriceRef.current = latestTrade.price;
      }
    }
  }, [activeTrades]);

  // Nifty window management
  useEffect(() => {
    if (game?.id !== 'updown') return;

    const nowSec = getTotalSecondsIST();
    const marketOpenSec = 9 * 3600 + 15 * 60; // 09:15:00
    const marketCloseSec = 15 * 3600 + 30 * 60; // 15:30:00
    
    if (nowSec < marketOpenSec || nowSec >= marketCloseSec) return;

    const roundDuration = game.roundDurationSec || NIFTY_UP_DOWN_MIN_ROUND_SEC;
    const elapsed = nowSec - marketOpenSec;
    const currentWindowNum = Math.floor(elapsed / roundDuration) + 1;
    
    const windowStartSec = marketOpenSec + (currentWindowNum - 1) * roundDuration;
    const windowEndSec = windowStartSec + roundDuration - 1;
    const resultTimeSec = windowStartSec + 2 * roundDuration; // 2 windows later
    
    const windowInfo = {
      windowNumber: currentWindowNum,
      windowStartSec,
      windowEndSec,
      resultTimeSec,
      windowStart: formatIstClockFromSec(windowStartSec),
      windowEnd: formatIstClockFromSec(windowEndSec),
      resultTime: formatIstClockFromSec(resultTimeSec),
      roundDurationSec: roundDuration
    };

    setCurrentWindow(windowInfo);

    // Create pending window
    setPendingWindows(prev => {
      const existing = prev.find(pw => pw.windowNumber === currentWindowNum);
      if (existing) return prev;
      
      const newWindow = {
        windowNumber: currentWindowNum,
        windowEndLTP: currentPriceRef.current || 0,
        ltpTime: formatIstClockFromSec(windowEndSec),
        resultTimeSec: resultTimeSec,
        resultTime: formatIstClockFromSec(resultTimeSec),
        resultEpoch: Date.now() + Math.max(0, resultTimeSec - nowSec) * 1000,
        settleEpoch: Date.now() + Math.max(0, resultTimeSec + 1 - nowSec) * 1000,
        trades: [],
        resolved: false
      };
      
      return [...prev, newWindow];
    });

    // Clean up old windows
    setPendingWindows(prev => {
      if (prev.length <= 3) return prev;
      const sorted = [...prev].sort((a, b) => b.windowNumber - a.windowNumber);
      return sorted.slice(0, 3);
    });

  }, [game]);

  // Nifty settlement logic - ONLY use GameResult
  useEffect(() => {
    if (game?.id !== 'updown' || !user?.token) return;

    const settleNiftyWindows = async () => {
      const list = [...pendingWindows];
      const nowEpoch = Date.now();
      
      const isDue = (pw) =>
        pw.settleEpoch != null
          ? nowEpoch >= pw.settleEpoch
          : pw.resultEpoch
            ? nowEpoch >= pw.resultEpoch
            : getTotalSecondsIST() >= pw.resultTimeSec;

      if (!list.some((pw) => !pw.resolved && isDue(pw))) return;

      for (const pw of list) {
        if (pw.resolved) continue;
        const due = isDue(pw);
        if (!due) continue;
        if (settlingWindowNumbersRef.current.has(pw.windowNumber)) continue;

        // FOR NIFTY UP/DOWN: ONLY use GameResult - NO FALLBACKS, NO EARLY SETTLEMENT
        const gr = pickLatestGameResultForWindow(gameResultsRef.current, pw.windowNumber);
        const c = Number(gr?.closePrice);
        const o = Number(gr?.openPrice);
        
        let resultPrice = null;
        if (gr && c != null && Number.isFinite(c) && c > 0 && Number.isFinite(o) && o > 0) {
          resultPrice = c;
          console.log(`[NIFTY] Using GameResult for window ${pw.windowNumber}: ₹${c} (result: ${gr.result})`);
        } else {
          resultPrice = null;
          console.log(`[NIFTY] Window ${pw.windowNumber} PENDING - waiting for GameResult`);
        }

        if (resultPrice == null) {
          console.log(`[NIFTY] Window ${pw.windowNumber} waiting for GameResult`);
          continue;
        }

        settlingWindowNumbersRef.current.add(pw.windowNumber);
        
        try {
          const resolvedTrades = await onSettlePendingWindow(pw, resultPrice);
          console.log(`[NIFTY] Window ${pw.windowNumber} settled with price: ₹${resultPrice}`);
          
          // Update pending windows
          setPendingWindows(prev => 
            prev.map(p => 
              p.windowNumber === pw.windowNumber 
                ? { ...p, resolved: true, resultPrice, marketDirection: gr?.result || 'TIE' }
                : p
            )
          );
          
          setLastCompletedWindow({
            windowNumber: pw.windowNumber,
            windowEndLTP: pw.windowEndLTP,
            ltpTime: pw.ltpTime,
            resultTime: pw.resultTime,
            resultPrice,
            marketDirection: gr?.result || 'TIE',
            resolved: true,
          });
          
          await onRefreshBalance();
          await onFetchGameResults();
          
        } catch (error) {
          console.error(`[NIFTY] Error settling window ${pw.windowNumber}:`, error);
        } finally {
          settlingWindowNumbersRef.current.delete(pw.windowNumber);
        }
      }
    };

    const interval = setInterval(settleNiftyWindows, 2000);
    return () => clearInterval(interval);
  }, [game?.id, user?.token, pendingWindows, gameResults, onSettlePendingWindow, onRefreshBalance, onFetchGameResults]);

  const handlePlaceBet = async () => {
    if (!betAmount || parseFloat(betAmount) <= 0 || !prediction) return;
    // Betting logic would go here
    console.log('NIFTY bet placed:', { betAmount, prediction });
  };

  const getDirectionIcon = (direction) => {
    switch (direction) {
      case 'UP': return <ArrowUp className="w-4 h-4 text-green-500" />;
      case 'DOWN': return <ArrowDown className="w-4 h-4 text-red-500" />;
      default: return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="bg-dark-800 rounded-lg p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-white mb-2">Nifty Up/Down</h2>
        {currentWindow && (
          <div className="text-sm text-gray-400">
            Current Window: #{currentWindow.windowNumber} ({currentWindow.windowStart} - {currentWindow.windowEnd})
            <br />
            Result Time: {currentWindow.resultTime}
          </div>
        )}
      </div>

      {currentPrice && (
        <div className="bg-dark-700 rounded-lg p-4 mb-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-white">₹{currentPrice.toFixed(2)}</div>
            <div className="text-sm text-gray-400">Current Nifty Price</div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {pendingWindows.map((window) => (
          <div key={window.windowNumber} className="bg-dark-700 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-white font-medium">Window #{window.windowNumber}</span>
              {window.resolved ? (
                <div className="flex items-center gap-2">
                  {getDirectionIcon(window.marketDirection)}
                  <span className="text-white">₹{window.resultPrice?.toFixed(2)}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-yellow-400">
                  <Clock className="w-4 h-4" />
                  <span>Pending</span>
                </div>
              )}
            </div>
            <div className="text-sm text-gray-400">
              LTP: ₹{window.windowEndLTP?.toFixed(2)} at {window.ltpTime}
              {window.resolved && (
                <div>
                  Result: ₹{window.resultPrice?.toFixed(2)} ({window.marketDirection})
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => setPrediction('UP')}
            className={`py-3 rounded-lg font-medium transition ${
              prediction === 'UP'
                ? 'bg-green-600 text-white'
                : 'bg-dark-700 text-green-400 hover:bg-dark-600'
            }`}
          >
            <ArrowUp className="w-5 h-5 mx-auto mb-1" />
            UP
          </button>
          <button
            onClick={() => setPrediction('DOWN')}
            className={`py-3 rounded-lg font-medium transition ${
              prediction === 'DOWN'
                ? 'bg-red-600 text-white'
                : 'bg-dark-700 text-red-400 hover:bg-dark-600'
            }`}
          >
            <ArrowDown className="w-5 h-5 mx-auto mb-1" />
            DOWN
          </button>
        </div>

        <input
          type="number"
          value={betAmount}
          onChange={(e) => setBetAmount(e.target.value)}
          placeholder="Bet amount in tokens"
          className="w-full px-4 py-3 bg-dark-700 text-white rounded-lg placeholder-gray-400 mb-4"
        />

        <button
          onClick={handlePlaceBet}
          disabled={!betAmount || !prediction}
          className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-dark-700 disabled:text-gray-500 text-white font-medium rounded-lg transition"
        >
          Place Bet
        </button>
      </div>
    </div>
  );
}
