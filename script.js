const tasksContainer = document.getElementById('tasks');
const addForm = document.getElementById('add-form');
const taskInput = document.getElementById('task-input');
const dateInput = document.getElementById('date-input');
const timeInput = document.getElementById('time-input');
const priorityInput = document.getElementById('priority-input');
const searchInput = document.getElementById('search');
const sortSelect = document.getElementById('sort');
const filterButtons = Array.from(document.querySelectorAll('.filter-btn'));
const progressText = document.getElementById('progress-text');
const progressBar = document.getElementById('progress-bar');
const datetimeEl = document.getElementById('datetime');
const statusPill = document.getElementById('status-pill');
const clearCompletedBtn = document.getElementById('clear-completed');
const nextDuePill = document.getElementById('next-due-pill');
const statTotal = document.getElementById('stat-total');
const statPending = document.getElementById('stat-pending');
const statDone = document.getElementById('stat-done');
const statOverdue = document.getElementById('stat-overdue');
const statSoon = document.getElementById('stat-soon');

let tasks = loadTasks();
let currentFilter = 'all';

function loadTasks() {
  try {
    const stored = JSON.parse(localStorage.getItem('modern-tasks') || '[]');
    if (!Array.isArray(stored)) return [];
    return stored.map(t => {
      const clone = { ...t };
      delete clone._new;
      clone.priority = clone.priority || 'medium';
      return clone;
    });
  } catch (e) {
    return [];
  }
}

function persist() {
  localStorage.setItem('modern-tasks', JSON.stringify(tasks));
}

function formatDue(iso) {
  if (!iso) return 'No due date';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function taskState(task) {
  if (task.completed) return 'completed';
  if (task.due && new Date(task.due) < new Date()) return 'overdue';
  return 'pending';
}

function relativeDue(iso) {
  if (!iso) return 'No due date';
  const now = Date.now();
  const time = new Date(iso).getTime();
  if (isNaN(time)) return 'No due date';
  const diff = time - now;
  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  if (diff < 0) {
    if (minutes < 60) return `Overdue by ${minutes}m`;
    if (hours < 24) return `Overdue by ${hours}h`;
    return `Overdue by ${days}d`;
  }
  if (minutes < 60) return `Due in ${minutes}m`;
  if (hours < 48) return `Due in ${hours}h`;
  return `Due in ${days}d`;
}

function priorityRank(priority) {
  if (priority === 'high') return 2;
  if (priority === 'medium') return 1;
  return 0;
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = tasks.filter(t => {
    const matchesText = t.title.toLowerCase().includes(query);
    const state = taskState(t);
    const filterPass = currentFilter === 'all' || state === currentFilter;
    return matchesText && filterPass;
  });

  const sorted = filtered.sort((a, b) => {
    const dueA = a.due ? new Date(a.due).getTime() : Infinity;
    const dueB = b.due ? new Date(b.due).getTime() : Infinity;
    if (sortSelect.value === 'due-asc') return dueA - dueB;
    if (sortSelect.value === 'due-desc') return dueB - dueA;
    if (sortSelect.value === 'newest') return b.createdAt - a.createdAt;
    if (sortSelect.value === 'oldest') return a.createdAt - b.createdAt;
    if (sortSelect.value === 'priority') return priorityRank(b.priority) - priorityRank(a.priority);
    return 0;
  });

  tasksContainer.innerHTML = '';

  if (!sorted.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No tasks match this view yet.';
    tasksContainer.appendChild(empty);
  }

  sorted.forEach(t => {
    const state = taskState(t);
    const item = document.createElement('div');
    item.className = `task ${state}${t._new ? ' new' : ''}`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'checkbox';
    checkbox.checked = t.completed;
    checkbox.addEventListener('change', () => {
      t.completed = checkbox.checked;
      persist();
      render();
    });

    const content = document.createElement('div');
    content.className = 'task-content';

    const title = document.createElement('div');
    title.className = 'task-title';
    title.textContent = t.title;
    if (t.completed) title.style.textDecoration = 'line-through';

    const meta = document.createElement('div');
    meta.className = 'task-meta';
    const badge = document.createElement('span');
    badge.className = `badge ${state}`;
    badge.textContent = state;
    const priority = document.createElement('span');
    priority.className = `priority-chip ${t.priority}`;
    priority.innerHTML = `<i class="fa-solid fa-star"></i>${t.priority}`;
    const due = document.createElement('span');
    const dueText = t.due ? `${formatDue(t.due)} • ${relativeDue(t.due)}` : 'No due date';
    due.textContent = dueText;
    meta.append(badge, priority, due);

    content.append(title, meta);

    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'icon-btn';
    editBtn.title = 'Edit task';
    editBtn.innerHTML = '<i class="fa-regular fa-pen-to-square"></i>';
    editBtn.addEventListener('click', () => editTask(t.id));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-btn';
    deleteBtn.title = 'Delete task';
    deleteBtn.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
    deleteBtn.addEventListener('click', () => deleteTask(t.id));

    actions.append(editBtn, deleteBtn);

    item.append(checkbox, content, actions);
    tasksContainer.appendChild(item);

    if (t._new) {
      setTimeout(() => {
        delete t._new;
        item.classList.remove('new');
      }, 400);
    }
  });

  const total = tasks.length;
  const done = tasks.filter(t => t.completed).length;
  const pending = tasks.filter(t => !t.completed && taskState(t) === 'pending').length;
  const overdue = tasks.filter(t => taskState(t) === 'overdue').length;
  const soon = tasks.filter(t => !t.completed && isDueSoon(t.due)).length;
  progressText.textContent = `${done} of ${total} tasks completed`;
  const percent = total ? Math.round((done / total) * 100) : 0;
  progressBar.style.width = `${percent}%`;
  const statusHtml = overdue
    ? `<i class="fa-solid fa-triangle-exclamation"></i><span>${overdue} overdue</span>`
    : soon
    ? `<i class="fa-regular fa-clock"></i><span>${soon} due soon</span>`
    : total
    ? `<i class="fa-solid fa-bolt"></i><span>${percent}% done</span>`
    : '<i class="fa-regular fa-hourglass-half"></i><span>Stay organized</span>';
  statusPill.innerHTML = statusHtml;
  updateStats({ total, done, pending, overdue, soon });
  updateNextDue();
}

function addTask(title, dateValue, timeValue) {
  const due = buildDue(dateValue, timeValue);
  const task = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    title: title.trim(),
    due,
    completed: false,
    createdAt: Date.now(),
    priority: priorityInput.value || 'medium',
    _new: true
  };
  tasks.unshift(task);
  persist();
  render();
}

