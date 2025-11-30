/**
 * Content Loader Module
 * Fetches and parses JSON/Markdown course content
 */

export async function loadCourses() {
  const response = await fetch('/data/courses.json');
  if (!response.ok) throw new Error('Failed to load courses');
  return await response.json();
}

export async function loadResearchArticles() {
  const response = await fetch('/data/research.json');
  if (!response.ok) throw new Error('Failed to load research');
  return await response.json();
}

export async function loadLessonContent(contentFile) {
  const response = await fetch(`/data/lessons/${contentFile}`);
  if (!response.ok) throw new Error(`Failed to load ${contentFile}`);
  const markdown = await response.text();
  return parseMarkdown(markdown);
}

export async function loadResearchContent(contentFile) {
  const response = await fetch(`/data/research/${contentFile}`);
  if (!response.ok) throw new Error(`Failed to load ${contentFile}`);
  const markdown = await response.text();
  return parseMarkdown(markdown);
}

/**
 * Simple markdown parser
 * For production, consider using marked.js: https://cdn.jsdelivr.net/npm/marked@11.0.0/+esm
 */
function parseMarkdown(markdown) {
  let html = markdown
    // Headers
    .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold and italic
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Code blocks (```code```)
    .replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  
  // Wrap in paragraph tags
  html = '<p>' + html + '</p>';
  
  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p><br>/g, '<p>');
  html = html.replace(/<br><\/p>/g, '</p>');
  
  return html;
}
