(function () {
  'use strict';

  const STORAGE_KEY = 'focus_tasks';
  const ONBOARDING_KEY = 'cike_onboarded';
  const REVIEW_KEY = 'cike_last_review';
  const COMPLETED_LOG_KEY = 'cike_completed_log';
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
  let skipCount = 0;
  let touchDragId = null;

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
  const poolHint = document.getElementById('pool-hint');
  const poolHintText = document.getElementById('pool-hint-text');
  const poolHintBtn = document.getElementById('pool-hint-btn');
  const listView = document.getElementById('list-view');
  const viewToggle = document.getElementById('view-toggle');
  const toggleBtn = document.getElementById('toggle-view');

  // Review refs
  const reviewOverlay = document.getElementById('review-overlay');
  const reviewTitle = document.getElementById('review-title');
  const reviewDetail = document.getElementById('review-detail');

  // Modal refs
  const moodOverlay = document.getElementById('mood-overlay');
  const moodTaskName = document.getElementById('mood-task-name');
  const firststepOverlay = document.getElementById('firststep-overlay');
  const firststepInput = document.getElementById('firststep-input');
  const encourageOverlay = document.getElementById('encourage-overlay');
  const encourageText = document.getElementById('encourage-text');

  // --- Toast ---
  let toastTimer = null;
  let undoTimer = null;
  function showToast(msg, undoCallback) {
    clearTimeout(toastTimer);
    clearTimeout(undoTimer);
    toastEl.innerHTML = '';
    const textNode = document.createTextNode(msg);
    toastEl.appendChild(textNode);
    if (undoCallback) {
      const undoBtn = document.createElement('button');
      undoBtn.className = 'toast-undo';
      undoBtn.textContent = '撤销';
      undoBtn.onclick = e => {
        e.stopPropagation();
        clearTimeout(toastTimer);
        clearTimeout(undoTimer);
        toastEl.classList.add('hidden');
        undoCallback();
      };
      toastEl.appendChild(undoBtn);
    }
    toastEl.classList.remove('hidden');
    toastEl.style.animation = 'none';
    toastEl.offsetHeight;
    toastEl.style.animation = '';
    const duration = undoCallback ? 4500 : 3500;
    toastTimer = setTimeout(() => {
      toastEl.classList.add('hidden');
    }, duration);
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

    const visibleTasks = data.tasks.filter(t => !t._pendingDelete);
    const todayTasks = visibleTasks.filter(t => t.isToday);
    const poolTasks = visibleTasks.filter(t => !t.isToday);
    const activeTodayTasks = todayTasks.filter(t => !t.done);
    const doneTodayTasks = todayTasks.filter(t => t.done);
    const hasTasks = visibleTasks.length > 0;

    // Show/hide empty state
    emptyState.classList.toggle('hidden', hasTasks);

    // Render focus card, done state, or pool hint
    poolHint.classList.add('hidden');
    if (todayTasks.length > 0) {
      if (activeTodayTasks.length === 0) {
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
      if (poolTasks.length > 0 && !showingListView) {
        poolHint.classList.remove('hidden');
        poolHintText.textContent = `待办池里有 ${poolTasks.length} 件事，选一件加入今天？`;
      }
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

    // Dynamic label based on task state
    const focusLabel = focusCard.querySelector('.focus-label');
    if (task.started) {
      focusLabel.textContent = '你已经在做了，继续吧';
    } else if (task.firstStep) {
      focusLabel.textContent = '从这一小步开始';
    } else {
      focusLabel.textContent = '此刻，只看这一件';
    }

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
    skipCount++;
    const activeTasks = data.tasks.filter(t => t.isToday && !t.done && !t._pendingDelete);
    focusIndex++;
    if (focusIndex >= activeTasks.length) {
      focusIndex = 0;
      showToast('都看了一遍了，选一件最小的开始试试？');
      skipCount = 0;
    } else if (skipCount === 2) {
      showToast('跳过也没关系，找到想做的那件');
    }
    render();
  });

  // Pool hint button
  poolHintBtn.addEventListener('click', () => {
    showingListView = true;
    render();
  });

  // --- View toggle ---
  toggleBtn.addEventListener('click', () => {
    showingListView = !showingListView;
    render();
    const entering = showingListView ? listView : focusCard;
    if (entering && !entering.classList.contains('hidden')) {
      entering.classList.add('view-entering');
      setTimeout(() => entering.classList.remove('view-entering'), 350);
    }
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
        deleteTask(task.id);
      };
      moreActions.appendChild(delBtn);

      // moreActions appended to li below, not to actions
      li._moreActions = moreActions;
    } else if (!isToday && !task.done) {
      const todayActiveTasks = data.tasks.filter(t => t.isToday && !t.done && !t._pendingDelete);
      if (todayActiveTasks.length < 3) {
        const promoteBtn = document.createElement('button');
        promoteBtn.className = 'status-btn promote-btn';
        promoteBtn.textContent = '加入今天';
        promoteBtn.onclick = e => { e.stopPropagation(); promoteToToday(task.id); };
        actions.appendChild(promoteBtn);
      } else {
        const limitHint = document.createElement('span');
        limitHint.className = 'limit-hint';
        limitHint.textContent = '今天已有 3 件';
        actions.appendChild(limitHint);
      }

      const delBtn = document.createElement('button');
      delBtn.className = 'status-btn delete-btn';
      delBtn.textContent = '删除';
      delBtn.onclick = e => {
        e.stopPropagation();
        deleteTask(task.id);
      };
      actions.appendChild(delBtn);
    }

    li.appendChild(checkBtn);
    li.appendChild(span);
    li.appendChild(actions);
    if (li._moreActions) li.appendChild(li._moreActions);

    // Mood check on click (list view, not started tasks)
    if (isToday && !task.done && !task.started) {
      li.style.cursor = 'pointer';
      li.addEventListener('click', () => {
        showMoodCheck(task.id);
      });
    }

    // Drag & Drop (desktop)
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

    // Touch drag (mobile)
    let touchTimeout = null;
    li.addEventListener('touchstart', e => {
      touchTimeout = setTimeout(() => {
        touchTimeout = null;
        li.classList.add('dragging');
        li.dataset.touching = '1';
        touchDragId = task.id;
      }, 400);
    }, { passive: true });
    li.addEventListener('touchmove', e => {
      if (touchTimeout) { clearTimeout(touchTimeout); touchTimeout = null; }
      if (!li.dataset.touching) return;
      e.preventDefault();
      const touch = e.touches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      const targetLi = target && target.closest('li[data-id]');
      document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      if (targetLi && targetLi.dataset.id !== task.id) {
        targetLi.classList.add('drag-over');
      }
    });
    li.addEventListener('touchend', e => {
      if (touchTimeout) { clearTimeout(touchTimeout); touchTimeout = null; }
      if (!li.dataset.touching) return;
      delete li.dataset.touching;
      li.classList.remove('dragging');
      const overEl = document.querySelector('.drag-over');
      if (overEl && touchDragId) {
        reorderTask(touchDragId, overEl.dataset.id);
      }
      document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      touchDragId = null;
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
    const todayCount = data.tasks.filter(t => t.isToday && !t.done && !t._pendingDelete).length;
    const autoToday = todayCount < 3;
    data.tasks.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: trimmed,
      isToday: autoToday,
      done: false,
      started: false,
      firstStep: null,
      created: new Date().toISOString(),
      doneDate: null,
    });
    save(data);
    render();
    if (autoToday) {
      showToast(`已加入今天 (${todayCount + 1}/3)`);
    } else {
      showToast('先放在待办池，完成今天的再来');
    }
  }

  function startTask(id) {
    const task = data.tasks.find(t => t.id === id);
    if (!task) return;
    task.started = true;
    save(data);
    render();
    showToast('很好，你开始了！');
  }

  let completeCooldown = false;
  function completeTask(id) {
    if (completeCooldown) return;
    const task = data.tasks.find(t => t.id === id);
    if (!task) return;
    completeCooldown = true;
    task.done = !task.done;
    task.doneDate = task.done ? todayKey() : null;
    if (task.done) {
      task.started = true;
      logCompletion();
    }
    save(data);
    render();
    setTimeout(() => { completeCooldown = false; }, 500);
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
    showToast(`已加入今天 (${activeTodayCount + 1}/3)`);
  }

  function demoteToPool(id) {
    const task = data.tasks.find(t => t.id === id);
    if (!task) return;
    task.isToday = false;
    save(data);
    render();
    showToast('已移回待办池');
  }

  let deletePending = false;
  let deleteUndoTimer = null;
  function deleteTask(id) {
    if (deletePending) return;
    deletePending = true;
    const task = data.tasks.find(t => t.id === id);
    if (!task) { deletePending = false; return; }
    task._pendingDelete = true;
    save(data);
    render();
    deletePending = false;
    clearTimeout(deleteUndoTimer);
    showToast('已删除', () => {
      task._pendingDelete = false;
      save(data);
      render();
    });
    deleteUndoTimer = setTimeout(() => {
      data.tasks = data.tasks.filter(t => !t._pendingDelete);
      save(data);
    }, 4500);
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

  // --- Completion log (for weekly review) ---
  function logCompletion() {
    try {
      const log = JSON.parse(localStorage.getItem(COMPLETED_LOG_KEY) || '{}');
      const key = todayKey();
      log[key] = (log[key] || 0) + 1;
      // Keep only last 30 days
      const keys = Object.keys(log).sort();
      if (keys.length > 30) {
        keys.slice(0, keys.length - 30).forEach(k => delete log[k]);
      }
      localStorage.setItem(COMPLETED_LOG_KEY, JSON.stringify(log));
    } catch {}
  }

  // --- Weekly review ---
  function checkWeeklyReview() {
    const now = new Date();
    if (now.getDay() !== 0) return; // Only on Sunday
    const lastReview = localStorage.getItem(REVIEW_KEY);
    const thisWeekKey = todayKey();
    if (lastReview === thisWeekKey) return; // Already shown today

    try {
      const log = JSON.parse(localStorage.getItem(COMPLETED_LOG_KEY) || '{}');
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);

      let weekTotal = 0;
      let activeDays = 0;
      for (let d = new Date(weekAgo); d <= now; d.setDate(d.getDate() + 1)) {
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (log[k]) {
          weekTotal += log[k];
          activeDays++;
        }
      }

      if (weekTotal === 0) return; // Nothing to show

      localStorage.setItem(REVIEW_KEY, thisWeekKey);
      reviewTitle.textContent = `这周你完成了 ${weekTotal} 件事`;
      if (activeDays >= 5) {
        reviewDetail.textContent = `${activeDays} 天都在行动，你比想象的更有力量`;
      } else if (weekTotal >= 10) {
        reviewDetail.textContent = '积少成多，每一件都算数';
      } else {
        reviewDetail.textContent = '每完成一件小事，都是对自己的证明';
      }
      reviewOverlay.classList.remove('hidden');
    } catch {}
  }

  document.getElementById('review-close').addEventListener('click', () => {
    reviewOverlay.classList.add('hidden');
  });
  reviewOverlay.addEventListener('click', e => {
    if (e.target === reviewOverlay) reviewOverlay.classList.add('hidden');
  });

  // --- Notifications (gentle reminder) ---
  const NOTIFICATION_TEXTS = [
    '今天想做点什么吗？',
    '有什么小事可以先开始？',
    '一件小事就够了',
    '不急，打开看看就好',
  ];

  function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function scheduleNotifications() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const now = new Date();
    const today10am = new Date(now); today10am.setHours(10, 0, 0, 0);

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
      const text = NOTIFICATION_TEXTS[Math.floor(Math.random() * NOTIFICATION_TEXTS.length)];
      scheduleAt(today10am, '此刻', text);
    }
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
      { id: makeId(), text: '深呼吸三次，然后点「完成」', isToday: true, done: false, started: false, firstStep: null, created: new Date().toISOString(), doneDate: null },
      { id: makeId(), text: '整理一下你眼前的桌面', isToday: true, done: false, started: false, firstStep: '先把离你最近的一样东西放回原位', created: new Date().toISOString(), doneDate: null },
      { id: makeId(), text: '写下一件你一直想做却还没开始的事', isToday: false, done: false, started: false, firstStep: null, created: new Date().toISOString(), doneDate: null },
    ];
    save(data);
    render();
  }

  // --- Init ---
  checkNewDay();
  render();
  scheduleNotifications();
  addTemplateTasks();
  checkWeeklyReview();

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
