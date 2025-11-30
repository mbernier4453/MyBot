/**
 * Learning Module
 * Handles course navigation, progress tracking, lesson display
 */

import { loadCourses, loadLessonContent } from './content-loader.js';
import { supabase } from '../../supabase-client.js';

let courses = [];
let currentCourse = null;
let currentLesson = null;
let userProgress = {}; // { courseId: { completedLessons: [] } }

async function init() {
  // Load courses and progress
  try {
    courses = (await loadCourses()).courses;
    loadUserProgress();
    renderCourseList();
    setupEventListeners();
  } catch (error) {
    console.error('[Learning] Init failed:', error);
    document.getElementById('course-list').innerHTML = '<div class="error">Failed to load courses</div>';
  }
}

function renderCourseList() {
  const container = document.getElementById('course-list');
  container.innerHTML = courses.map(course => `
    <div class="course-card" data-course-id="${course.id}">
      <div class="course-icon">${course.icon}</div>
      <div class="course-info">
        <h3>${course.title}</h3>
        <p>${course.description}</p>
        <div class="course-meta">
          <span class="badge">${course.level}</span>
          <span class="duration">${course.duration}</span>
        </div>
      </div>
      <button class="btn-start" data-course-id="${course.id}">
        ${userProgress[course.id] ? 'Continue' : 'Start Course'}
      </button>
    </div>
  `).join('');

  // Setup click handlers
  document.querySelectorAll('.btn-start').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const courseId = e.target.dataset.courseId;
      openCourse(courseId);
    });
  });
}

function setupEventListeners() {
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active from all tabs
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.sidebar-content').forEach(c => c.classList.remove('active'));
      
      // Activate clicked tab
      btn.classList.add('active');
      const tabName = btn.dataset.tab;
      document.getElementById(`${tabName}-tab`).classList.add('active');
      
      // Load research if switching to research tab
      if (tabName === 'research') {
        import('./research.js').then(module => module.research.init());
      }
    });
  });
}