function buildDue(dateValue, timeValue) {
  if (!dateValue && !timeValue) return '';
  const datePart = dateValue || new Date().toISOString().slice(0, 10);
  const timePart = timeValue || '23:59';
  const combined = new Date(`${datePart}T${timePart}`);
  return isNaN(combined.getTime()) ? '' : combined.toISOString();
}

function editTask(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  const newTitle = prompt('Update task title', t.title) || t.title;
  const newDate = prompt('Update due date (YYYY-MM-DD) or leave empty', t.due ? t.due.slice(0, 10) : '');
  const newTime = prompt('Update due time (HH:MM) or leave empty', t.due ? new Date(t.due).toISOString().slice(11, 16) : '');
   const newPriority = prompt('Priority (high, medium, low)', t.priority || 'medium') || t.priority;
  t.title = newTitle.trim() || t.title;
  t.due = buildDue(newDate, newTime);
   t.priority = ['high', 'medium', 'low'].includes((newPriority || '').toLowerCase()) ? newPriority.toLowerCase() : t.priority;
  persist();
  render();
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  persist();
  render();
}

addForm.addEventListener('submit', e => {
  e.preventDefault();
  const title = taskInput.value.trim();
  if (!title) return;
  addTask(title, dateInput.value, timeInput.value);
  addForm.reset();
  priorityInput.value = 'medium';
  taskInput.focus();
});

searchInput.addEventListener('input', render);
sortSelect.addEventListener('change', render);
clearCompletedBtn.addEventListener('click', () => {
  tasks = tasks.filter(t => !t.completed);
  persist();
  render();
});

filterButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    filterButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    render();
  });
});

function tickClock() {
  const now = new Date();
  datetimeEl.textContent = now.toLocaleString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

setInterval(tickClock, 1000);
tickClock();

render();

function isDueSoon(iso) {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  if (isNaN(time)) return false;
  const now = Date.now();
  const diff = time - now;
  return diff > 0 && diff <= 86400000;
}

function updateStats({ total, done, pending, overdue, soon }) {
  statTotal.textContent = total;
  statPending.textContent = pending;
  statDone.textContent = done;
  statOverdue.textContent = overdue;
  statSoon.textContent = soon;
}

function updateNextDue() {
  const upcoming = tasks
    .filter(t => !t.completed && t.due)
    .sort((a, b) => new Date(a.due) - new Date(b.due))[0];
  if (!upcoming) {
    nextDuePill.innerHTML = '<i class="fa-regular fa-calendar"></i><span>No due dates yet</span>';
    return;
  }
  nextDuePill.innerHTML = `<i class="fa-regular fa-clock"></i><span>Next: ${formatDue(upcoming.due)} (${relativeDue(upcoming.due)})</span>`;
}
