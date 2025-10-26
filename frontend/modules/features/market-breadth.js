/**
 * Market Breadth Page
 * S&P 500 breadth indicators with four charts
 */

class MarketBreadth {
    constructor() {
        this.currentData = {
            adLine: null,
            tick: null,
            highsLows: null,
            percentAboveMA: null
        };
        this.days = 252; // 1 year default
        this.forceRefresh = false;
    }

    async initialize() {
        console.log('[MarketBreadth] Initializing...');
        await this.loadAllData();
        this.render();
        this.attachEventListeners();
    }

    async loadAllData() {
        try {
            this.showLoading('Loading market breadth data...');
            
            // Load all four datasets in parallel
            const [adResult, tickResult, hlResult, maResult] = await Promise.all([
                this.fetchAdvanceDeclineLine(),
                this.fetchTickProxy(),
                this.fetchHighsLows(),
                this.fetchPercentAboveMA()
            ]);

            this.currentData.adLine = adResult;
            this.currentData.tick = tickResult;
            this.currentData.highsLows = hlResult;
            this.currentData.percentAboveMA = maResult;

            this.hideLoading();
        } catch (error) {
            console.error('[MarketBreadth] Error loading data:', error);
            this.hideLoading();
            this.showNotification('Error loading breadth data: ' + error.message, 'error');
        }
    }
    
    showLoading(message) {
        const container = document.getElementById('market-breadth-container');
        if (container) {
            const loadingDiv = document.createElement('div');
            loadingDiv.id = 'breadth-loading';
            loadingDiv.className = 'loading-overlay';
            loadingDiv.innerHTML = `<div class="loading-spinner"></div><p>${message}</p>`;
            container.appendChild(loadingDiv);
        }
    }
    
    hideLoading() {
        const loading = document.getElementById('breadth-loading');
        if (loading) {
            loading.remove();
        }
    }
    
    showNotification(message, type = 'info') {
        console.log(`[MarketBreadth] ${type.toUpperCase()}: ${message}`);
        // Simple alert for now - can be enhanced with a notification system
        if (type === 'error') {
            alert(message);
        }
    }

    async fetchAdvanceDeclineLine() {
        const result = await window.electronAPI.breadthGetADLine({ 
            days: this.days, 
            forceRefresh: this.forceRefresh 
        });
        if (!result.success) {
            throw new Error(result.error || 'Failed to fetch A/D Line data');
        }
        return result;
    }

    async fetchTickProxy() {
        const result = await window.electronAPI.breadthGetTickProxy({ 
            forceRefresh: this.forceRefresh 
        });
        if (!result.success) {
            throw new Error(result.error || 'Failed to fetch TICK data');
        }
        return result;
    }

    async fetchHighsLows() {
        const result = await window.electronAPI.breadthGetHighsLows({ 
            days: this.days, 
            forceRefresh: this.forceRefresh 
        });
        if (!result.success) {
            throw new Error(result.error || 'Failed to fetch Highs/Lows data');
        }
        return result;
    }

    async fetchPercentAboveMA() {
        const result = await window.electronAPI.breadthGetPercentMA({ 
            days: this.days, 
            forceRefresh: this.forceRefresh 
        });
        if (!result.success) {
            throw new Error(result.error || 'Failed to fetch Percent Above MA data');
        }
        return result;
    }

    render() {
        const container = document.getElementById('market-breadth-container');
        if (!container) {
            console.error('[MarketBreadth] Container not found');
            return;
        }

        container.innerHTML = `
            <div class="breadth-header">
                <h2>S&P 500 Market Breadth</h2>
                <div class="breadth-controls">
                    <select id="breadth-timeframe">
                        <option value="63">3 Months</option>
                        <option value="126">6 Months</option>
                        <option value="252" selected>1 Year</option>
                        <option value="504">2 Years</option>
                    </select>
                    <button id="breadth-refresh" class="btn-refresh">
                        <span>↻</span> Refresh
                    </button>
                </div>
            </div>

            <div class="breadth-charts-grid">
                <!-- Chart 1: A/D Line -->
                <div class="breadth-chart-card">
                    <div class="chart-header">
                        <h3>Advance-Decline Line</h3>
                        <div class="chart-stats" id="ad-stats"></div>
                    </div>
                    <div id="ad-line-chart" class="breadth-chart"></div>
                </div>

                <!-- Chart 2: TICK Proxy -->
                <div class="breadth-chart-card">
                    <div class="chart-header">
                        <h3>TICK Proxy (Intraday)</h3>
                        <div class="chart-stats" id="tick-stats"></div>
                    </div>
                    <div id="tick-chart" class="breadth-chart"></div>
                </div>

                <!-- Chart 3: Highs vs Lows -->
                <div class="breadth-chart-card">
                    <div class="chart-header">
                        <h3>52-Week Highs vs Lows</h3>
                        <div class="chart-stats" id="hl-stats"></div>
                    </div>
                    <div id="highs-lows-chart" class="breadth-chart"></div>
                </div>

                <!-- Chart 4: Percent Above MA -->
                <div class="breadth-chart-card">
                    <div class="chart-header">
                        <h3>Percent Above Moving Averages</h3>
                        <div class="chart-stats" id="ma-stats"></div>
                    </div>
                    <div id="percent-ma-chart" class="breadth-chart"></div>
                </div>
            </div>
        `;

        // Render all charts
        this.renderADLineChart();
        this.renderTickChart();
        this.renderHighsLowsChart();
        this.renderPercentMAChart();
    }

