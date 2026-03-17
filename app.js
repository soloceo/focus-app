(function () {
  'use strict';

  const STORAGE_KEY = 'focus_tasks';
  const ONBOARDING_KEY = 'cike_onboarded';
  const RING_CIRCUMFERENCE = 2 * Math.PI * 16;

  const ENCOURAGEMENTS = [
    '没关系，给自己一点时间。你已经在关注它了，这就是进步。',
    '深呼吸。不急，等你准备好了再开始。',
    '有时候最难的是开始。但你已经在思考了。',
    '休息一下也是好的。力量在积蓄中。',
    '你比你想象的更有能力。慢慢来。',
    '每一次面对，都是勇气。5分钟后再看看吧。',
    '把注意力放在此刻。一切都会好起来的。',
  ];

  const BREATHING_TEXTS = [
    '不急，慢慢来',
    '做一件就够了',
    '开始就是最大的进步',
    '此刻，只看眼前这一步',
    '你已经在路上了',
    '深呼吸，一切都会好的',
  ];

  // --- Date & time helpers ---
  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 6) return '夜深了，别太为难自己';
    if (h < 12) return '早上好，新的一天';
    if (h < 14) return '中午好，歇一歇也没关系';
    if (h < 18) return '下午好，还有时间';
    return '晚上好，今天辛苦了';
  }

  function getBreathingText() {
    return BREATHING_TEXTS[Math.floor(Math.random() * BREATHING_TEXTS.length)];
  }

  // --- Storage ---
  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { tasks: [], todayDate: '' };
    } catch {
      return { tasks: [], todayDate: '' };
    }
  }

  function save(d) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  }

  // --- State ---
  let data = load();
  let prevAllDone = false;
  let moodTargetTaskId = null;
  let focusIndex = 0; // which today task to show in focus mode
  let showingListView = false;

  function checkNewDay() {
    const key = todayKey();
    if (data.todayDate !== key) {
      data.tasks.forEach(t => {
        if (t.isToday && !t.done) {
          t.isToday = false;
        }
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
  const greetingEl = document.getElementById('greeting');
  const breathingEl = document.getElementById('breathing-text');
  const inputEl = document.getElementById('task-input');
  const todaySection = document.getElementById('today-section');
  const poolSection = document.getElementById('pool-section');
  const todayList = document.getElementById('today-list');
  const poolList = document.getElementById('pool-list');
  const emptyState = document.getElementById('empty-state');
  const ringFill = document.getElementById('ring-fill');
  const progressText = document.getElementById('progress-text');
  const progressRing = document.getElementById('progress-ring');
  const confettiCanvas = document.getElementById('confetti');
  const toastEl = document.getElementById('toast');

  // Focus card refs
  const focusCard = document.getElementById('focus-card');
  const focusTaskText = document.getElementById('focus-task-text');
  const focusStep = document.getElementById('focus-step');
  const focusStartBtn = document.getElementById('focus-start');
  const focusBreakBtn = document.getElementById('focus-break');
  const focusSkipBtn = document.getElementById('focus-skip');
  const doneState = document.getElementById('done-state');
  const doneText = document.getElementById('done-text');
  const listView = document.getElementById('list-view');
  const viewToggle = document.getElementById('view-toggle');
  const toggleBtn = document.getElementById('toggle-view');

  // Modal refs
  const moodOverlay = document.getElementById('mood-overlay');
  const moodTaskName = document.getElementById('mood-task-name');
  const firststepOverlay = document.getElementById('firststep-overlay');
  const firststepInput = document.getElementById('firststep-input');
  const encourageOverlay = document.getElementById('encourage-overlay');
  const encourageText = document.getElementById('encourage-text');

  // --- Toast ---
  let toastTimer = null;
  function showToast(msg) {
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    toastEl.style.animation = 'none';
    toastEl.offsetHeight;
    toastEl.style.animation = '';
    toastTimer = setTimeout(() => {
      toastEl.classList.add('hidden');
    }, 2500);
  }

  // --- Progress Ring ---
  function updateProgressRing() {
    const todayTasks = data.tasks.filter(t => t.isToday);
    const doneCount = todayTasks.filter(t => t.done).length;
    const total = todayTasks.length;
    const progress = total > 0 ? doneCount / Math.max(total, 3) : 0;
    const offset = RING_CIRCUMFERENCE * (1 - progress);

    ringFill.style.strokeDashoffset = offset;
    progressText.textContent = `${doneCount}/${total > 0 ? total : 3}`;

    const allDone = total > 0 && doneCount === total;
    progressRing.classList.toggle('complete', allDone);

    if (allDone && !prevAllDone && total > 0) {
      celebrate();
    }
    prevAllDone = allDone;
  }

  // --- Celebration ---
  function celebrate() {
    const ctx = confettiCanvas.getContext('2d');
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
    confettiCanvas.classList.remove('hidden');

    const colors = ['#D97757', '#E8A87C', '#C4684A', '#F0C9A6', '#A67B5B', '#D4956B'];
    const particles = [];
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * confettiCanvas.width,
        y: confettiCanvas.height + Math.random() * 40,
        vx: (Math.random() - 0.5) * 6,
        vy: -(Math.random() * 12 + 6),
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 6 + 3,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        gravity: 0.15 + Math.random() * 0.05,
      });
    }

    let frame = 0;
    function animateConfetti() {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      let alive = false;
      particles.forEach(p => {
        p.x += p.vx;
        p.vy += p.gravity;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        if (p.y < confettiCanvas.height + 20) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, 1 - frame / 90);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        }
      });
      frame++;
      if (alive && frame < 100) {
        requestAnimationFrame(animateConfetti);
      } else {
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        confettiCanvas.classList.add('hidden');
      }
    }
    requestAnimationFrame(animateConfetti);
  }

  // --- Render ---
  function render() {
    greetingEl.textContent = getGreeting();
    breathingEl.textContent = getBreathingText();

    const todayTasks = data.tasks.filter(t => t.isToday);
    const poolTasks = data.tasks.filter(t => !t.isToday);
    const activeTodayTasks = todayTasks.filter(t => !t.done);
    const doneTodayTasks = todayTasks.filter(t => t.done);
    const hasTasks = data.tasks.length > 0;

    // Show/hide empty state
    emptyState.classList.toggle('hidden', hasTasks);

    // Render focus card or done state
    if (todayTasks.length > 0) {
      if (activeTodayTasks.length === 0) {
        // All today tasks done
        focusCard.classList.add('hidden');
        doneState.classList.remove('hidden');
        doneText.textContent = `今天完成了 ${doneTodayTasks.length} 件事`;
      } else {
        doneState.classList.add('hidden');
        if (!showingListView) {
          renderFocusCard(activeTodayTasks);
        } else {
          focusCard.classList.add('hidden');
        }
      }
    } else {
      focusCard.classList.add('hidden');
      doneState.classList.add('hidden');
    }

    // View toggle
    if (hasTasks) {
      viewToggle.classList.remove('hidden');
      toggleBtn.textContent = showingListView ? '切换聚焦模式' : '查看全部任务';
    } else {
      viewToggle.classList.add('hidden');
    }

    // List view
    listView.classList.toggle('hidden', !showingListView);
    if (showingListView) {
      todayList.innerHTML = '';
      poolList.innerHTML = '';
      todaySection.classList.toggle('hidden', todayTasks.length === 0);
      poolSection.classList.toggle('hidden', poolTasks.length === 0);

      todayTasks.forEach((t, i) => {
        const el = createTaskEl(t, true);
        el.style.animationDelay = `${i * 0.04}s`;
        todayList.appendChild(el);
      });
      poolTasks.forEach((t, i) => {
        const el = createTaskEl(t, false);
        el.style.animationDelay = `${i * 0.04}s`;
        poolList.appendChild(el);
      });
    }

    updateProgressRing();
  }

  // --- Focus card ---
  function renderFocusCard(activeTasks) {
    if (focusIndex >= activeTasks.length) focusIndex = 0;
    const task = activeTasks[focusIndex];
    if (!task) return;

    focusCard.classList.remove('hidden');
    focusCard.dataset.taskId = task.id;

    // Show first step if available, otherwise full task
    if (task.firstStep) {
      focusTaskText.textContent = task.firstStep;
      focusStep.textContent = task.text;
      focusStep.classList.remove('hidden');
      focusBreakBtn.classList.add('hidden');
    } else {
      focusTaskText.textContent = task.text;
      focusStep.classList.add('hidden');
      focusBreakBtn.classList.remove('hidden');
    }

    // Update button state
    if (task.started) {
      focusStartBtn.textContent = '完成';
      focusStartBtn.className = 'focus-btn primary';
    } else {
      focusStartBtn.textContent = '开始';
      focusStartBtn.className = 'focus-btn primary';
    }

    // Show skip only if more than 1 active task
    focusSkipBtn.style.display = activeTasks.length > 1 ? 'block' : 'none';
  }

  // Focus card event handlers
  focusStartBtn.addEventListener('click', () => {
    const taskId = focusCard.dataset.taskId;
    const task = data.tasks.find(t => t.id === taskId);
    if (!task) return;

    if (!task.started) {
      startTask(taskId);
    } else {
      completeTask(taskId);
    }
  });

  focusBreakBtn.addEventListener('click', () => {
    const taskId = focusCard.dataset.taskId;
    showFirstStepInput(taskId);
  });

  focusSkipBtn.addEventListener('click', () => {
    focusIndex++;
    render();
  });

  // --- View toggle ---
  toggleBtn.addEventListener('click', () => {
    showingListView = !showingListView;
    render();
  });

  // --- Create task element (list view) ---
  function createTaskEl(task, isToday) {
    const li = document.createElement('li');
    li.dataset.id = task.id;
    li.draggable = true;
    if (task.done) li.classList.add('done');
    if (task.started && !task.done) li.classList.add('started');
    if (task.firstStep) li.classList.add('has-first-step');

    // Check button
    const checkBtn = document.createElement('button');
    checkBtn.className = 'check-btn';
    checkBtn.textContent = task.done ? '\u2713' : '';
    checkBtn.setAttribute('aria-label', task.done ? '标记未完成' : '标记完成');
    checkBtn.onclick = e => {
      e.stopPropagation();
      if (!task.done) li.classList.add('completing');
      completeTask(task.id);
    };

    // Task text area
    const span = document.createElement('span');
    span.className = 'task-text';

    if (task.firstStep && !task.done) {
      const stepLine = document.createElement('div');
      stepLine.className = 'showing-step';
      stepLine.textContent = task.firstStep;

      const originalLine = document.createElement('div');
      originalLine.className = 'original-task';
      originalLine.textContent = task.text;

      span.appendChild(stepLine);
      span.appendChild(originalLine);
    } else {
      span.textContent = task.text;
    }

    span.addEventListener('dblclick', e => {
      e.stopPropagation();
      startEditingTask(span, task);
    });

    // Actions — layered: only show primary action, rest in expandable
    const actions = document.createElement('span');
    actions.className = 'task-actions';

    if (isToday && !task.done) {
      // Primary action only
      if (!task.started) {
        const startBtn = document.createElement('button');
        startBtn.className = 'status-btn start-btn';
        startBtn.textContent = '开始';
        startBtn.onclick = e => { e.stopPropagation(); startTask(task.id); };
        actions.appendChild(startBtn);
      } else {
        const completeBtn = document.createElement('button');
        completeBtn.className = 'status-btn complete-btn';
        completeBtn.textContent = '完成';
        completeBtn.onclick = e => { e.stopPropagation(); li.classList.add('completing'); completeTask(task.id); };
        actions.appendChild(completeBtn);
      }

      // More actions toggle
      const moreBtn = document.createElement('button');
      moreBtn.className = 'status-btn more-btn';
      moreBtn.textContent = '···';
      moreBtn.onclick = e => {
        e.stopPropagation();
        li.classList.toggle('show-more');
      };
      actions.appendChild(moreBtn);

      // Hidden actions
      const moreActions = document.createElement('div');
      moreActions.className = 'more-actions';

      if (!task.firstStep) {
        const breakBtn = document.createElement('button');
        breakBtn.className = 'status-btn break-btn';
        breakBtn.textContent = '拆一步';
        breakBtn.onclick = e => { e.stopPropagation(); showFirstStepInput(task.id); };
        moreActions.appendChild(breakBtn);
      }

      const demoteBtn = document.createElement('button');
      demoteBtn.className = 'status-btn demote-btn';
      demoteBtn.textContent = '移回待办';
      demoteBtn.onclick = e => { e.stopPropagation(); demoteToPool(task.id); };
      moreActions.appendChild(demoteBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'status-btn delete-btn';
      delBtn.textContent = '删除';
      delBtn.onclick = e => {
        e.stopPropagation();
        li.classList.add('removing');
        li.addEventListener('transitionend', () => deleteTask(task.id), { once: true });
        setTimeout(() => deleteTask(task.id), 350);
      };
      moreActions.appendChild(delBtn);

      actions.appendChild(moreActions);
    } else if (!isToday && !task.done) {
      const todayActiveTasks = data.tasks.filter(t => t.isToday && !t.done);
      if (todayActiveTasks.length < 3) {
        const promoteBtn = document.createElement('button');
        promoteBtn.className = 'status-btn promote-btn';
        promoteBtn.textContent = '加入今天';
        promoteBtn.onclick = e => { e.stopPropagation(); promoteToToday(task.id); };
        actions.appendChild(promoteBtn);
      }

      const delBtn = document.createElement('button');
      delBtn.className = 'status-btn delete-btn';
      delBtn.textContent = '删除';
      delBtn.onclick = e => {
        e.stopPropagation();
        li.classList.add('removing');
        li.addEventListener('transitionend', () => deleteTask(task.id), { once: true });
        setTimeout(() => deleteTask(task.id), 350);
      };
      actions.appendChild(delBtn);
    }

    li.appendChild(checkBtn);
    li.appendChild(span);
    li.appendChild(actions);

    // Mood check on click (list view, not started tasks)
    if (isToday && !task.done && !task.started) {
      li.style.cursor = 'pointer';
      li.addEventListener('click', () => {
        showMoodCheck(task.id);
      });
    }

    // Drag & Drop
    li.addEventListener('dragstart', e => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', task.id);
      li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });
    li.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      li.classList.add('drag-over');
    });
    li.addEventListener('dragleave', () => { li.classList.remove('drag-over'); });
    li.addEventListener('drop', e => {
      e.preventDefault();
      li.classList.remove('drag-over');
      const draggedId = e.dataTransfer.getData('text/plain');
      if (draggedId !== task.id) reorderTask(draggedId, task.id);
    });

    return li;
  }

  // --- Mood check ---
  function showMoodCheck(taskId) {
    const task = data.tasks.find(t => t.id === taskId);
    if (!task) return;
    moodTargetTaskId = taskId;
    moodTaskName.textContent = task.text;
    moodOverlay.classList.remove('hidden');
  }

  function hideMoodCheck() {
    moodOverlay.classList.add('hidden');
    moodTargetTaskId = null;
  }

  moodOverlay.addEventListener('click', e => {
    const btn = e.target.closest('.mood-btn');
    if (!btn) {
      if (e.target === moodOverlay) hideMoodCheck();
      return;
    }
    const mood = btn.dataset.mood;
    const taskId = moodTargetTaskId;
    hideMoodCheck();
    if (mood === 'ready') startTask(taskId);
    else if (mood === 'not-ready') showEncouragement(taskId);
    else if (mood === 'break-down') showFirstStepInput(taskId);
  });

  // --- First step input ---
  function showFirstStepInput(taskId) {
    moodTargetTaskId = taskId;
    firststepInput.value = '';
    firststepOverlay.classList.remove('hidden');
    setTimeout(() => firststepInput.focus(), 100);
  }

  function hideFirstStepInput() {
    firststepOverlay.classList.add('hidden');
  }

  document.getElementById('firststep-confirm').addEventListener('click', () => {
    const text = firststepInput.value.trim();
    if (!text || !moodTargetTaskId) return;
    setFirstStep(moodTargetTaskId, text);
    hideFirstStepInput();
    moodTargetTaskId = null;
  });

  document.getElementById('firststep-cancel').addEventListener('click', () => {
    hideFirstStepInput();
    moodTargetTaskId = null;
  });

  firststepInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      document.getElementById('firststep-confirm').click();
    }
    if (e.key === 'Escape') {
      hideFirstStepInput();
      moodTargetTaskId = null;
    }
  });

  firststepOverlay.addEventListener('click', e => {
    if (e.target === firststepOverlay) {
      hideFirstStepInput();
      moodTargetTaskId = null;
    }
  });

  // --- Encouragement ---
  function showEncouragement(taskId) {
    const msg = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
    encourageText.textContent = msg;
    encourageOverlay.classList.remove('hidden');

    if (taskId) {
      setTimeout(() => {
        const task = data.tasks.find(t => t.id === taskId);
        if (task && !task.done && !task.started) {
          showToast('5 分钟到了，要不要再看看那个任务？');
        }
      }, 5 * 60 * 1000);
    }
  }

  document.getElementById('encourage-close').addEventListener('click', () => {
    encourageOverlay.classList.add('hidden');
  });

  encourageOverlay.addEventListener('click', e => {
    if (e.target === encourageOverlay) encourageOverlay.classList.add('hidden');
  });

  // --- Inline editing ---
  function startEditingTask(span, task) {
    if (task.done) return;
    span.classList.add('editing');
    const editText = task.text;
    span.textContent = editText;
    span.contentEditable = 'true';
    span.focus();

    const range = document.createRange();
    range.selectNodeContents(span);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    function finishEdit() {
      span.contentEditable = 'false';
      span.classList.remove('editing');
      const newText = span.textContent.trim();
      if (newText && newText !== task.text) {
        task.text = newText;
        save(data);
      }
      render();
      span.removeEventListener('blur', finishEdit);
      span.removeEventListener('keydown', onKey);
    }

    function onKey(e) {
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); span.blur(); }
      if (e.key === 'Escape') { span.textContent = task.text; span.blur(); }
    }

    span.addEventListener('blur', finishEdit);
    span.addEventListener('keydown', onKey);
  }

  // --- Reorder ---
  function reorderTask(draggedId, targetId) {
    const fromIdx = data.tasks.findIndex(t => t.id === draggedId);
    const toIdx = data.tasks.findIndex(t => t.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = data.tasks.splice(fromIdx, 1);
    data.tasks.splice(toIdx, 0, moved);
    save(data);
    render();
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
      started: false,
      firstStep: null,
      created: new Date().toISOString(),
      doneDate: null,
    });
    save(data);
    render();
  }

  function startTask(id) {
    const task = data.tasks.find(t => t.id === id);
    if (!task) return;
    task.started = true;
    save(data);
    render();
    showToast('很好，你开始了！');
  }

  function completeTask(id) {
    const task = data.tasks.find(t => t.id === id);
    if (!task) return;
    task.done = !task.done;
    task.doneDate = task.done ? todayKey() : null;
    if (task.done) task.started = true;
    save(data);
    render();
  }

  function setFirstStep(id, step) {
    const task = data.tasks.find(t => t.id === id);
    if (!task) return;
    task.firstStep = step;
    save(data);
    render();
    showToast('很好，先做这一小步就够了');
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

  let deletePending = false;
  function deleteTask(id) {
    if (deletePending) return;
    deletePending = true;
    data.tasks = data.tasks.filter(t => t.id !== id);
    save(data);
    render();
    deletePending = false;
  }

  // --- Input ---
  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      addTask(inputEl.value);
      inputEl.value = '';
    }
  });

  document.getElementById('add-btn').addEventListener('click', () => {
    addTask(inputEl.value);
    inputEl.value = '';
    inputEl.focus();
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
    const today9am = new Date(now); today9am.setHours(9, 0, 0, 0);
    const today3pm = new Date(now); today3pm.setHours(15, 0, 0, 0);

    function scheduleAt(target, title, body) {
      let delay = target.getTime() - now.getTime();
      if (delay < 0) return;
      setTimeout(() => {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'SHOW_NOTIFICATION', title, body });
        } else {
          new Notification(title, { body, icon: 'icon-192.png' });
        }
      }, delay);
    }

    const activeTodayCount = data.tasks.filter(t => t.isToday && !t.done).length;
    if (activeTodayCount === 0) {
      scheduleAt(today9am, '此刻 · 早安', '新的一天，选一件小事开始吧');
    }
    scheduleAt(today3pm, '此刻 · 下午好', '看看今天的进度吧');
  }

  // --- Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => {
      requestNotificationPermission();
    });
  }

  // --- Help ---
  const helpOverlay = document.getElementById('help-overlay');
  const helpBtn = document.getElementById('help-btn');
  const helpCloseBtn = document.getElementById('help-close');

  helpBtn.addEventListener('click', () => { helpOverlay.classList.remove('hidden'); });
  helpCloseBtn.addEventListener('click', () => { helpOverlay.classList.add('hidden'); });
  helpOverlay.addEventListener('click', e => {
    if (e.target === helpOverlay) helpOverlay.classList.add('hidden');
  });

  // --- First-time template tasks ---
  function addTemplateTasks() {
    if (localStorage.getItem(ONBOARDING_KEY)) return;
    localStorage.setItem(ONBOARDING_KEY, '1');
    const key = todayKey();
    const makeId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    data.todayDate = key;
    data.tasks = [
      { id: makeId(), text: '这是你的第一个任务，点「开始」试试', isToday: true, done: false, started: false, firstStep: null, created: new Date().toISOString(), doneDate: null },
      { id: makeId(), text: '试试「拆一步」，把大任务变小', isToday: true, done: false, started: false, firstStep: null, created: new Date().toISOString(), doneDate: null },
      { id: makeId(), text: '写下你今天真正想做的一件事', isToday: false, done: false, started: false, firstStep: null, created: new Date().toISOString(), doneDate: null },
    ];
    save(data);
    render();
  }

  // --- Init ---
  checkNewDay();
  render();
  scheduleNotifications();
  addTemplateTasks();

  function scheduleMidnightRefresh() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 30, 0);
    const delay = tomorrow.getTime() - now.getTime();
    setTimeout(() => {
      checkNewDay();
      render();
      scheduleNotifications();
      scheduleMidnightRefresh();
    }, delay);
  }
  scheduleMidnightRefresh();

  document.addEventListener('click', e => {
    if (e.target === document.body || e.target.id === 'app') {
      inputEl.focus();
    }
  });
})();
