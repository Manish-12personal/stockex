import React, { useState, useEffect, useRef } from 'react';
import { ArrowUp, ArrowDown, Minus, Clock } from 'lucide-react';

function btcResultRefSecForUiWindow(windowNumber) {
  // BTC windows are 5 minutes each, result is 5 minutes after window ends
  const marketOpenSec = 9 * 3600; // 09:00:00
  const windowDurationSec = 5 * 60; // 5 minutes
  const windowStartSec = marketOpenSec + (windowNumber - 1) * windowDurationSec;
  const windowEndSec = windowStartSec + windowDurationSec - 1;
  const resultSec = windowEndSec + windowDurationSec; // 5 minutes after window ends
  return resultSec;
}

function currentTotalSecondsISTLib() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  const istTime = new Date(now.getTime() + istOffset);
  return istTime.getHours() * 3600 + istTime.getMinutes() * 60 + istTime.getSeconds();
}

function formatIstClockFromSec(sec) {
  if (!sec || sec < 0) return '';
  const h = Math.floor(sec / 3600) % 24;
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function pickLatestGameResultForWindow(gameResults, windowNumber) {
  if (!gameResults?.length) return null;
  return gameResults.find(gr => gr.windowNumber === windowNumber);
}

export default function BtcUpDown({ 
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
  const capturedWindowEndPriceRef = useRef(null);
  const capturedWindowEndTimeRef = useRef(null);
  
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

  // BTC window management
  useEffect(() => {
    if (game?.id !== 'btcupdown') return;

    const nowSec = currentTotalSecondsISTLib();
    const marketOpenSec = 9 * 3600; // 09:00:00
    const marketCloseSec = 24 * 3600; // 24:00:00 (or next day)
    
    if (nowSec < marketOpenSec || nowSec >= marketCloseSec) return;

    const windowDurationSec = 5 * 60; // 5 minutes
    const elapsed = nowSec - marketOpenSec;
    const currentWindowNum = Math.floor(elapsed / windowDurationSec) + 1;
    
    const windowStartSec = marketOpenSec + (currentWindowNum - 1) * windowDurationSec;
    const windowEndSec = windowStartSec + windowDurationSec - 1;
    const resultTimeSec = btcResultRefSecForUiWindow(currentWindowNum);
    
    const windowInfo = {
      windowNumber: currentWindowNum,
      windowStartSec,
      windowEndSec,
      resultTimeSec,
      windowStart: formatIstClockFromSec(windowStartSec),
      windowEnd: formatIstClockFromSec(windowEndSec),
      resultTime: formatIstClockFromSec(resultTimeSec),
      roundDurationSec: windowDurationSec
    };

    setCurrentWindow(windowInfo);

    // Create pending window
    setPendingWindows(prev => {
      const existing = prev.find(pw => pw.windowNumber === currentWindowNum);
      if (existing) return prev;
      
      const newWindow = {
        windowNumber: currentWindowNum,
        windowEndLTP: currentPriceRef.current || 0,
        ltpTime: windowInfo.windowStart,
        resultTimeSec: resultTimeSec,
        resultTime: windowInfo.resultTime,
        resultEpoch: Date.now() + Math.max(0, resultTimeSec - nowSec) * 1000,
        settleEpoch: Date.now() + Math.max(0, resultTimeSec + 1 - nowSec) * 1000,
        trades: [],
        resolved: false
      };
      
      return [...prev, newWindow];
    });

  }, [game]);

  // Handle window change for BTC
  useEffect(() => {
    if (game?.id !== 'btcupdown' || !currentWindow) return;

    const prevWindowNum = currentWindow.windowNumber - 1;
    if (prevWindowNum <= 0) return;

    // Capture the price at the exact moment window changes - this is the fixed LTP
    const windowEndLTP = currentPriceRef.current || lastNonZeroPriceRef.current || 0;
    
    // Store this price so it can be used when creating the pending window
    capturedWindowEndPriceRef.current = windowEndLTP;
    capturedWindowEndTimeRef.current = formatIstClockFromSec(currentWindow.windowStartSec);
    console.log('[BTC LTP] Window changed from', prevWindowNum, 'to', currentWindow.windowNumber, 'captured LTP:', windowEndLTP);
    
    // Update the previous window with the captured LTP
    setPendingWindows(prev => {
      const existingIdx = prev.findIndex(pw => pw.windowNumber === prevWindowNum);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          windowEndLTP: parseFloat(windowEndLTP.toFixed(2)),
          ltpTime: capturedWindowEndTimeRef.current
        };
        return updated;
      }
      return prev;
    });

  }, [currentWindow, game]);

  // BTC settlement logic - IMMEDIATE SETTLEMENT WITH LIVE PRICE
  useEffect(() => {
    if (game?.id !== 'btcupdown' || !user?.token) return;

    const settleBtcWindows = async () => {
      const list = [...pendingWindows];
      const nowEpoch = Date.now();
      
      const isDue = (pw) =>
        pw.settleEpoch != null
          ? nowEpoch >= pw.settleEpoch
          : pw.resultEpoch
            ? nowEpoch >= pw.resultEpoch
            : currentTotalSecondsISTLib() >= pw.resultTimeSec;

      if (!list.some((pw) => !pw.resolved && isDue(pw))) return;

      for (const pw of list) {
        if (pw.resolved) continue;
        const due = isDue(pw);
        if (!due) continue;
        if (settlingWindowNumbersRef.current.has(pw.windowNumber)) continue;

        // FOR BTC: IMMEDIATE SETTLEMENT - USE LIVE PRICE
        const gr = pickLatestGameResultForWindow(gameResultsRef.current, pw.windowNumber);
        const c = Number(gr?.closePrice);
        const o = Number(gr?.openPrice);
        
        let resultPrice = null;
        if (gr && c != null && Number.isFinite(c) && c > 0) {
          resultPrice = c;
          console.log(`[BTC] Using stored GameResult for window ${pw.windowNumber}: ₹${c} (result: ${gr.result})`);
        } else {
          // NO DATABASE - use live price immediately and settle
          const livePrice = currentPriceRef.current;
          if (livePrice != null && Number.isFinite(livePrice) && livePrice > 0) {
            resultPrice = livePrice;
            console.log(`[BTC] ✅ IMMEDIATE SETTLE: Using live price for window ${pw.windowNumber}: ₹${livePrice}`);
          } else {
            // Use window's LTP if available
            if (pw.windowEndLTP != null && Number.isFinite(pw.windowEndLTP) && pw.windowEndLTP > 0) {
              resultPrice = pw.windowEndLTP;
              console.log(`[BTC] ✅ Using window LTP for window ${pw.windowNumber}: ₹${resultPrice}`);
            } else {
              resultPrice = null;
              console.warn(`[BTC] ❌ No price available for window ${pw.windowNumber}`);
            }
          }
        }

        if (resultPrice == null) {
          console.warn(`[BTC] Settlement waiting for price (window ${pw.windowNumber})`);
          continue;
        }

        settlingWindowNumbersRef.current.add(pw.windowNumber);
        
        try {
          const resolvedTrades = await onSettlePendingWindow(pw, resultPrice);
          console.log(`[BTC] Window ${pw.windowNumber} settled with price: ₹${resultPrice}`);
          
          // Calculate direction
          const grDir = pickLatestGameResultForWindow(gameResultsRef.current, pw.windowNumber);
          const prevWindowGrDir = pickLatestGameResultForWindow(gameResultsRef.current, pw.windowNumber - 1);
          const diffForDirection = (Number(grDir?.closePrice) || 0) - (Number(prevWindowGrDir?.closePrice) || Number(grDir?.openPrice) || 0);
          const direction = diffForDirection > 0 ? 'UP' : diffForDirection < 0 ? 'DOWN' : 'TIE';
          
          // Update pending windows with permanent mark
          setPendingWindows(prev => {
            const updated = prev.map(p => 
              p.windowNumber === pw.windowNumber 
                ? { ...p, resolved: true, resultPrice, marketDirection: direction, permanent: true }
                : p
            );
            console.log(`[BTC] ✅ Window ${pw.windowNumber} PERMANENTLY resolved with price: ₹${resultPrice} (${direction})`);
            
            // Save to localStorage for persistence across refreshes
            try {
              const btcResults = JSON.parse(localStorage.getItem('btc_results') || '[]');
              const existingIndex = btcResults.findIndex(r => r.windowNumber === pw.windowNumber);
              const resultData = {
                windowNumber: pw.windowNumber,
                resultPrice,
                marketDirection: direction,
                timestamp: Date.now()
              };
              
              if (existingIndex >= 0) {
                btcResults[existingIndex] = resultData;
              } else {
                btcResults.push(resultData);
              }
              
              const sorted = btcResults.sort((a, b) => b.windowNumber - a.windowNumber).slice(0, 50);
              localStorage.setItem('btc_results', JSON.stringify(sorted));
              console.log(`[BTC] 💾 Saved to localStorage: Window ${pw.windowNumber}`);
            } catch (e) {
              console.error('[BTC] Failed to save to localStorage:', e);
            }
            
            return updated;
          });
          
          setLastCompletedWindow({
            windowNumber: pw.windowNumber,
            windowEndLTP: pw.windowEndLTP,
            ltpTime: pw.ltpTime,
            resultTime: pw.resultTime,
            resultPrice,
            marketDirection: direction,
            resolved: true,
          });
          
          await onRefreshBalance();
          await onFetchGameResults();
          
        } catch (error) {
          console.error(`[BTC] Error settling window ${pw.windowNumber}:`, error);
        } finally {
          settlingWindowNumbersRef.current.delete(pw.windowNumber);
        }
      }
    };

    const interval = setInterval(settleBtcWindows, 500); // Faster for BTC
    return () => clearInterval(interval);
  }, [game?.id, user?.token, pendingWindows, gameResults, onSettlePendingWindow, onRefreshBalance, onFetchGameResults]);

  // Restore BTC results from localStorage on page load
  useEffect(() => {
    if (game?.id === 'btcupdown') {
      try {
        const btcResults = JSON.parse(localStorage.getItem('btc_results') || '[]');
        if (btcResults.length > 0) {
          console.log(`[BTC] 📂 Restoring ${btcResults.length} results from localStorage...`);
          setPendingWindows(prev => {
            const existingWindowNumbers = new Set(prev.map(pw => pw.windowNumber));
            const restoredWindows = [];
            
            btcResults.forEach(r => {
              if (!existingWindowNumbers.has(r.windowNumber)) {
                console.log(`[BTC] Restored window ${r.windowNumber}: ₹${r.resultPrice} (${r.marketDirection})`);
                restoredWindows.push({
                  windowNumber: r.windowNumber,
                  resolved: true,
                  resultPrice: r.resultPrice,
                  marketDirection: r.marketDirection,
                  permanent: true,
                  windowEndLTP: r.resultPrice,
                  ltpTime: new Date(r.timestamp),
                  resultTime: new Date(r.timestamp)
                });
              }
            });
            
            return [...prev, ...restoredWindows].sort((a, b) => b.windowNumber - a.windowNumber);
          });
        }
      } catch (e) {
        console.error('[BTC] Failed to restore from localStorage:', e);
      }
    }
  }, [game?.id]);

  // Clean up old resolved pending windows - COMPLETELY DISABLED FOR BTC UP/DOWN
  useEffect(() => {
    if (game?.id === 'btcupdown') {
      console.log('[BTC] CLEANUP COMPLETELY DISABLED - Results will NEVER disappear');
      return; // Skip cleanup entirely for BTC
    }
    
    // Only run cleanup for non-BTC games
    setPendingWindows(prev => {
      if (prev.length <= 1) return prev;
      const latestResolved = prev.filter(pw => pw.resolved);
      if (latestResolved.length > 1) {
        const pending = prev.filter(pw => !pw.resolved);
        const newest = latestResolved[latestResolved.length - 1];
        return [...pending, newest];
      }
      return prev;
    });
  }, [game?.id]); // Only depends on game.id, not pendingWindows

  const handlePlaceBet = async () => {
    if (!betAmount || parseFloat(betAmount) <= 0 || !prediction) return;
    // Betting logic would go here
    console.log('BTC bet placed:', { betAmount, prediction });
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
        <h2 className="text-xl font-bold text-white mb-2">BTC Up/Down</h2>
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
            <div className="text-sm text-gray-400">Current BTC Price</div>
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
