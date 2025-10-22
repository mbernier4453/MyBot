/**
 * S&P 500 Data Loader
 * Loads S&P 500 constituents from CSV and fetches real market caps from Polygon
 */

// Parse CSV data
async function loadSP500FromCSV() {
  try {
    const response = await fetch('../spy503.csv');
    const csvText = await response.text();
    
    const lines = csvText.split('\n');
    const headers = lines[0].split(',');
    
    const stocks = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      // Parse CSV line (handle quoted fields)
      const values = parseCSVLine(lines[i]);
      if (values.length < 4) continue;
      
      stocks.push({
        ticker: values[0],
        name: values[1],
        sector: values[2],
        subIndustry: values[3]
      });
    }
    
    console.log(`[SP500] Loaded ${stocks.length} stocks from CSV`);
    return stocks;
  } catch (error) {
    console.error('[SP500] Error loading CSV:', error);
    return [];
  }
}

// Parse CSV line handling quoted fields
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Fetch market cap for a single ticker from Polygon ticker details API
async function fetchTickerDetails(ticker) {
  try {
    const result = await window.electronAPI.polygonGetTickerDetails(ticker);
    if (result.success && result.data) {
      return {
        ticker: ticker,
        marketCap: result.data.market_cap || null,
        name: result.data.name || ticker
      };
    }
  } catch (error) {
    console.error(`[SP500] Error fetching details for ${ticker}:`, error);
  }
  return { ticker, marketCap: null, name: ticker };
}

// Fetch market caps for all tickers (with batching and progress)
async function fetchAllMarketCaps(tickers, onProgress) {
  const BATCH_SIZE = 10; // Fetch 10 at a time to avoid rate limits
  const BATCH_DELAY = 1000; // 1 second between batches
  
  const results = new Map();
  let completed = 0;
  
  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    const batch = tickers.slice(i, i + BATCH_SIZE);
    
    // Fetch batch in parallel
    const promises = batch.map(ticker => fetchTickerDetails(ticker));
    const batchResults = await Promise.all(promises);
    
    // Store results
    batchResults.forEach(result => {
      results.set(result.ticker, result);
    });
    
    completed += batch.length;
    if (onProgress) {
      onProgress(completed, tickers.length);
    }
    
    // Delay between batches (except for last batch)
    if (i + BATCH_SIZE < tickers.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }
  
  return results;
}

// Load S&P 500 data with market caps
export async function loadSP500Data(onProgress) {
  console.log('[SP500] Loading S&P 500 data...');
  
  // Load ticker list from CSV
  const stocks = await loadSP500FromCSV();
  if (stocks.length === 0) {
    console.error('[SP500] No stocks loaded from CSV');
    return null;
  }
  
  // Fetch market caps from Polygon
  console.log('[SP500] Fetching market caps from Polygon...');
  const tickers = stocks.map(s => s.ticker);
  const marketCaps = await fetchAllMarketCaps(tickers, onProgress);
  
  // Combine data
  const sp500Data = {
    bySector: {},
    byTicker: new Map()
  };
  
  stocks.forEach(stock => {
    const details = marketCaps.get(stock.ticker);
    const fullData = {
      ...stock,
      marketCap: details?.marketCap || null,
      name: details?.name || stock.name
    };
    
    // Group by sector
    if (!sp500Data.bySector[stock.sector]) {
      sp500Data.bySector[stock.sector] = [];
    }
    sp500Data.bySector[stock.sector].push(fullData);
    
    // Index by ticker
    sp500Data.byTicker.set(stock.ticker, fullData);
  });
  
  console.log('[SP500] Loaded data for', sp500Data.byTicker.size, 'stocks');
  console.log('[SP500] Sectors:', Object.keys(sp500Data.bySector).sort());
  
  return sp500Data;
}

export default {
  loadSP500Data
};
