/**
 * Chart Drawing Tools Module
 * Provides drawing tools for technical analysis: trend lines, fibonacci, shapes, etc.
 */

class DrawingTools {
  constructor() {
    this.activeDrawingMode = null;
    this.drawings = []; // Store all drawings {type, data, style}
    this.currentDrawing = null; // Drawing in progress
    this.selectedDrawing = null; // Currently selected drawing for editing
    this.isDrawing = false;
    this.startPoint = null;
    
    // Channel tool state (two-click workflow)
    this.channelState = {
      firstLine: null, // Stores first line data
      isSecondClick: false
    };
    
    // Drawing styles
    this.styles = {
      lineColor: '#2196F3',
      lineWidth: 2,
      fillColor: 'rgba(33, 150, 243, 0.1)',
      textColor: '#FFFFFF',
      fontSize: 14
    };
    
    // Available drawing tools
    this.tools = [
      { id: 'pan', icon: '↔', title: 'Pan (default)', category: 'basic' },
      { id: 'drawing', icon: '✏', title: 'Select/Edit Drawing', category: 'basic' },
      { id: 'trendline', icon: '/', title: 'Trend Line', category: 'lines' },
      { id: 'horizontal', icon: '─', title: 'Horizontal Line', category: 'lines' },
      { id: 'vertical', icon: '│', title: 'Vertical Line', category: 'lines' },
      { id: 'fibonacci', icon: 'φ', title: 'Fibonacci Retracement', category: 'fibonacci' },
      { id: 'fib-extension', icon: 'Φ', title: 'Fibonacci Extension', category: 'fibonacci' },
      { id: 'rectangle', icon: '▭', title: 'Rectangle', category: 'shapes' },
      { id: 'ellipse', icon: '○', title: 'Ellipse', category: 'shapes' },
      { id: 'text', icon: 'T', title: 'Text', category: 'annotation' },
      { id: 'arrow', icon: '↗', title: 'Arrow', category: 'annotation' },
      { id: 'measure', icon: '⟷', title: 'Measure Tool', category: 'annotation' }
    ];
    
    this.isExpanded = false;
  }
  
  /**
   * Initialize the drawing toolbar in the DOM
   */
  createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'drawing-toolbar';
    toolbar.innerHTML = `
      <div class="drawing-toolbar-header">
        <span class="drawing-toolbar-title">Tools</span>
        <button class="drawing-toolbar-toggle" title="Close toolbar">✕</button>
      </div>
      
      <div class="drawing-toolbar-content">
        <!-- Basic Tools -->
        <div class="drawing-tool-section">
          <div class="drawing-tool-section-title">Navigation</div>
          <div class="drawing-tool-group" id="drawingToolsBasic"></div>
        </div>
        
        <!-- Lines -->
        <div class="drawing-tool-section">
          <div class="drawing-tool-section-title">Lines</div>
          <div class="drawing-tool-group" id="drawingToolsLines"></div>
        </div>
        
        <!-- Fibonacci -->
        <div class="drawing-tool-section">
          <div class="drawing-tool-section-title">Fibonacci</div>
          <div class="drawing-tool-group" id="drawingToolsFibonacci"></div>
        </div>
        
        <!-- Shapes -->
        <div class="drawing-tool-section">
          <div class="drawing-tool-section-title">Shapes</div>
          <div class="drawing-tool-group" id="drawingToolsShapes"></div>
        </div>
        
        <!-- Annotation -->
        <div class="drawing-tool-section">
          <div class="drawing-tool-section-title">Annotation</div>
          <div class="drawing-tool-group" id="drawingToolsAnnotation"></div>
        </div>
        
        <!-- Actions -->
        <div class="drawing-tool-section">
          <div class="drawing-tool-section-title">Actions</div>
          <div class="drawing-tool-actions">
            <button class="drawing-action-btn" id="clearAllDrawingsBtn" title="Clear All Drawings">
              Clear All
            </button>
            <button class="drawing-action-btn" id="resetZoomBtn" title="Reset Zoom">
              Reset Zoom
            </button>
            <button class="drawing-action-btn" id="clearSelectionBtn" title="Clear Box Selection">
              Clear Selection
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Add text input modal
    const textModal = document.createElement('div');
    textModal.className = 'text-input-modal';
    textModal.style.display = 'none';
    textModal.innerHTML = `
      <div class="text-input-modal-content">
        <div class="text-input-modal-header">
          <span>Enter Text</span>
          <button class="text-input-modal-close">✕</button>
        </div>
        <input type="text" class="text-input-field" placeholder="Enter text..." />
        <div class="text-input-modal-buttons">
          <button class="text-input-btn text-input-cancel">Cancel</button>
          <button class="text-input-btn text-input-ok">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(textModal);
    this.textModal = textModal;
    
    // Populate tool buttons
    this.tools.forEach(tool => {
      const container = toolbar.querySelector(`#drawingTools${this.capitalize(tool.category)}`);
      if (container) {
        const button = document.createElement('button');
        button.className = 'drawing-tool-btn';
        button.dataset.tool = tool.id;
        button.title = tool.title;
        button.innerHTML = `<span class="tool-icon">${tool.icon}</span>`;
        
        // Set pan as default active
        if (tool.id === 'pan') {
          button.classList.add('active');
          this.activeDrawingMode = 'pan';
        }
        
        button.addEventListener('click', () => this.selectTool(tool.id));
        container.appendChild(button);
      }
    });
    
    // Add event listeners
    this.setupToolbarEvents(toolbar);
    