    renderADLineChart() {
        if (!this.currentData.adLine) return;

        const { data, stats } = this.currentData.adLine;
        
        // Update stats
        document.getElementById('ad-stats').innerHTML = `
            <span>Current: ${stats.current_ad_line.toLocaleString()}</span>
            <span>10-Day MA: ${stats.ma_10.toLocaleString()}</span>
            <span>Stocks: ${stats.total_stocks}</span>
        `;

        // Prepare chart data
        const dates = data.map(d => d.date);
        const adLine = data.map(d => d.AD_Line);
        const ma10 = data.map(d => d.MA_10);

        const traces = [
            {
                x: dates,
                y: adLine,
                type: 'scatter',
                mode: 'lines',
                name: 'A/D Line',
                line: { color: '#2196F3', width: 2 }
            },
            {
                x: dates,
                y: ma10,
                type: 'scatter',
                mode: 'lines',
                name: '10-Day MA',
                line: { color: '#FF9800', width: 2, dash: 'dash' }
            }
        ];

        const layout = {
            ...this.getBaseLayout(),
            title: '',
            yaxis: { title: 'Cumulative A/D' },
            showlegend: true,
            legend: { x: 0.01, y: 0.99, bgcolor: 'rgba(0,0,0,0.1)' }
        };

        Plotly.newPlot('ad-line-chart', traces, layout, { responsive: true });
    }

    renderTickChart() {
        if (!this.currentData.tick) return;

        const { data, stats } = this.currentData.tick;
        
        // Update stats
        document.getElementById('tick-stats').innerHTML = `
            <span>Max: +${stats.max_tick}</span>
            <span>Min: ${stats.min_tick}</span>
            <span>Mean: ${stats.mean_tick.toFixed(1)}</span>
        `;

        // Prepare chart data
        const timestamps = data.map(d => d.timestamp);
        const tickValues = data.map(d => d.tick);

        // Color bars based on value
        const colors = tickValues.map(v => {
            if (v > 300) return '#4CAF50';
            if (v > 100) return '#8BC34A';
            if (v < -300) return '#F44336';
            if (v < -100) return '#FF5722';
            return '#9E9E9E';
        });

        const traces = [
            {
                x: timestamps,
                y: tickValues,
                type: 'bar',
                name: 'TICK',
                marker: { color: colors }
            }
        ];

        const layout = {
            ...this.getBaseLayout(),
            title: '',
            yaxis: { 
                title: 'TICK Value',
                zeroline: true,
                zerolinecolor: '#666',
                zerolinewidth: 2
            },
            shapes: [
                // Reference lines
                { type: 'line', x0: timestamps[0], x1: timestamps[timestamps.length - 1], y0: 800, y1: 800, line: { color: 'green', width: 1, dash: 'dot' } },
                { type: 'line', x0: timestamps[0], x1: timestamps[timestamps.length - 1], y0: 300, y1: 300, line: { color: 'green', width: 1, dash: 'dot' } },
                { type: 'line', x0: timestamps[0], x1: timestamps[timestamps.length - 1], y0: 100, y1: 100, line: { color: 'green', width: 1, dash: 'dot' } },
                { type: 'line', x0: timestamps[0], x1: timestamps[timestamps.length - 1], y0: -100, y1: -100, line: { color: 'red', width: 1, dash: 'dot' } },
                { type: 'line', x0: timestamps[0], x1: timestamps[timestamps.length - 1], y0: -300, y1: -300, line: { color: 'red', width: 1, dash: 'dot' } },
                { type: 'line', x0: timestamps[0], x1: timestamps[timestamps.length - 1], y0: -800, y1: -800, line: { color: 'red', width: 1, dash: 'dot' } }
            ],
            showlegend: false
        };

        Plotly.newPlot('tick-chart', traces, layout, { responsive: true });
    }

