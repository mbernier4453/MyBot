/**
 * Technical Indicator Calculations
 * 
 * Collection of technical indicator calculation functions used throughout the application.
 * All functions operate on arrays of price data and return arrays with null values for warmup periods.
 */

const Indicators = {
  /**
   * Calculate SMA (Simple Moving Average)
   * @param {Array<number>} prices - Price array
   * @param {number} period - Period length
   * @returns {Array<number|null>} SMA values
   */
  calculateSMA(prices, period) {
    const sma = [];
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        sma.push(null);
      } else {
        const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        sma.push(sum / period);
      }
    }
    return sma;
  },

  /**
   * Calculate EMA (Exponential Moving Average)
   * @param {Array<number>} prices - Price array
   * @param {number} period - Period length
   * @returns {Array<number|null>} EMA values
   */
  calculateEMA(prices, period) {
    const ema = [];
    const multiplier = 2 / (period + 1);
    
    // Start with SMA for first value
    let sum = 0;
    for (let i = 0; i < period && i < prices.length; i++) {
      sum += prices[i];
    }
    const firstEMA = sum / Math.min(period, prices.length);
    
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        ema.push(null);
      } else if (i === period - 1) {
        ema.push(firstEMA);
      } else {
        const prevEMA = ema[i - 1];
        ema.push((prices[i] - prevEMA) * multiplier + prevEMA);
      }
    }
    return ema;
  },

  /**
   * Calculate HMA (Hull Moving Average)
   * @param {Array<number>} prices - Price array
   * @param {number} period - Period length
   * @returns {Array<number|null>} HMA values
   */
  calculateHMA(prices, period) {
    const halfPeriod = Math.floor(period / 2);
    const sqrtPeriod = Math.floor(Math.sqrt(period));
    
    const wmaHalf = this.calculateWMA(prices, halfPeriod);
    const wmaFull = this.calculateWMA(prices, period);
    
    // 2 * WMA(n/2) - WMA(n)
    const rawHMA = wmaHalf.map((val, i) => {
      if (val === null || wmaFull[i] === null) return null;
      return 2 * val - wmaFull[i];
    });
    
    // Final WMA of sqrt(n)
    return this.calculateWMA(rawHMA, sqrtPeriod);
  },

  /**
   * Calculate WMA (Weighted Moving Average) - helper for HMA
   * @param {Array<number>} prices - Price array
   * @param {number} period - Period length
   * @returns {Array<number|null>} WMA values
   */
  calculateWMA(prices, period) {
    const wma = [];
    const weights = [];
    for (let i = 1; i <= period; i++) weights.push(i);
    const weightSum = weights.reduce((a, b) => a + b, 0);
    
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1 || prices[i] === null) {
        wma.push(null);
      } else {
        let sum = 0;
        let validWeights = true;
        for (let j = 0; j < period; j++) {
          const price = prices[i - period + 1 + j];
          if (price === null) {
            validWeights = false;
            break;
          }
          sum += price * weights[j];
        }
        wma.push(validWeights ? sum / weightSum : null);
      }
    }
    return wma;
  },

  /**
   * Calculate KAMA (Kaufman Adaptive Moving Average)
   * @param {Array<number>} prices - Price array
   * @param {number} period - Period length
   * @param {number} fast - Fast period for smoothing
   * @param {number} slow - Slow period for smoothing
   * @returns {Array<number|null>} KAMA values
   */
  calculateKAMA(prices, period = 20, fast = 2, slow = 30) {
    const kama = [];
    const fastAlpha = 2 / (fast + 1);
    const slowAlpha = 2 / (slow + 1);
    
    for (let i = 0; i < prices.length; i++) {
      if (i < period) {
        kama.push(null);
      } else if (i === period) {
        kama.push(prices[i]);
      } else {
        // Calculate efficiency ratio
        const change = Math.abs(prices[i] - prices[i - period]);
        let volatility = 0;
        for (let j = i - period; j < i; j++) {
          volatility += Math.abs(prices[j + 1] - prices[j]);
        }
        const er = volatility === 0 ? 0 : change / volatility;
        
        // Smoothing constant
        const sc = Math.pow(er * (fastAlpha - slowAlpha) + slowAlpha, 2);
        
        // KAMA
        kama.push(kama[i - 1] + sc * (prices[i] - kama[i - 1]));
      }
    }
    return kama;
  },

  /**
   * Calculate Bollinger Bands
   * @param {Array<number>} prices - Price array
   * @param {number} period - Period length
   * @param {number} stdDev - Standard deviation multiplier
   * @returns {Object} {upper, middle, lower} arrays
   */
  calculateBB(prices, period = 20, stdDev = 2.0) {
    const sma = this.calculateSMA(prices, period);
    const upper = [];
    const lower = [];
    
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1 || sma[i] === null) {
        upper.push(null);
        lower.push(null);
      } else {
        const slice = prices.slice(i - period + 1, i + 1);
        const mean = sma[i];
        const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
        const std = Math.sqrt(variance);
        upper.push(mean + stdDev * std);
        lower.push(mean - stdDev * std);
      }
    }
    
    return { upper, middle: sma, lower };
  },

  /**
   * Calculate Keltner Channels
   * @param {Array<number>} high - High prices
   * @param {Array<number>} low - Low prices
   * @param {Array<number>} close - Close prices
   * @param {number} period - Period length
   * @param {number} multiplier - ATR multiplier
   * @returns {Object} {upper, middle, lower} arrays
   */
  calculateKC(high, low, close, period = 20, multiplier = 2.0) {
    const ema = this.calculateEMA(close, period);
    const atr = this.calculateATR(high, low, close, period);
    
    const upper = [];
    const lower = [];
    
    for (let i = 0; i < close.length; i++) {
      if (ema[i] === null || atr[i] === null) {
        upper.push(null);
        lower.push(null);
      } else {
        upper.push(ema[i] + multiplier * atr[i]);
        lower.push(ema[i] - multiplier * atr[i]);
      }
    }
    
    return { upper, middle: ema, lower };
  },

  /**
   * Calculate ATR (Average True Range)
   * @param {Array<number>} high - High prices
   * @param {Array<number>} low - Low prices
   * @param {Array<number>} close - Close prices
   * @param {number} period - Period length
   * @returns {Array<number|null>} ATR values
   */
  calculateATR(high, low, close, period = 14) {
    const tr = [];
    const atr = [];
    
    // True Range
    for (let i = 0; i < high.length; i++) {
      if (i === 0) {
        tr.push(high[i] - low[i]);
      } else {
        const hl = high[i] - low[i];
        const hc = Math.abs(high[i] - close[i - 1]);
        const lc = Math.abs(low[i] - close[i - 1]);
        tr.push(Math.max(hl, hc, lc));
      }
    }
    
    // ATR (EMA of TR)
    const multiplier = 1 / period;
    for (let i = 0; i < tr.length; i++) {
      if (i < period - 1) {
        atr.push(null);
      } else if (i === period - 1) {
        const sum = tr.slice(0, period).reduce((a, b) => a + b, 0);
        atr.push(sum / period);
      } else {
        atr.push((tr[i] - atr[i - 1]) * multiplier + atr[i - 1]);
      }
    }
    
    return atr;
  },

  /**
   * Calculate MA based on type (unified helper)
   * @param {Array<number>} prices - Price array
   * @param {string} type - MA type (SMA, EMA, HMA, KAMA)
   * @param {number} period - Period length
   * @returns {Array<number|null>} MA values
   */
  calculateMA(prices, type, period) {
    switch (type) {
      case 'SMA': return this.calculateSMA(prices, period);
      case 'EMA': return this.calculateEMA(prices, period);
      case 'HMA': return this.calculateHMA(prices, period);
      case 'KAMA': return this.calculateKAMA(prices, period);
      default: return this.calculateSMA(prices, period);
    }
  },

  /**
   * Calculate RSI as array (returns aligned array with nulls for warmup)
   * @param {Array<number>} prices - Price array
   * @param {number} period - Period length (default 14)
   * @returns {Array<number|null>} RSI values
   */
  calculateRSIArray(prices, period = 14) {
    const rsi = [];
    
    if (!prices || prices.length < period + 1) {
      return prices ? prices.map(() => null) : [];
    }

    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    // Initial average gain and loss
    let avgGain = 0;
    let avgLoss = 0;
    
    for (let i = 0; i < period; i++) {
      if (changes[i] > 0) {
        avgGain += changes[i];
      } else {
        avgLoss += Math.abs(changes[i]);
      }
    }
    
    avgGain /= period;
    avgLoss /= period;

    // Fill warmup period with nulls
    for (let i = 0; i <= period; i++) {
      rsi.push(null);
    }

    // Calculate RSI values
    for (let i = period; i < changes.length; i++) {
      const currentChange = changes[i];
      const gain = currentChange > 0 ? currentChange : 0;
      const loss = currentChange < 0 ? Math.abs(currentChange) : 0;
      
      // Wilder's smoothing
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsiValue = 100 - (100 / (1 + rs));
      
      rsi.push(rsiValue);
    }

    return rsi;
  }
};

// Export the module
export default Indicators;

// Also expose globally for backward compatibility
window.calculateSMA = (prices, period) => Indicators.calculateSMA(prices, period);
window.calculateEMA = (prices, period) => Indicators.calculateEMA(prices, period);
window.calculateHMA = (prices, period) => Indicators.calculateHMA(prices, period);
window.calculateWMA = (prices, period) => Indicators.calculateWMA(prices, period);
window.calculateKAMA = (prices, period, fast, slow) => Indicators.calculateKAMA(prices, period, fast, slow);
window.calculateBB = (prices, period, stdDev) => Indicators.calculateBB(prices, period, stdDev);
window.calculateKC = (high, low, close, period, mult) => Indicators.calculateKC(high, low, close, period, mult);
window.calculateATR = (high, low, close, period) => Indicators.calculateATR(high, low, close, period);
window.calculateMA = (prices, type, period) => Indicators.calculateMA(prices, type, period);
window.calculateRSIArray = (prices, period) => Indicators.calculateRSIArray(prices, period);

console.log('[INIT] Indicators module loaded');
