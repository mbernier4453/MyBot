/**
 * Research Module
 * Displays curated market research articles
 */

import { loadResearchArticles, loadResearchContent } from './content-loader.js';

let articles = [];
let filteredArticles = [];
let initialized = false;

async function init() {
  if (initialized) return;
  initialized = true;

  try {
    articles = (await loadResearchArticles()).articles;
    filteredArticles = articles;
    renderResearchList();
    setupFilters();
  } catch (error) {
    console.error('[Research] Init failed:', error);
    document.getElementById('research-list').innerHTML = '<div class="error">Failed to load research articles</div>';
  }
}

function renderResearchList() {
  const container = document.getElementById('research-list');
  
  if (filteredArticles.length === 0) {
    container.innerHTML = '<div class="loading">No articles found matching your filters.</div>';
    return;
  }

  container.innerHTML = filteredArticles.map(article => `
    <div class="research-card" data-article-id="${article.id}">
      <div class="research-meta">
        <span class="research-date">${formatDate(article.date)}</span>
        ${article.author.verified ? '<span class="verified-badge">✓ Verified</span>' : ''}
      </div>
      <h3>${article.title}</h3>
      <p class="research-excerpt">${article.excerpt}</p>
      <div class="research-tags">
        ${article.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
      </div>
      <button class="btn-read" data-article-id="${article.id}">Read Article</button>
    </div>
  `).join('');

  // Setup click handlers
  document.querySelectorAll('.btn-read').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const articleId = e.target.dataset.articleId;
      openArticle(articleId);
    });
  });
}

async function openArticle(articleId) {
  const article = articles.find(a => a.id === articleId);
  if (!article) return;

  const contentDisplay = document.getElementById('content-display');
  contentDisplay.innerHTML = '<div class="loading">Loading article...</div>';

  try {
    const html = await loadResearchContent(article.contentFile);
    
    contentDisplay.innerHTML = `
      <div class="article-header">
        <h1>${article.title}</h1>
        <div class="article-meta">
          <span class="author">
            By ${article.author.name} 
            ${article.author.verified ? '<span class="verified">✓</span>' : ''}
          </span>
          <span class="date">${formatDate(article.date)}</span>
        </div>
        <div class="article-tags">
          ${article.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
        </div>
      </div>
      <div class="article-content markdown-body">
        ${html}
      </div>
      <div class="lesson-footer">
        <button class="btn-back" onclick="document.querySelector('[data-tab=research]').click()">
          ← Back to Research
        </button>
      </div>
    `;

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (error) {
    console.error('[Research] Failed to load article:', error);
    contentDisplay.innerHTML = `
      <div class="error">
        <h2>Failed to load article</h2>
        <p>This article content is not yet available. Check back soon!</p>
      </div>
    `;
  }
}

function setupFilters() {
  const searchInput = document.getElementById('research-search');
  const tagsSelect = document.getElementById('research-tags');

  // Populate tags dropdown
  const allTags = [...new Set(articles.flatMap(a => a.tags))];
  tagsSelect.innerHTML = '<option value="">All Topics</option>' +
    allTags.map(tag => `<option value="${tag}">${formatTag(tag)}</option>`).join('');

  // Search filter
  searchInput.addEventListener('input', applyFilters);
  tagsSelect.addEventListener('change', applyFilters);
}

function applyFilters() {
  const searchTerm = document.getElementById('research-search').value.toLowerCase();
  const selectedTag = document.getElementById('research-tags').value;

  filteredArticles = articles.filter(article => {
    const matchesSearch = !searchTerm || 
      article.title.toLowerCase().includes(searchTerm) ||
      article.excerpt.toLowerCase().includes(searchTerm);
    const matchesTag = !selectedTag || article.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  renderResearchList();
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTag(tag) {
  return tag.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// Export for use in learning module
export const research = {
  init,
  openArticle
};