    return toolbar;
  }
  
  /**
   * Setup toolbar event listeners
   */
  setupToolbarEvents(toolbar) {
    // Toggle toolbar visibility
    const toggleBtn = toolbar.querySelector('.drawing-toolbar-toggle');
    toggleBtn?.addEventListener('click', () => {
      this.isExpanded = false;
      toolbar.classList.remove('expanded');
    });
    
    // Clear all drawings
    toolbar.querySelector('#clearAllDrawingsBtn')?.addEventListener('click', () => {
      if (confirm('Clear all drawings?')) {
        this.clearAllDrawings();
      }
    });
    
    // Delete selected drawing
    toolbar.querySelector('#deleteSelectedDrawingBtn')?.addEventListener('click', () => {
      this.deleteSelectedDrawing();
    });
    
    // Reset zoom button
    toolbar.querySelector('#resetZoomBtn')?.addEventListener('click', () => {
      // Trigger Plotly reset
      const chartCanvas = document.querySelector('.chart-tab-content.active .chart-canvas');
      if (chartCanvas && chartCanvas.plotlyChart) {
        window.Plotly.relayout(chartCanvas.plotlyChart, {
          'xaxis.autorange': true,
          'yaxis.autorange': true
        });
      }
    });
    
    // Clear selection button
    toolbar.querySelector('#clearSelectionBtn')?.addEventListener('click', () => {
      const chartCanvas = document.querySelector('.chart-tab-content.active .chart-canvas');
      if (chartCanvas && chartCanvas.plotlyChart) {
        // Clear box selection completely - unselect all points and reset
        const update = {};
        const traceCount = chartCanvas.plotlyChart.data.length;
        for (let i = 0; i < traceCount; i++) {
          update[`selectedpoints[${i}]`] = null;
        }
        
        window.Plotly.restyle(chartCanvas.plotlyChart, update);
        window.Plotly.relayout(chartCanvas.plotlyChart, {
          'dragmode': 'pan',
          'selections': []
        });
        // Reset tool to pan
        this.selectTool('pan');
        console.log('[Drawing Tools] Selection cleared');
      }
    });
    
    // Style controls
    toolbar.querySelector('#drawingLineColor')?.addEventListener('change', (e) => {
      this.styles.lineColor = e.target.value;
      this.updateSelectedDrawingStyle();
    });
    
    toolbar.querySelector('#drawingLineWidth')?.addEventListener('input', (e) => {
      this.styles.lineWidth = parseInt(e.target.value);
      toolbar.querySelector('#drawingLineWidthValue').textContent = e.target.value;
      this.updateSelectedDrawingStyle();
    });
  }
  
  /**
   * Show/expand the toolbar
   */
  expand() {
    const toolbar = document.querySelector('.drawing-toolbar');
    if (toolbar) {
      this.isExpanded = true;
      toolbar.classList.add('expanded');
    }
  }
  
  /**
   * Hide/collapse the toolbar
   */
  collapse() {
    const toolbar = document.querySelector('.drawing-toolbar');
    if (toolbar) {
      this.isExpanded = false;
      toolbar.classList.remove('expanded');
    }
  }
  
  /**
   * Show text input modal and return a promise with the user's input
   */
  showTextInputModal() {
    return new Promise((resolve) => {
      const modal = this.textModal;
      const input = modal.querySelector('.text-input-field');
      const okBtn = modal.querySelector('.text-input-ok');
      const cancelBtn = modal.querySelector('.text-input-cancel');
      const closeBtn = modal.querySelector('.text-input-modal-close');
      
      // Reset input
      input.value = '';
      modal.style.display = 'flex';
      
      // Focus input after a brief delay to ensure modal is visible
      setTimeout(() => input.focus(), 50);
      
      const handleOk = () => {
        const text = input.value.trim();
        modal.style.display = 'none';
        resolve(text || null);
        cleanup();
      };
      
      const handleCancel = () => {
        modal.style.display = 'none';
        resolve(null);
        cleanup();
      };
      
      const handleKeypress = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleOk();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          handleCancel();
        }
      };
      
      const cleanup = () => {
        okBtn.removeEventListener('click', handleOk);
        cancelBtn.removeEventListener('click', handleCancel);
        closeBtn.removeEventListener('click', handleCancel);
        input.removeEventListener('keydown', handleKeypress);
      };
      
      okBtn.addEventListener('click', handleOk);
      cancelBtn.addEventListener('click', handleCancel);
      closeBtn.addEventListener('click', handleCancel);
      input.addEventListener('keydown', handleKeypress);
    });
  }
  
  /**
   * Toggle toolbar visibility
   */
  toggle() {
    if (this.isExpanded) {
      this.collapse();
    } else {
      this.expand();
    }
  }
  
  /**
   * Select a drawing tool
   */
  selectTool(toolId) {
    // Reset channel state when switching tools
    if (this.activeDrawingMode === 'channel' && toolId !== 'channel') {
      this.channelState.firstLine = null;
      this.channelState.isSecondClick = false;
    }
    
    this.activeDrawingMode = toolId;
    
    // Update UI - highlight active tool
    document.querySelectorAll('.drawing-tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === toolId);
    });
    
    // Get active chart canvas
    const chartCanvas = document.querySelector('.chart-tab-content.active .chart-canvas');
    if (!chartCanvas || !chartCanvas.plotlyChart) return;
    
    // Set dragmode and cursor based on tool
    let dragmode = 'pan';
    let cursor = 'default';
    
    if (toolId === 'pan') {
      dragmode = 'pan';
      cursor = 'default'; // Use default arrow cursor
      chartCanvas.classList.remove('drawing-mode');
    } else if (toolId === 'zoom') {
      dragmode = 'zoom';
      cursor = 'crosshair';
      chartCanvas.classList.remove('drawing-mode');
    } else if (toolId === 'select') {
      dragmode = 'select';
      cursor = 'crosshair';
      chartCanvas.classList.remove('drawing-mode');
    } else if (toolId === 'drawing') {
      dragmode = false; // Disable panning for freehand drawing
      cursor = 'crosshair';
      chartCanvas.classList.add('drawing-mode');
      console.log('[Drawing Tools] Freehand drawing mode - drag to draw');
    } else {
      // All other drawing tools - completely disable dragmode
      dragmode = false;
      cursor = 'crosshair';
      chartCanvas.classList.add('drawing-mode');
    }
    
    // Reset channel state when switching away from channel tool
    if (toolId !== 'channel') {
      this.channelState.firstLine = null;
      this.channelState.isSecondClick = false;
    }
    
    // Update Plotly config
    window.Plotly.relayout(chartCanvas.plotlyChart, {
      dragmode: dragmode,
      hovermode: toolId === 'pan' || toolId === 'zoom' || toolId === 'select' ? 'x' : false
    });
    
    console.log(`[Drawing Tools] Selected tool: ${toolId}, dragmode: ${dragmode}, cursor: ${cursor}`);
  }
  
  /**
   * Start drawing on mouse down
   */
  startDrawing(x, y, priceY, timestamp) {
    if (!this.activeDrawingMode || this.activeDrawingMode === 'cursor') return;
    
    this.isDrawing = true;
    this.startPoint = { x, y, priceY, timestamp };
    
    console.log(`[Drawing Tools] Start drawing ${this.activeDrawingMode} at`, this.startPoint);
  }
  
  /**
   * Update drawing on mouse move
   */
  updateDrawing(x, y, priceY, timestamp) {
    if (!this.isDrawing || !this.startPoint) return;
    
    // Create temporary drawing object
    this.currentDrawing = {
      type: this.activeDrawingMode,
      start: this.startPoint,
      end: { x, y, priceY, timestamp },
      style: { ...this.styles }
    };
    
    return this.currentDrawing;
  }
  
  /**
   * Finish drawing on mouse up
   */
  finishDrawing(x, y, priceY, timestamp) {
    if (!this.isDrawing || !this.startPoint) return null;
    
    this.isDrawing = false;
    
    const drawing = {
      type: this.activeDrawingMode,
      start: this.startPoint,
      end: { x, y, priceY, timestamp },
      style: { ...this.styles },
      id: Date.now()
    };
    
    this.drawings.push(drawing);
    this.currentDrawing = null;
    
    console.log(`[Drawing Tools] Finished drawing:`, drawing);
    
    return drawing;
  }
  
  /**
   * Cancel current drawing
   */
  cancelDrawing() {
    this.isDrawing = false;
    this.currentDrawing = null;
    this.startPoint = null;
  }
  
  /**
   * Select a drawing for editing
   */
  selectDrawing(drawingId) {
    this.selectedDrawing = this.drawings.find(d => d.id === drawingId);
    
    // Update delete button state
    const deleteBtn = document.querySelector('#deleteSelectedDrawingBtn');
    if (deleteBtn) {
      deleteBtn.disabled = !this.selectedDrawing;
    }
    
    // Update style controls to match selected drawing
    if (this.selectedDrawing) {
      document.querySelector('#drawingLineColor').value = this.selectedDrawing.style.lineColor;
      document.querySelector('#drawingLineWidth').value = this.selectedDrawing.style.lineWidth;
      document.querySelector('#drawingLineWidthValue').textContent = this.selectedDrawing.style.lineWidth;
    }
  }
  
  /**
   * Delete selected drawing
   */
  deleteSelectedDrawing() {
    if (!this.selectedDrawing) return;
    
    this.drawings = this.drawings.filter(d => d.id !== this.selectedDrawing.id);
    this.selectedDrawing = null;
    
    const deleteBtn = document.querySelector('#deleteSelectedDrawingBtn');
    if (deleteBtn) deleteBtn.disabled = true;
  }
  
  /**
   * Clear all drawings
   */
  clearAllDrawings() {
    const chartCanvas = document.querySelector('.chart-tab-content.active .chart-canvas');
    if (chartCanvas && chartCanvas.plotlyChart) {
      // Remove all shapes and annotations from chart
      window.Plotly.relayout(chartCanvas.plotlyChart, {
        shapes: [],
        annotations: []
      });
    }
    
    this.drawings = [];
    this.selectedDrawing = null;
    this.currentDrawing = null;
    this.cancelDrawing();
    
    console.log('[Drawing Tools] All drawings cleared');
  }
  
  /**
   * Update selected drawing style
   */
  updateSelectedDrawingStyle() {
    if (this.selectedDrawing) {
      this.selectedDrawing.style = { ...this.styles };
    }
  }
  
  /**
   * Get all drawings
   */
  getAllDrawings() {
    return this.drawings;
  }
  
  /**
   * Get current drawing in progress
   */
  getCurrentDrawing() {
    return this.currentDrawing;
  }
  
  /**
   * Helper to capitalize first letter
   */
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  
  /**
   * Initialize mouse event handlers for drawing on chart
   */
  initializeChartMouseEvents() {
    const chartCanvas = document.querySelector('.chart-tab-content.active .chart-canvas');
    if (!chartCanvas || !chartCanvas.plotlyChart) {
      console.log('[Drawing Tools] No chart canvas found for mouse events');
      return;
    }

    // Find the actual SVG layer that Plotly uses
    const plotlyDiv = chartCanvas;
    const targetElement = plotlyDiv; // Attach directly to plotly div, not drag layer
    
    let drawStart = null;
    let previewShapeIndex = -1;
    let drawingPath = []; // Store path points for freehand drawing

    const mouseDownHandler = (e) => {
      // Only handle if we're in a drawing tool mode
      if (this.activeDrawingMode === 'pan' || 
          this.activeDrawingMode === 'zoom' || 
          this.activeDrawingMode === 'select') {
        return;
      }

      const rect = chartCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      drawStart = { x, y, time: Date.now() };
      
      if (this.activeDrawingMode === 'drawing') {
        drawingPath = [{ x, y }];
        const currentShapes = (chartCanvas.plotlyChart.layout.shapes || []).filter(s => s.type !== 'path');
        window.Plotly.relayout(chartCanvas.plotlyChart, {
          shapes: currentShapes
        });
      }
      
      e.stopPropagation();
    };

    const mouseMoveHandler = (e) => {
      if (!drawStart) return;
      
      if (this.activeDrawingMode === 'pan' || 
          this.activeDrawingMode === 'zoom' || 
          this.activeDrawingMode === 'select') {
        // Let Plotly handle pan/zoom/select
        return;
      }
      
      e.stopPropagation();
      e.preventDefault();
      
      const rect = chartCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // For freehand drawing, collect path points
      if (this.activeDrawingMode === 'drawing') {
        drawingPath.push({ x, y });
        // Update preview path
        this.updateFreehandPreview(chartCanvas, drawingPath);
        return;
      }
      
      // Update preview shape in real-time (including channel parallel line preview)
      this.updatePreviewShape(chartCanvas, drawStart.x, drawStart.y, x, y);
    };

    const mouseUpHandler = (e) => {
      if (!drawStart) return;
      
      if (this.activeDrawingMode === 'pan' || 
          this.activeDrawingMode === 'zoom' || 
          this.activeDrawingMode === 'select') {
        drawStart = null;
        return;
      }
      
      e.stopPropagation();
      e.preventDefault();
      
      if (this.activeDrawingMode === 'drawing') {
        if (drawingPath.length > 2) {
          this.createFreehandPath(chartCanvas, drawingPath);
        }
        drawStart = null;
        drawingPath = [];
        this.selectTool('pan');
        return;
      }
      
      const rect = chartCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      this.createPlotlyShape(chartCanvas, drawStart.x, drawStart.y, x, y);
      
      drawStart = null;
      
      if (this.activeDrawingMode !== 'channel' || !this.channelState.isSecondClick) {
        if (this.activeDrawingMode !== 'channel') {
          this.selectTool('pan');
        }
      }
    };

    // Remove old handlers if they exist
    if (targetElement._drawingMouseDown) {
      targetElement.removeEventListener('mousedown', targetElement._drawingMouseDown, true);
      targetElement.removeEventListener('mousedown', targetElement._drawingMouseDown, false);
    }
    if (targetElement._drawingMouseMove) {
      targetElement.removeEventListener('mousemove', targetElement._drawingMouseMove, true);
      targetElement.removeEventListener('mousemove', targetElement._drawingMouseMove, false);
    }
    if (targetElement._drawingMouseUp) {
      targetElement.removeEventListener('mouseup', targetElement._drawingMouseUp, true);
      targetElement.removeEventListener('mouseup', targetElement._drawingMouseUp, false);
    }

    // Add handlers only on capture phase to intercept before Plotly
    targetElement.addEventListener('mousedown', mouseDownHandler, true);
    targetElement.addEventListener('mousemove', mouseMoveHandler, true);
    targetElement.addEventListener('mouseup', mouseUpHandler, true);
    
    // Store handlers so we can remove them later
    targetElement._drawingMouseDown = mouseDownHandler;
    targetElement._drawingMouseMove = mouseMoveHandler;
    targetElement._drawingMouseUp = mouseUpHandler;
  }

  /**
   * Update freehand path preview while drawing
   */
  updateFreehandPreview(chartCanvas, pathPoints) {
    if (!chartCanvas || !chartCanvas.plotlyChart || pathPoints.length < 2) return;

    // Use paper coordinates for preview WITH Y-FLIP
    const layout = chartCanvas.plotlyChart._fullLayout;
    
    const paperPath = [];
    for (let i = 0; i < pathPoints.length; i++) {
      const paperX = pathPoints[i].x / layout.width;
      const paperY = 1 - (pathPoints[i].y / layout.height); // FLIP Y AXIS
      paperPath.push({ x: paperX, y: paperY });
    }
    
    // Create SVG path string
    let pathStr = 'M' + paperPath[0].x + ',' + paperPath[0].y;
    for (let i = 1; i < paperPath.length; i++) {
      pathStr += ' L' + paperPath[i].x + ',' + paperPath[i].y;
    }
    
    // Create path shape
    const pathShape = {
      type: 'path',
      path: pathStr,
      xref: 'paper',
      yref: 'paper',
      line: {
        color: '#2196F3',
        width: 2,
        dash: 'dot'
      },
      _isPreview: true
    };
    
    // Remove previous preview and add new one
    let currentShapes = (chartCanvas.plotlyChart.layout.shapes || []).filter(s => !s._isPreview);
    currentShapes.push(pathShape);
    
    window.Plotly.relayout(chartCanvas.plotlyChart, {
      shapes: currentShapes
    });
  }

  /**
   * Create final freehand path
   */
  createFreehandPath(chartCanvas, pathPoints) {
    if (!chartCanvas || !chartCanvas.plotlyChart || pathPoints.length < 2) return;

    // Use paper coordinates (0-1 range) for SVG paths
    const layout = chartCanvas.plotlyChart._fullLayout;
    
    // Convert canvas coordinates to paper coordinates WITH Y-FLIP
    const paperPath = [];
    for (let i = 0; i < pathPoints.length; i++) {
      const paperX = pathPoints[i].x / layout.width;
      const paperY = 1 - (pathPoints[i].y / layout.height); // FLIP Y AXIS
      paperPath.push({ x: paperX, y: paperY });
    }
    
    // Create SVG path string
    let pathStr = 'M' + paperPath[0].x + ',' + paperPath[0].y;
    for (let i = 1; i < paperPath.length; i++) {
      pathStr += ' L' + paperPath[i].x + ',' + paperPath[i].y;
    }
    
    // Create final path shape using paper coordinates
    const pathShape = {
      type: 'path',
      path: pathStr,
      xref: 'paper',
      yref: 'paper',
      line: {
        color: '#2196F3',
        width: 2
      }
    };
    
    // Remove preview shapes and add final path
    const currentShapes = (chartCanvas.plotlyChart.layout.shapes || []).filter(s => !s._isPreview);
    currentShapes.push(pathShape);
    
    window.Plotly.relayout(chartCanvas.plotlyChart, {
      shapes: currentShapes
    });
    
    this.drawings.push({
      type: 'freehand',
      shape: pathShape,
      timestamp: Date.now()
    });
    
    console.log('[Drawing Tools] Created freehand path with', pathPoints.length, 'points');
  }

  /**
   * Update preview shape while dragging
   */
  updatePreviewShape(chartCanvas, x1, y1, x2, y2) {
    if (!chartCanvas || !chartCanvas.plotlyChart) return;

    const xaxis = chartCanvas.plotlyChart._fullLayout.xaxis;
    const yaxis = chartCanvas.plotlyChart._fullLayout.yaxis;
    
    // Apply axis offset correction (same as createPlotlyShape)
    const plotX1 = x1 - xaxis._offset;
    const plotY1 = y1 - yaxis._offset;
    const plotX2 = x2 - xaxis._offset;
    const plotY2 = y2 - yaxis._offset;
    
    const dataX1 = xaxis.p2d(plotX1);
    const dataY1 = yaxis.p2d(plotY1);
    const dataX2 = xaxis.p2d(plotX2);
    const dataY2 = yaxis.p2d(plotY2);

    let shape = {
      type: 'line',
      x0: dataX1,
      y0: dataY1,
      x1: dataX2,
      y1: dataY2,
      line: {
        color: '#2196F3',
        width: 2,
        dash: 'dot' // Preview is dotted
      },
      _isPreview: true // Mark as preview for easy identification
    };

    // Adjust based on tool type
    if (this.activeDrawingMode === 'horizontal') {
      shape.x0 = 0;
      shape.x1 = 1;
      shape.y1 = dataY1;
      shape.xref = 'paper';
    } else if (this.activeDrawingMode === 'vertical') {
      shape.y0 = 0;
      shape.y1 = 1;
      shape.x1 = dataX1;
      shape.yref = 'paper';
    } else if (this.activeDrawingMode === 'rectangle') {
      shape.type = 'rect';
      shape.fillcolor = '#2196F3';
      shape.opacity = 0.1;
      shape.line = { width: 1, dash: 'dot', color: '#2196F3' };
    } else if (this.activeDrawingMode === 'ellipse') {
      shape.type = 'circle';
      shape.fillcolor = '#2196F3';
      shape.opacity = 0.1;
      shape.line = { width: 1, dash: 'dot', color: '#2196F3' };
    }

    // Remove ALL previous preview shapes
    let currentShapes = (chartCanvas.plotlyChart.layout.shapes || []).filter(s => !s._isPreview);
    
    // Add new preview
    currentShapes.push(shape);
    
    // For channel tool second click, also show preview of parallel line
    if (this.activeDrawingMode === 'channel' && this.channelState.isSecondClick && this.channelState.firstLine) {
      const firstLine = this.channelState.firstLine;
      const firstLineAvgY = (firstLine.dataY1 + firstLine.dataY2) / 2;
      const clickY = (dataY1 + dataY2) / 2;
      const offset = clickY - firstLineAvgY;
      
      console.log('[Channel Preview] Showing parallel line preview, offset:', offset);
      
      const parallelPreview = {
        type: 'line',
        x0: firstLine.dataX1,
        y0: firstLine.dataY1 + offset,
        x1: firstLine.dataX2,
        y1: firstLine.dataY2 + offset,
        line: {
          color: '#4CAF50',
          width: 2,
          dash: 'dash'
        },
        _isPreview: true
      };
      currentShapes.push(parallelPreview);
    }
    
    window.Plotly.relayout(chartCanvas.plotlyChart, {
      shapes: currentShapes
    });
  }

  /**
   * Create a Plotly shape based on drawing tool
   */
  createPlotlyShape(chartCanvas, x1, y1, x2, y2) {
    if (!chartCanvas || !chartCanvas.plotlyChart) return;

    // Convert pixel coordinates to data coordinates
    // p2d expects coordinates relative to the plot area, so we need to subtract the axis offset
    const xaxis = chartCanvas.plotlyChart._fullLayout.xaxis;
    const yaxis = chartCanvas.plotlyChart._fullLayout.yaxis;
    
    // Get pixel positions relative to plot area (subtract axis offset from canvas position)
    const plotX1 = x1 - xaxis._offset;
    const plotY1 = y1 - yaxis._offset;
    const plotX2 = x2 - xaxis._offset;
    const plotY2 = y2 - yaxis._offset;
    
    const dataX1 = xaxis.p2d(plotX1);
    const dataY1 = yaxis.p2d(plotY1);
    const dataX2 = xaxis.p2d(plotX2);
    const dataY2 = yaxis.p2d(plotY2);
    
    console.log(`[Drawing Tools] Canvas: (${x1}, ${y1}) -> Plot: (${plotX1}, ${plotY1}) -> Data: (${dataX1}, ${dataY1})`);
    console.log(`[Drawing Tools] Canvas: (${x2}, ${y2}) -> Plot: (${plotX2}, ${plotY2}) -> Data: (${dataX2}, ${dataY2})`);

    let shape = {
      type: 'line',
      x0: dataX1,
      y0: dataY1,
      x1: dataX2,
      y1: dataY2,
      line: {
        color: this.styles.lineColor || '#2196F3',
        width: this.styles.lineWidth || 2
      }
    };

    // Adjust shape based on tool type
    if (this.activeDrawingMode === 'horizontal') {
      shape.x0 = 0;
      shape.x1 = 1;
      shape.y1 = dataY1; // Keep horizontal at start Y
      shape.xref = 'paper'; // Full width
      
      // Add price label annotation
      const currentAnnotations = chartCanvas.plotlyChart.layout.annotations || [];
      const priceAnnotation = {
        x: 1,
        y: dataY1,
        xref: 'paper',
        yref: 'y',
        text: `$${dataY1.toFixed(2)}`,
        showarrow: false,
        xanchor: 'left',
        font: {
          size: 11,
          color: '#2196F3'
        },
        bgcolor: 'rgba(33, 150, 243, 0.1)',
        borderpad: 3
      };
      currentAnnotations.push(priceAnnotation);
      
      window.Plotly.relayout(chartCanvas.plotlyChart, {
        annotations: currentAnnotations
      });
    } else if (this.activeDrawingMode === 'vertical') {
      shape.y0 = 0;
      shape.y1 = 1;
      shape.x1 = dataX1; // Keep vertical at start X
      shape.yref = 'paper'; // Full height
    } else if (this.activeDrawingMode === 'rectangle') {
      shape.type = 'rect';
      shape.fillcolor = this.styles.lineColor || '#2196F3';
      shape.opacity = 0.3;
      shape.line.width = 2;
    } else if (this.activeDrawingMode === 'ellipse') {
      shape.type = 'circle';
      shape.fillcolor = this.styles.lineColor || '#2196F3';
      shape.opacity = 0.3;
      shape.line.width = 2;
    } else if (this.activeDrawingMode === 'channel') {
      // Two-click workflow: 1) Draw main line, 2) Click above/below to create parallel
      if (!this.channelState.isSecondClick) {
        // First click - draw the main trend line
        const trendLine = {
          type: 'line',
          x0: dataX1,
          y0: dataY1,
          x1: dataX2,
          y1: dataY2,
          line: {
            color: '#2196F3',
            width: 2
          }
        };
        
        // Store first line and add to chart
        this.channelState.firstLine = { dataX1, dataY1, dataX2, dataY2, shape: trendLine };
        this.channelState.isSecondClick = true;
        
        const currentShapes = chartCanvas.plotlyChart.layout.shapes || [];
        const filteredShapes = currentShapes.filter(s => !s._isPreview);
        
        window.Plotly.relayout(chartCanvas.plotlyChart, {
          shapes: [...filteredShapes, trendLine]
        });
        
        console.log('[Drawing Tools] Channel: First line drawn, click to place parallel line');
        return; // Stay in channel mode for second click
      } else {
        // Second click - create parallel line based on Y distance from first line
        const firstLine = this.channelState.firstLine;
        
        console.log('[Drawing Tools] Channel second click:', { dataX1, dataY1, dataX2, dataY2 });
        console.log('[Drawing Tools] First line:', firstLine);
        
        // Simply use the Y offset between the two lines
        // Average Y of second click minus average Y of first line
        const firstLineAvgY = (firstLine.dataY1 + firstLine.dataY2) / 2;
        const clickY = Math.abs(dataX2 - dataX1) < 0.001 && Math.abs(dataY2 - dataY1) < 0.001 
          ? dataY1  // Single click - use exact position
          : (dataY1 + dataY2) / 2;  // Drag - use midpoint
        
        const offset = clickY - firstLineAvgY; // Y offset from first line
        
        console.log('[Drawing Tools] Calculated offset:', offset, 'from click Y:', clickY, 'first line avg Y:', firstLineAvgY);
        
        // Create parallel line with same endpoints, offset by Y distance
        const parallelLine = {
          type: 'line',
          x0: firstLine.dataX1,
          y0: firstLine.dataY1 + offset,
          x1: firstLine.dataX2,
          y1: firstLine.dataY2 + offset,
          line: {
            color: '#2196F3',
            width: 2,
            dash: 'dash'
          }
        };
        
        const currentShapes = chartCanvas.plotlyChart.layout.shapes || [];
        const filteredShapes = currentShapes.filter(s => !s._isPreview);
        
        window.Plotly.relayout(chartCanvas.plotlyChart, {
          shapes: [...filteredShapes, parallelLine]
        });
        
        this.drawings.push({
          type: 'channel',
          shapes: [firstLine.shape, parallelLine],
          timestamp: Date.now()
        });
        
        // Reset channel state
        this.channelState.firstLine = null;
        this.channelState.isSecondClick = false;
        
        console.log('[Drawing Tools] Channel completed with parallel line');
        
        // Switch back to pan mode
        this.selectTool('pan');
        return;
      }
    } else if (this.activeDrawingMode === 'fibonacci' || this.activeDrawingMode === 'fib-extension') {
      // Create fibonacci retracement levels with proper labels
      const levels = this.activeDrawingMode === 'fibonacci' 
        ? [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
        : [0, 0.382, 0.5, 0.618, 1, 1.272, 1.618, 2.618]; // Extensions
      
      const currentShapes = chartCanvas.plotlyChart.layout.shapes || [];
      const currentAnnotations = chartCanvas.plotlyChart.layout.annotations || [];
      const priceRange = Math.abs(dataY2 - dataY1);
      
      levels.forEach(level => {
        const y = dataY1 + (dataY2 - dataY1) * level;
        const percentLabel = this.activeDrawingMode === 'fibonacci'
          ? `${(level * 100).toFixed(1)}%`
          : level > 1 
            ? `${((level - 1) * 100).toFixed(1)}%` // Extension levels
            : `${(level * 100).toFixed(1)}%`;
        
        const fibShape = {
          type: 'line',
          x0: dataX1,
          y0: y,
          x1: dataX2,
          y1: y,
          line: {
            color: level === 0 || level === 1 ? '#2196F3' : '#FFC107',
            width: level === 0.5 ? 2 : 1,
            dash: level === 0 || level === 1 ? 'solid' : 'dot'
          }
        };
        currentShapes.push(fibShape);
        
        // Add label with percentage and price
        const labelAnnotation = {
          x: dataX2,
          y: y,
          xref: 'x',
          yref: 'y',
          text: `${percentLabel} ($${y.toFixed(2)})`,
          showarrow: false,
          xanchor: 'left',
          font: {
            size: 10,
            color: level === 0 || level === 1 ? '#2196F3' : '#FFC107'
          },
          bgcolor: 'rgba(0, 0, 0, 0.6)',
          borderpad: 2
        };
        currentAnnotations.push(labelAnnotation);
        
        this.drawings.push({
          type: 'fibonacci-level',
          shape: fibShape,
          annotation: labelAnnotation,
          timestamp: Date.now(),
          level: level
        });
      });
      
      window.Plotly.relayout(chartCanvas.plotlyChart, {
        shapes: currentShapes,
        annotations: currentAnnotations
      });
      
      console.log(`[Drawing Tools] Created fibonacci with ${levels.length} levels`);
      return; // Exit early since we already added shapes
    } else if (this.activeDrawingMode === 'text') {
      // Show modal for text input (async)
      this.showTextInputModal().then(userText => {
        if (!userText) {
          // User cancelled - switch back to pan
          this.selectTool('pan');
          return;
        }
        
        // Create annotation with user's text at end point
        const annotation = {
          x: dataX2,
          y: dataY2,
          text: userText,
          showarrow: false,
          font: {
            size: 14,
            color: '#2196F3'
          },
          bgcolor: 'rgba(0,0,0,0.7)',
          borderpad: 4,
          captureevents: true
        };
        
        const currentAnnotations = chartCanvas.plotlyChart.layout.annotations || [];
        window.Plotly.relayout(chartCanvas.plotlyChart, {
          annotations: [...currentAnnotations, annotation]
        });
        
        this.drawings.push({
          type: 'text',
          annotation: annotation,
          timestamp: Date.now()
        });
        
        console.log(`[Drawing Tools] Created text annotation: "${userText}"`);
        
        // Switch back to pan mode
        this.selectTool('pan');
      });
      return; // Exit early - annotation will be added in promise
    } else if (this.activeDrawingMode === 'arrow') {
      // Create arrow annotation
      const annotation = {
        x: dataX2,
        y: dataY2,
        ax: dataX1,
        ay: dataY1,
        xref: 'x',
        yref: 'y',
        axref: 'x',
        ayref: 'y',
        showarrow: true,
        arrowhead: 2,
        arrowsize: 1,
        arrowwidth: 2,
        arrowcolor: this.styles.lineColor || '#2196F3'
      };
      
      const currentAnnotations = chartCanvas.plotlyChart.layout.annotations || [];
      window.Plotly.relayout(chartCanvas.plotlyChart, {
        annotations: [...currentAnnotations, annotation]
      });
      
      this.drawings.push({
        type: 'arrow',
        annotation: annotation,
        timestamp: Date.now()
      });
      
      console.log(`[Drawing Tools] Created arrow annotation`);
      return;
    } else if (this.activeDrawingMode === 'measure') {
      // Measure tool - show distance, % change, time period, and candle count
      const priceChange = dataY2 - dataY1;
      const percentChange = ((priceChange / dataY1) * 100).toFixed(2);
      
      // Calculate time difference
      const timeDiff = Math.abs(dataX2 - dataX1);
      const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      // Try to calculate number of candles (assume daily data for now)
      const numCandles = Math.abs(days) || 1;
      
      // Format time period
      let timePeriod = '';
      if (days > 0) {
        timePeriod = days === 1 ? '1 day' : `${days} days`;
      } else if (hours > 0) {
        timePeriod = hours === 1 ? '1 hour' : `${hours} hours`;
      } else {
        timePeriod = 'Same time';
      }
      
      // Create the line
      shape.line.width = 2;
      shape.line.color = percentChange >= 0 ? '#4CAF50' : '#F44336';
      shape.editable = true;
      
      // Create label annotation with stats
      const midX = (dataX1 + dataX2) / 2;
      const midY = (dataY1 + dataY2) / 2;
      
      const labelText = `${percentChange >= 0 ? '+' : ''}${percentChange}% | ${timePeriod} | ${numCandles} candle${numCandles !== 1 ? 's' : ''}`;
      
      const annotation = {
        x: midX,
        y: midY,
        xref: 'x',
        yref: 'y',
        text: labelText,
        showarrow: false,
        font: {
          size: 11,
          color: '#FFFFFF'
        },
        bgcolor: percentChange >= 0 ? 'rgba(76, 175, 80, 0.8)' : 'rgba(244, 67, 54, 0.8)',
        captureevents: true,
        editable: true,
        borderpad: 4,
        bordercolor: percentChange >= 0 ? '#4CAF50' : '#F44336',
        borderwidth: 1
      };
      
      // Remove preview shapes
      let currentShapes = (chartCanvas.plotlyChart.layout.shapes || []).filter(s => !s._isPreview);
      currentShapes.push(shape);
      
      const currentAnnotations = chartCanvas.plotlyChart.layout.annotations || [];
      
      window.Plotly.relayout(chartCanvas.plotlyChart, {
        shapes: currentShapes,
        annotations: [...currentAnnotations, annotation]
      });
      
      this.drawings.push({
        type: 'measure',
        shape: shape,
        annotation: annotation,
        timestamp: Date.now()
      });
      
      console.log(`[Drawing Tools] Created measure: ${labelText}`);
      return;
    }

    // Remove ALL preview shapes before adding final shape
    let currentShapes = (chartCanvas.plotlyChart.layout.shapes || []).filter(s => !s._isPreview);
    
    // Add final shape to chart
    currentShapes.push(shape);
    window.Plotly.relayout(chartCanvas.plotlyChart, {
      shapes: currentShapes
    });

    // Store drawing with ID for later editing
    const drawingId = Date.now();
    this.drawings.push({
      id: drawingId,
      type: this.activeDrawingMode,
      shape: shape,
      timestamp: drawingId
    });

    console.log(`[Drawing Tools] Created ${this.activeDrawingMode} shape`, shape);
  }
  
  /**
   * Enable shape editing by making shapes draggable
   */
  enableShapeEditing(chartCanvas) {
    if (!chartCanvas || !chartCanvas.plotlyChart) return;
    
    // Set up context menu for right-click editing
    this.setupShapeContextMenu(chartCanvas);
    
    console.log('[Drawing Tools] Shape editing enabled - right-click shapes to edit');
  }
  
  /**
   * Set up context menu for shape editing
   */
  setupShapeContextMenu(chartCanvas) {
    if (!chartCanvas || !chartCanvas.plotlyChart) return;

    // Add right-click listener to chart
    chartCanvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      
      const shapes = chartCanvas.plotlyChart.layout.shapes || [];
      if (shapes.length === 0) return;
      
      // Get click coordinates relative to chart
      const rect = chartCanvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      
      // Find which shape was clicked
      const shapeIndex = this.findShapeAtPoint(chartCanvas, clickX, clickY, shapes);
      
      if (shapeIndex >= 0) {
        this.showShapeContextMenu(chartCanvas, e.clientX, e.clientY, shapeIndex);
      }
    });
  }
  
  /**
   * Find which shape is at the given point
   */
  findShapeAtPoint(chartCanvas, x, y, shapes) {
    const xaxis = chartCanvas.plotlyChart._fullLayout.xaxis;
    const yaxis = chartCanvas.plotlyChart._fullLayout.yaxis;
    
    // Convert click to data coordinates
    const plotX = x - xaxis._offset;
    const plotY = y - yaxis._offset;
    const dataX = xaxis.p2d(plotX);
    const dataY = yaxis.p2d(plotY);
    
    // Check each shape from last to first (top to bottom)
    for (let i = shapes.length - 1; i >= 0; i--) {
      const shape = shapes[i];
      if (shape._isPreview) continue; // Skip preview shapes
      
      // Check if click is near this shape (within tolerance)
      const tolerance = 10; // pixels
      
      if (shape.type === 'line') {
        // Check if click is near the line
        if (this.isPointNearLine(shape, dataX, dataY, xaxis, yaxis, tolerance)) {
          return i;
        }
      } else if (shape.type === 'rect' || shape.type === 'circle') {
        // Check if click is inside or near the shape bounds
        if (this.isPointInShape(shape, dataX, dataY)) {
          return i;
        }
      } else if (shape.type === 'path') {
        // For paths, just check if it's the most recent one clicked
        // This is approximate - would need more complex path detection
        return i;
      }
    }
    
    return -1; // No shape found
  }
  
  /**
   * Check if point is near a line
   */
  isPointNearLine(shape, dataX, dataY, xaxis, yaxis, tolerance) {
    // Convert shape coordinates to pixels for distance calculation
    const x0 = xaxis.d2p(shape.x0);
    const y0 = yaxis.d2p(shape.y0);
    const x1 = xaxis.d2p(shape.x1);
    const y1 = yaxis.d2p(shape.y1);
    const clickX = xaxis.d2p(dataX);
    const clickY = yaxis.d2p(dataY);
    
    // Calculate distance from point to line segment
    const A = clickX - x0;
    const B = clickY - y0;
    const C = x1 - x0;
    const D = y1 - y0;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) {
      param = dot / lenSq;
    }
    
    let xx, yy;
    
    if (param < 0) {
      xx = x0;
      yy = y0;
    } else if (param > 1) {
      xx = x1;
      yy = y1;
    } else {
      xx = x0 + param * C;
      yy = y0 + param * D;
    }
    
    const dx = clickX - xx;
    const dy = clickY - yy;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance <= tolerance;
  }
  
  /**
   * Check if point is inside a shape
   */
  isPointInShape(shape, dataX, dataY) {
    const x0 = Math.min(shape.x0, shape.x1);
    const x1 = Math.max(shape.x0, shape.x1);
    const y0 = Math.min(shape.y0, shape.y1);
    const y1 = Math.max(shape.y0, shape.y1);
    
    return dataX >= x0 && dataX <= x1 && dataY >= y0 && dataY <= y1;
  }
  
  /**
   * Show context menu for shape editing
   */
  showShapeContextMenu(chartCanvas, x, y, shapeIndex) {
    // Remove existing menu if any
    const existingMenu = document.querySelector('.drawing-context-menu');
    if (existingMenu) existingMenu.remove();
    
    const contextMenu = document.createElement('div');
    contextMenu.className = 'drawing-context-menu';
    contextMenu.style.position = 'fixed';
    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';
    contextMenu.style.zIndex = '10000';
    
    const shapes = chartCanvas.plotlyChart.layout.shapes || [];
    const shape = shapes[shapeIndex];
    const currentColor = shape.line?.color || '#2196F3';
    const currentWidth = shape.line?.width || 2;
    const currentDash = shape.line?.dash || 'solid';
    
    contextMenu.innerHTML = `
      <div class="context-menu-section">
        <div class="context-menu-label">Color</div>
        <div class="context-menu-colors">
          <div class="color-option" data-color="#2196F3" style="background: #2196F3"></div>
          <div class="color-option" data-color="#4CAF50" style="background: #4CAF50"></div>
          <div class="color-option" data-color="#F44336" style="background: #F44336"></div>
          <div class="color-option" data-color="#FFC107" style="background: #FFC107"></div>
          <div class="color-option" data-color="#9C27B0" style="background: #9C27B0"></div>
          <div class="color-option" data-color="#FFFFFF" style="background: #FFFFFF"></div>
        </div>
      </div>
      <div class="context-menu-section">
        <div class="context-menu-label">Width</div>
        <div class="context-menu-widths">
          <div class="width-option" data-width="1">Thin</div>
          <div class="width-option" data-width="2">Normal</div>
          <div class="width-option" data-width="3">Thick</div>
          <div class="width-option" data-width="4">Extra</div>
        </div>
      </div>
      <div class="context-menu-section">
        <div class="context-menu-label">Style</div>
        <div class="context-menu-styles">
          <div class="style-option" data-dash="solid">Solid</div>
          <div class="style-option" data-dash="dot">Dotted</div>
          <div class="style-option" data-dash="dash">Dashed</div>
        </div>
      </div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item danger" data-action="delete">Delete</div>
    `;
    
    document.body.appendChild(contextMenu);
    
    // Handle color changes
    contextMenu.querySelectorAll('.color-option').forEach(option => {
      option.addEventListener('click', () => {
        const color = option.dataset.color;
        this.updateShapeStyle(chartCanvas, shapeIndex, { color });
        contextMenu.remove();
      });
    });
    
    // Handle width changes
    contextMenu.querySelectorAll('.width-option').forEach(option => {
      option.addEventListener('click', () => {
        const width = parseInt(option.dataset.width);
        this.updateShapeStyle(chartCanvas, shapeIndex, { width });
        contextMenu.remove();
      });
    });
    
    // Handle style changes
    contextMenu.querySelectorAll('.style-option').forEach(option => {
      option.addEventListener('click', () => {
        const dash = option.dataset.dash;
        this.updateShapeStyle(chartCanvas, shapeIndex, { dash });
        contextMenu.remove();
      });
    });
    
    // Handle delete
    contextMenu.querySelector('[data-action="delete"]').addEventListener('click', () => {
      this.deleteShape(chartCanvas, shapeIndex);
      contextMenu.remove();
    });
    
    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', function closeMenu(e) {
        if (!contextMenu.contains(e.target)) {
          contextMenu.remove();
          document.removeEventListener('click', closeMenu);
        }
      });
    }, 10);
  }
  
  /**
   * Update shape style
   */
  updateShapeStyle(chartCanvas, shapeIndex, style) {
    if (!chartCanvas || !chartCanvas.plotlyChart) return;
    
    const shapes = [...(chartCanvas.plotlyChart.layout.shapes || [])];
    if (shapeIndex < 0 || shapeIndex >= shapes.length) return;
    
    const shape = shapes[shapeIndex];
    
    if (style.color) {
      if (!shape.line) shape.line = {};
      shape.line.color = style.color;
      if (shape.fillcolor) {
        shape.fillcolor = style.color;
      }
    }
    
    if (style.width) {
      if (!shape.line) shape.line = {};
      shape.line.width = style.width;
    }
    
    if (style.dash) {
      if (!shape.line) shape.line = {};
      shape.line.dash = style.dash;
    }
    
    window.Plotly.relayout(chartCanvas.plotlyChart, { shapes });
  }
  
  /**
   * Delete shape
   */
  deleteShape(chartCanvas, shapeIndex) {
    if (!chartCanvas || !chartCanvas.plotlyChart) return;
    
    const shapes = [...(chartCanvas.plotlyChart.layout.shapes || [])];
    shapes.splice(shapeIndex, 1);
    window.Plotly.relayout(chartCanvas.plotlyChart, { shapes });
  }
  
  /**
   * Handle shape editing actions (old method - keeping for compatibility)
   */
  handleShapeAction(chartCanvas, action) {
    if (!this.selectedDrawing || !chartCanvas || !chartCanvas.plotlyChart) return;
    
    const shapes = chartCanvas.plotlyChart.layout.shapes || [];
    const shapeIndex = this.selectedDrawing.index;
    
    if (action === 'delete') {
      this.deleteShape(chartCanvas, shapeIndex);
      this.selectedDrawing = null;
    }
  }
}

// Export singleton instance
const drawingTools = new DrawingTools();
export default drawingTools;
