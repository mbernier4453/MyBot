/**
 * Debug utility to test condition formatting and API calls
 */

// Test condition formatting
console.log('=== CONDITION FORMAT TEST ===');

// Sample condition from frontend
const testCondition = {
  type: 'price',
  priceType: 'close',
  interaction: 'above',
  target_type: 'SMA',
  target_period: 20,
  target_value: 100,
  threshold_pct: 0,
  delay_bars: 0
};

console.log('Frontend condition:', testCondition);

// Format it like preview.js does
function formatCondition(cond) {
  const baseCondition = {};
  
  if (cond.type === 'price') {
    baseCondition.source = cond.priceType || 'close';
    baseCondition.comparison = cond.interaction === 'cross' 
      ? `crosses_${cond.direction || 'above'}` 
      : cond.interaction || 'above';
    
    if (cond.target_type === 'Value') {
      baseCondition.target = parseFloat(cond.target_value) || 0;
    } else {
      const maType = cond.target_type.toLowerCase();
      const period = cond.target_period || 20;
      baseCondition.target = `${maType}_${period}`;
    }
  }
  
  if (cond.threshold_pct !== undefined && cond.threshold_pct !== 0) {
    baseCondition.threshold_pct = parseFloat(cond.threshold_pct);
  }
  if (cond.delay_bars !== undefined && cond.delay_bars !== 0) {
    baseCondition.delay_bars = parseInt(cond.delay_bars);
  }
  
  return baseCondition;
}

const formatted = formatCondition(testCondition);
console.log('Formatted for backend:', formatted);
console.log('Expected: {source: "close", comparison: "above", target: "sma_20"}');

// Test API call
async function testPreview() {
  const API_BASE_URL = 'http://localhost:5000';
  
  const body = {
    symbol: 'AAPL',
    start_date: '2024-10-01',
    end_date: '2024-10-31',
    indicators: {
      sma_20: { type: 'sma', period: 20 }
    },
    entry_conditions: [
      {
        source: 'close',
        comparison: 'above',
        target: 'sma_20'
      }
    ],
    exit_conditions: []
  };
  
  console.log('\n=== API TEST ===');
  console.log('Calling:', `${API_BASE_URL}/api/backtest/preview`);
  console.log('Body:', JSON.stringify(body, null, 2));
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/backtest/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    const data = await response.json();
    console.log('Response:', data);
    
    if (data.success) {
      console.log(`✓ Success: ${data.data.summary.total_bars} bars, ${data.data.summary.entry_signals} entry signals`);
    } else {
      console.error('✗ Error:', data.error);
    }
  } catch (error) {
    console.error('✗ API call failed:', error);
  }
}

// Run test
testPreview();
