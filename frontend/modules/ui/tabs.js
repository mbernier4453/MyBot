/**
 * Tab Management Module
 * Handles main navigation tabs and results sub-tabs
 */

import * as State from '../core/state.js';

let mainTabs, mainPages, tabs, tabContents;

/**
 * Switch to a specific results sub-tab
 * @param {string} tabName - The name of the tab to switch to
 */
export function switchToTab(tabName) {
  tabs.forEach(t => t.classList.remove('active'));
  tabContents.forEach(tc => tc.classList.remove('active'));
  
  const targetTab = document.querySelector(`.tab[data-tab="${tabName}"]`);
  if (targetTab) {
    targetTab.classList.add('active');
  }
  
  const targetContent = document.getElementById(`${tabName}Tab`);
  if (targetContent) {
    targetContent.classList.add('active');
  }
}

/**
 * Initialize tab management and event listeners
 * @param {Object} elements - DOM elements for tabs
 */
export function initializeTabManagement(elements) {
  mainTabs = elements.mainTabs;
  mainPages = elements.mainPages;
  tabs = elements.tabs;
  tabContents = elements.tabContents;
  
  console.log('[TABS] Initializing tab management');
  console.log('[TABS] mainTabs found:', mainTabs ? mainTabs.length : 0);
  console.log('[TABS] mainPages found:', mainPages ? mainPages.length : 0);
  
  // Main navigation tab switching
  if (mainTabs) {
    mainTabs.forEach(tab => {
      console.log('[TABS] Attaching click handler to main tab:', tab.dataset.mainTab);
      tab.addEventListener('click', () => {
        console.log('[TABS] Main tab clicked:', tab.dataset.mainTab);
        const targetPage = tab.dataset.mainTab;
        
        // Update active states
        mainTabs.forEach(t => t.classList.remove('active'));
        mainPages.forEach(p => p.classList.remove('active'));
        
        tab.classList.add('active');
        const targetPageEl = document.getElementById(`${targetPage}Page`);
        if (targetPageEl) {
          targetPageEl.classList.add('active');
          console.log('[TABS] Switched to page:', targetPage);
          
          // Initialize Market Breadth page when first accessed
          if (targetPage === 'breadth' && window.marketBreadth) {
            const container = document.getElementById('market-breadth-container');
            if (container && !container.hasAttribute('data-initialized')) {
              console.log('[TABS] Initializing Market Breadth page');
              window.marketBreadth.initialize();
              container.setAttribute('data-initialized', 'true');
            }
          }
        } else {
          console.warn('[TABS] Target page not found:', `${targetPage}Page`);
        }
      });
    });
  }
  
  // Results sub-tab switching
  if (tabs) {
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        const currentRun = State.getCurrentRun();
        console.log('[TABS] Tab clicked:', targetTab, 'Current run:', currentRun);
        
        switchToTab(targetTab);
        
        // Load data for specific tabs
        if (currentRun) {
          if (targetTab === 'strategies') {
            console.log('[TABS] Loading strategies for tab switch');
            window.loadStrategies(currentRun.run_id);
          } else if (targetTab === 'portfolio') {
            window.loadPortfolio(currentRun.run_id);
          } else if (targetTab === 'trades') {
            // For single mode: trades are loaded when strategy is clicked
            // For portfolio mode: load all trades for the portfolio
            if (currentRun.mode === 'portfolio') {
              window.loadTrades(currentRun.run_id);
            }
          }
        }
      });
    });
  }
  
  console.log('[TABS] Tab management initialized');
}