async function openCourse(courseId) {
  currentCourse = courses.find(c => c.id === courseId);
  if (!currentCourse) return;

  // Render course structure in sidebar
  const sidebar = document.getElementById('course-list');
  sidebar.innerHTML = `
    <button class="btn-back" onclick="window.location.reload()">← Back to Courses</button>
    <h2 class="course-title">${currentCourse.title}</h2>
    <div class="modules-list">
      ${currentCourse.modules.map((module, idx) => `
        <div class="module" data-module-id="${module.id}">
          <h4 class="module-title">
            <span class="module-number">${idx + 1}</span>
            ${module.title}
          </h4>
          <ul class="lessons-list">
            ${module.lessons.map(lesson => `
              <li class="lesson-item ${isLessonCompleted(lesson.id) ? 'completed' : ''}" 
                  data-lesson-id="${lesson.id}">
                <span class="lesson-icon">${isLessonCompleted(lesson.id) ? '✓' : '○'}</span>
                <span class="lesson-title">${lesson.title}</span>
                <span class="lesson-duration">${lesson.duration}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `).join('')}
    </div>
  `;

  // Setup lesson click handlers
  document.querySelectorAll('.lesson-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const lessonId = e.currentTarget.dataset.lessonId;
      openLesson(lessonId);
    });
  });

  // Auto-open first lesson or last incomplete lesson
  const firstIncomplete = findFirstIncompleteLesson();
  if (firstIncomplete) {
    openLesson(firstIncomplete.id);
  } else {
    openLesson(currentCourse.modules[0].lessons[0].id);
  }
}

function findFirstIncompleteLesson() {
  for (const module of currentCourse.modules) {
    for (const lesson of module.lessons) {
      if (!isLessonCompleted(lesson.id)) {
        return lesson;
      }
    }
  }
  return null;
}

async function openLesson(lessonId) {
  // Find lesson in current course
  let lesson = null;
  let moduleIdx = 0;
  let lessonIdx = 0;
  
  currentCourse.modules.forEach((module, mIdx) => {
    const found = module.lessons.findIndex(l => l.id === lessonId);
    if (found !== -1) {
      lesson = module.lessons[found];
      moduleIdx = mIdx;
      lessonIdx = found;
    }
  });

  if (!lesson) return;
  currentLesson = lesson;

  // Load and render content
  const contentDisplay = document.getElementById('content-display');
  contentDisplay.innerHTML = '<div class="loading">Loading lesson...</div>';

  try {
    const html = await loadLessonContent(lesson.contentFile);
    
    // Find next lesson
    const nextLesson = findNextLesson(moduleIdx, lessonIdx);
    
    contentDisplay.innerHTML = `
      <div class="lesson-header">
        <h1>${lesson.title}</h1>
        <span class="lesson-duration">${lesson.duration}</span>
      </div>
      <div class="lesson-content markdown-body">
        ${html}
      </div>
      <div class="lesson-footer">
        <button class="btn-complete" onclick="window.markLessonComplete('${lesson.id}')">
          ${isLessonCompleted(lesson.id) ? '✓ Completed' : 'Mark Complete'}
        </button>
        ${nextLesson ? `
          <button class="btn-next" onclick="window.openNextLesson()">
            Next: ${nextLesson.title} →
          </button>
        ` : ''}
      </div>
    `;

    // Highlight current lesson in sidebar
    document.querySelectorAll('.lesson-item').forEach(item => {
      item.classList.toggle('active', item.dataset.lessonId === lessonId);
    });

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (error) {
    console.error('[Learning] Failed to load lesson:', error);
    contentDisplay.innerHTML = `
      <div class="error">
        <h2>Failed to load lesson content</h2>
        <p>This lesson content is not yet available. Check back soon!</p>
      </div>
    `;
  }
}

function findNextLesson(currentModuleIdx, currentLessonIdx) {
  const currentModule = currentCourse.modules[currentModuleIdx];
  
  // Check if there's a next lesson in current module
  if (currentLessonIdx + 1 < currentModule.lessons.length) {
    return currentModule.lessons[currentLessonIdx + 1];
  }
  
  // Check if there's a next module
  if (currentModuleIdx + 1 < currentCourse.modules.length) {
    return currentCourse.modules[currentModuleIdx + 1].lessons[0];
  }
  
  return null;
}

function loadUserProgress() {
  // Load from localStorage (migrate to Supabase later)
  const saved = localStorage.getItem('learning-progress');
  if (saved) {
    try {
      userProgress = JSON.parse(saved);
    } catch (e) {
      userProgress = {};
    }
  }
}

function saveUserProgress() {
  localStorage.setItem('learning-progress', JSON.stringify(userProgress));
}

function isLessonCompleted(lessonId) {
  if (!currentCourse || !userProgress[currentCourse.id]) return false;
  return userProgress[currentCourse.id].completedLessons.includes(lessonId);
}

// Global functions accessible from HTML
window.markLessonComplete = function(lessonId) {
  if (!currentCourse) return;
  
  if (!userProgress[currentCourse.id]) {
    userProgress[currentCourse.id] = { completedLessons: [] };
  }
  
  if (!userProgress[currentCourse.id].completedLessons.includes(lessonId)) {
    userProgress[currentCourse.id].completedLessons.push(lessonId);
    saveUserProgress();
    
    // Update UI
    document.querySelectorAll(`.lesson-item[data-lesson-id="${lessonId}"]`).forEach(item => {
      item.classList.add('completed');
      item.querySelector('.lesson-icon').textContent = '✓';
    });
    
    // Update button text
    document.querySelector('.btn-complete').textContent = '✓ Completed';
    
    console.log('[Learning] Lesson completed:', lessonId);
  }
};

window.openNextLesson = function() {
  if (!currentCourse || !currentLesson) return;
  
  // Find current lesson position
  let moduleIdx = 0;
  let lessonIdx = 0;
  
  currentCourse.modules.forEach((module, mIdx) => {
    const found = module.lessons.findIndex(l => l.id === currentLesson.id);
    if (found !== -1) {
      moduleIdx = mIdx;
      lessonIdx = found;
    }
  });
  
  const nextLesson = findNextLesson(moduleIdx, lessonIdx);
  if (nextLesson) {
    openLesson(nextLesson.id);
  }
};

// Export for use in learning.html
export const learning = {
  init,
  openCourse,
  openLesson
};
