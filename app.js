(function () {
  'use strict';

  const STORAGE_KEY = 'focus_tasks';

  // --- Date helpers ---
  function todayStr() {
    return new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // --- Storage ---
  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { tasks: [], todayDate: '' };
    } catch {
      return { tasks: [], todayDate: '' };
    }
  }

  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // --- State ---
  let data = load();

  // Reset today tasks if it's a new day
  function checkNewDay() {
    const key = todayKey();
    if (data.todayDate !== key) {
      // Demote yesterday's today tasks back to pool (keep uncompleted ones)
      data.tasks.forEach(t => {
        if (t.isToday && !t.done) {
          t.isToday = false;
        }
        // Clear done tasks from previous days
        if (t.done && t.doneDate && t.doneDate !== key) {
          t.markedForClean = true;
        }
      });
      data.tasks = data.tasks.filter(t => !t.markedForClean);
      data.todayDate = key;
      save(data);
    }
  }

  // --- DOM refs ---
  const dateEl = document.getElementById('date');
  const inputEl = document.getElementById('task-input');
  const todaySection = document.getElementById('today-section');
  const poolSection = document.getElementById('pool-section');
  const todayList = document.getElementById('today-list');
  const poolList = document.getElementById('pool-list');
  const todayCount = document.getElementById('today-count');
  const emptyState = document.getElementById('empty-state');

  // --- Render ---
  function render() {
    dateEl.textContent = todayStr();

    const todayTasks = data.tasks.filter(t => t.isToday);
    const poolTasks = data.tasks.filter(t => !t.isToday);

    todayCount.textContent = todayTasks.filter(t => !t.done).length;

    todayList.innerHTML = '';
    poolList.innerHTML = '';

    const hasTasks = data.tasks.length > 0;
    emptyState.classList.toggle('hidden', hasTasks);
    todaySection.classList.toggle('hidden', todayTasks.length === 0);
    poolSection.classList.toggle('hidden', poolTasks.length === 0);

    todayTasks.forEach(t => todayList.appendChild(createTaskEl(t, true)));
    poolTasks.forEach(t => poolList.appendChild(createTaskEl(t, false)));
  }

  function createTaskEl(task, isToday) {
    const li = document.createElement('li');
    if (task.done) li.classList.add('done');

    const checkBtn = document.createElement('button');
    checkBtn.className = 'check-btn';
    checkBtn.textContent = task.done ? '✓' : '';
    checkBtn.setAttribute('aria-label', task.done ? '标记未完成' : '标记完成');
    checkBtn.onclick = () => toggleDone(task.id);

    const span = document.createElement('span');
    span.className = 'task-text';
    span.textContent = task.text;

    const actions = document.createElement('span');
    actions.className = 'task-actions';

    if (!isToday && !task.done) {
      const todayActiveTasks = data.tasks.filter(t => t.isToday && !t.done);
      if (todayActiveTasks.length < 3) {
        const promoteBtn = document.createElement('button');
        promoteBtn.className = 'action-btn promote';
        promoteBtn.textContent = '↑';
        promoteBtn.title = '设为今日重点';
        promoteBtn.onclick = () => promoteToToday(task.id);
        actions.appendChild(promoteBtn);
      }
    }

    if (isToday && !task.done) {
      const demoteBtn = document.createElement('button');
      demoteBtn.className = 'action-btn';
      demoteBtn.textContent = '↓';
      demoteBtn.title = '移到待办池';
      demoteBtn.onclick = () => demoteToPool(task.id);
      actions.appendChild(demoteBtn);
    }

    const delBtn = document.createElement('button');
    delBtn.className = 'action-btn delete';
    delBtn.textContent = '×';
    delBtn.title = '删除';
    delBtn.onclick = () => deleteTask(task.id);
    actions.appendChild(delBtn);

    li.appendChild(checkBtn);
    li.appendChild(span);
    li.appendChild(actions);
    return li;
  }

  // --- Actions ---
  function addTask(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

    data.tasks.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: trimmed,
      isToday: false,
      done: false,
      created: new Date().toISOString(),
      doneDate: null,
    });
    save(data);
    render();
  }

  function toggleDone(id) {
    const task = data.tasks.find(t => t.id === id);
    if (!task) return;
    task.done = !task.done;
    task.doneDate = task.done ? todayKey() : null;
    save(data);
    render();
  }

  function promoteToToday(id) {
    const activeTodayCount = data.tasks.filter(t => t.isToday && !t.done).length;
    if (activeTodayCount >= 3) return;
    const task = data.tasks.find(t => t.id === id);
    if (!task) return;
    task.isToday = true;
    save(data);
    render();
  }

  function demoteToPool(id) {
    const task = data.tasks.find(t => t.id === id);
    if (!task) return;
    task.isToday = false;
    save(data);
    render();
  }

  function deleteTask(id) {
    data.tasks = data.tasks.filter(t => t.id !== id);
    save(data);
    render();
  }

  // --- Input ---
  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      addTask(inputEl.value);
      inputEl.value = '';
    }
  });

  // Also handle compositionend for CJK input
  inputEl.addEventListener('compositionend', () => {
    // Let the value update first
  });

  // --- Notifications ---
  function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function scheduleNotifications() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const now = new Date();
    const today9am = new Date(now);
    today9am.setHours(9, 0, 0, 0);
    const today3pm = new Date(now);
    today3pm.setHours(15, 0, 0, 0);

    function scheduleAt(target, title, body) {
      let delay = target.getTime() - now.getTime();
      if (delay < 0) return; // Already passed today
      setTimeout(() => {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_NOTIFICATION',
            title,
            body,
          });
        } else {
          new Notification(title, { body, icon: 'icon-192.png' });
        }
      }, delay);
    }

    const activeTodayCount = data.tasks.filter(t => t.isToday && !t.done).length;

    if (activeTodayCount === 0) {
      scheduleAt(today9am, '专注 · 早安', '新的一天，选择今天最重要的 3 件事吧');
    }

    scheduleAt(today3pm, '专注 · 下午好', '检查一下今日重点的进度吧');
  }

  // --- Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => {
      requestNotificationPermission();
    });
  }

  // --- Init ---
  checkNewDay();
  render();
  scheduleNotifications();

  // Re-check at midnight
  function scheduleMiddnightRefresh() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 30, 0);
    const delay = tomorrow.getTime() - now.getTime();
    setTimeout(() => {
      checkNewDay();
      render();
      scheduleNotifications();
      scheduleMiddnightRefresh();
    }, delay);
  }
  scheduleMiddnightRefresh();

  // Focus input when clicking empty area
  document.addEventListener('click', e => {
    if (e.target === document.body || e.target.id === 'app') {
      inputEl.focus();
    }
  });
})();