    renderHighsLowsChart() {
        if (!this.currentData.highsLows) return;

        const { data, stats } = this.currentData.highsLows;
        
        // Update stats
        document.getElementById('hl-stats').innerHTML = `
            <span style="color: #4CAF50">Highs: ${stats.current_highs}</span>
            <span style="color: #F44336">Lows: ${stats.current_lows}</span>
            <span>Net: ${stats.net}</span>
        `;

        // Prepare chart data
        const dates = data.map(d => d.date);
        const newHighs = data.map(d => d.new_highs);
        const newLows = data.map(d => d.new_lows);
        const net = data.map(d => d.net);
        const netMA = data.map(d => d.net_ma_10);

        const traces = [
            {
                x: dates,
                y: newHighs,
                type: 'scatter',
                mode: 'lines',
                name: 'New Highs',
                line: { color: '#4CAF50', width: 2 },
                yaxis: 'y'
            },
            {
                x: dates,
                y: newLows,
                type: 'scatter',
                mode: 'lines',
                name: 'New Lows',
                line: { color: '#F44336', width: 2 },
                yaxis: 'y'
            },
            {
                x: dates,
                y: net,
                type: 'scatter',
                mode: 'lines',
                name: 'Net (H-L)',
                line: { color: '#2196F3', width: 2 },
                yaxis: 'y2'
            },
            {
                x: dates,
                y: netMA,
                type: 'scatter',
                mode: 'lines',
                name: 'Net 10-Day MA',
                line: { color: '#FF9800', width: 2, dash: 'dash' },
                yaxis: 'y2'
            }
        ];

        const layout = {
            ...this.getBaseLayout(),
            title: '',
            yaxis: { 
                title: 'Count',
                side: 'left'
            },
            yaxis2: {
                title: 'Net (H-L)',
                side: 'right',
                overlaying: 'y',
                zeroline: true,
                zerolinecolor: '#666',
                zerolinewidth: 2
            },
            showlegend: true,
            legend: { x: 0.01, y: 0.99, bgcolor: 'rgba(0,0,0,0.1)' }
        };

        Plotly.newPlot('highs-lows-chart', traces, layout, { responsive: true });
    }

    renderPercentMAChart() {
        if (!this.currentData.percentAboveMA) return;

        const { data, stats } = this.currentData.percentAboveMA;
        
        // Update stats
        document.getElementById('ma-stats').innerHTML = `
            <span>Above 50-Day: ${stats.current_above_50.toFixed(1)}%</span>
            <span>Above 200-Day: ${stats.current_above_200.toFixed(1)}%</span>
            ${stats.breadth_thrust_detected ? '<span style="color: #4CAF50">⚡ Thrust Detected</span>' : ''}
        `;

        // Prepare chart data
        const dates = data.map(d => d.date);
        const pct50 = data.map(d => d.pct_above_50);
        const pct200 = data.map(d => d.pct_above_200);

        // Mark breadth thrust points
        const thrustDates = data.filter(d => d.breadth_thrust).map(d => d.date);
        const thrustValues = data.filter(d => d.breadth_thrust).map(d => d.pct_above_50);

        const traces = [
            {
                x: dates,
                y: pct50,
                type: 'scatter',
                mode: 'lines',
                name: '% Above 50-Day MA',
                line: { color: '#2196F3', width: 2 }
            },
            {
                x: dates,
                y: pct200,
                type: 'scatter',
                mode: 'lines',
                name: '% Above 200-Day MA',
                line: { color: '#FF9800', width: 2 }
            }
        ];

        // Add thrust markers if any
        if (thrustDates.length > 0) {
            traces.push({
                x: thrustDates,
                y: thrustValues,
                type: 'scatter',
                mode: 'markers',
                name: 'Breadth Thrust',
                marker: { 
                    color: '#4CAF50', 
                    size: 12, 
                    symbol: 'star',
                    line: { color: 'white', width: 2 }
                }
            });
        }

        const layout = {
            ...this.getBaseLayout(),
            title: '',
            yaxis: { 
                title: 'Percent (%)',
                range: [0, 100]
            },
            shapes: [
                // 40% and 61.5% reference lines for breadth thrust
                { type: 'line', x0: dates[0], x1: dates[dates.length - 1], y0: 40, y1: 40, line: { color: 'rgba(244, 67, 54, 0.3)', width: 1, dash: 'dot' } },
                { type: 'line', x0: dates[0], x1: dates[dates.length - 1], y0: 61.5, y1: 61.5, line: { color: 'rgba(76, 175, 80, 0.3)', width: 1, dash: 'dot' } },
                { type: 'line', x0: dates[0], x1: dates[dates.length - 1], y0: 50, y1: 50, line: { color: 'rgba(158, 158, 158, 0.5)', width: 1 } }
            ],
            showlegend: true,
            legend: { x: 0.01, y: 0.99, bgcolor: 'rgba(0,0,0,0.1)' }
        };

        Plotly.newPlot('percent-ma-chart', traces, layout, { responsive: true });
    }

    getBaseLayout() {
        return {
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: '#e0e0e0', family: 'system-ui, -apple-system, sans-serif' },
            margin: { t: 30, b: 50, l: 60, r: 60 },
            xaxis: {
                gridcolor: 'rgba(128,128,128,0.2)',
                showgrid: true,
                type: 'date'
            },
            yaxis: {
                gridcolor: 'rgba(128,128,128,0.2)',
                showgrid: true
            },
            hovermode: 'x unified'
        };
    }

    attachEventListeners() {
        // Timeframe selector
        const timeframeSelect = document.getElementById('breadth-timeframe');
        if (timeframeSelect) {
            timeframeSelect.addEventListener('change', async (e) => {
                this.days = parseInt(e.target.value);
                await this.loadAllData();
                this.render();
            });
        }

        // Refresh button
        const refreshBtn = document.getElementById('breadth-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                this.forceRefresh = true;
                await this.loadAllData();
                this.forceRefresh = false;
                this.render();
            });
        }
    }
}

// Export for ES6 modules
export { MarketBreadth };
