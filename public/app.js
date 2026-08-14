const $ = (id) => document.getElementById(id);
const dateFormatter = new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'short' });
const API = '/api/v1';
let mode = 'login';
let accessToken = localStorage.getItem('taskflow-access-token') || '';
let refreshToken = localStorage.getItem('taskflow-refresh-token') || '';
let workspaces = [];
let workspaceId = '';
let projects = [];
let projectId = '';
let tasks = [];
let nextCursor = null;
let currentUser = null;
let members = [];
let completions = [];
let renameTarget = null;
let taskEditId = '';
let comboboxSequence = 0;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function formatDueDate(value) {
  return dateFormatter.format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value) {
  return new Date(value).toLocaleString('vi-VN');
}

function setTaskDueDateMinimum() {
  const minimum = new Date().toISOString().slice(0, 10);
  $('taskDueDate').min = minimum;
  $('taskEditDueDate').min = minimum;
}

function message(id, text, ok = false) {
  const element = $(id);
  element.textContent = text;
  element.className = `message${ok ? ' ok' : ''}`;
}

function closeCombobox(select) {
  const shell = select.closest('.combobox');
  if (!shell) return;
  shell.classList.remove('open');
  shell.querySelector('.combobox-trigger').setAttribute('aria-expanded', 'false');
}

function closeComboboxes(except) {
  document.querySelectorAll('.combobox.open select').forEach((select) => {
    if (select !== except) closeCombobox(select);
  });
}

function syncCombobox(select) {
  const shell = select.closest('.combobox');
  if (!shell) return;
  const trigger = shell.querySelector('.combobox-trigger');
  const value = shell.querySelector('.combobox-value');
  const menu = shell.querySelector('.combobox-menu');
  const selected = select.options[select.selectedIndex];
  value.textContent = selected?.textContent || 'Chọn mục';
  trigger.disabled = select.disabled || !select.options.length;
  menu.replaceChildren(...[...select.options].map((option, index) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'combobox-option';
    item.dataset.index = String(index);
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', String(option.selected));
    item.disabled = option.disabled;
    item.textContent = option.textContent;
    return item;
  }));
}

function openCombobox(select, focusOption = false) {
  const shell = select.closest('.combobox');
  if (!shell) return;
  const trigger = shell.querySelector('.combobox-trigger');
  if (trigger.disabled) return;
  closeComboboxes(select);
  shell.classList.add('open');
  trigger.setAttribute('aria-expanded', 'true');
  if (focusOption) requestAnimationFrame(() => {
    (shell.querySelector('.combobox-option[aria-selected="true"]') || shell.querySelector('.combobox-option:not(:disabled)'))?.focus();
  });
}

function enhanceSelects(scope = document) {
  const selects = scope instanceof HTMLSelectElement ? [scope] : [...scope.querySelectorAll('select')];
  selects.forEach((select) => {
    let shell = select.closest('.combobox');
    if (!shell) {
      const label = select.getAttribute('aria-label') || select.closest('label')?.childNodes[0]?.textContent?.trim() || document.querySelector(`label[for="${select.id}"]`)?.textContent?.trim() || 'Chọn mục';
      const menuId = `combobox-menu-${++comboboxSequence}`;
      shell = document.createElement('div');
      shell.className = 'combobox';
      select.before(shell);
      shell.append(select);
      select.classList.add('combobox-native');
      select.tabIndex = -1;
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'combobox-trigger';
      trigger.setAttribute('aria-label', label);
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-haspopup', 'listbox');
      trigger.setAttribute('aria-controls', menuId);
      trigger.innerHTML = '<span class="combobox-value"></span><span class="combobox-arrow" aria-hidden="true"></span>';
      const menu = document.createElement('div');
      menu.className = 'combobox-menu';
      menu.id = menuId;
      menu.setAttribute('role', 'listbox');
      shell.append(trigger, menu);
      trigger.addEventListener('click', () => {
        if (shell.classList.contains('open')) closeCombobox(select);
        else openCombobox(select);
      });
      if (select.id) document.querySelectorAll(`label[for="${select.id}"]`).forEach((label) => label.addEventListener('click', (event) => {
        event.preventDefault();
        trigger.focus();
        openCombobox(select);
      }));
      trigger.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          openCombobox(select, true);
        }
      });
      menu.addEventListener('click', (event) => {
        const item = event.target.closest('.combobox-option');
        if (!item || item.disabled) return;
        closeCombobox(select);
        select.selectedIndex = Number(item.dataset.index);
        select.dispatchEvent(new Event('change', { bubbles: true }));
        if (trigger.isConnected) trigger.focus();
      });
      menu.addEventListener('keydown', (event) => {
        const options = [...menu.querySelectorAll('.combobox-option:not(:disabled)')];
        const index = options.indexOf(document.activeElement);
        if (event.key === 'Escape') {
          event.preventDefault();
          closeCombobox(select);
          trigger.focus();
        }
        if ((event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') && options.length) {
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
          options[next].focus();
        }
      });
      select.addEventListener('change', () => syncCombobox(select));
    }
    syncCombobox(select);
  });
}

function saveTokens(data) {
  accessToken = data.accessToken;
  refreshToken = data.refreshToken;
  localStorage.setItem('taskflow-access-token', accessToken);
  localStorage.setItem('taskflow-refresh-token', refreshToken);
  localStorage.removeItem('taskflow-token');
}

async function refreshAccessToken() {
  if (!refreshToken) return false;
  const response = await fetch(`${API}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return false;
  saveTokens(data);
  return true;
}

async function api(url, options = {}, retried = false) {
  const headers = new Headers(options.headers || {});
  if (options.body) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(url, { ...options, headers });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (response.status === 401 && !retried && !url.endsWith('/auth/refresh') && await refreshAccessToken()) {
    return api(url, options, true);
  }
  if (response.status === 401) logout();
  if (!response.ok) throw new Error(data.error?.message || 'Có lỗi xảy ra');
  return data;
}

function setMode(nextMode) {
  mode = nextMode;
  const registering = mode === 'register';
  $('authTitle').textContent = registering ? 'Đăng ký TaskFlow' : 'Đăng nhập TaskFlow';
  $('nameField').hidden = !registering;
  $('confirmPasswordField').hidden = !registering;
  $('confirmPassword').required = registering;
  $('authPassword').autocomplete = registering ? 'new-password' : 'current-password';
  $('authButton').textContent = registering ? 'Đăng ký' : 'Đăng nhập';
  $('switchAuth').textContent = registering ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký';
  message('authMessage', '');
}

function resetDashboard() {
  workspaces = [];
  workspaceId = '';
  projects = [];
  projectId = '';
  tasks = [];
  nextCursor = null;
  members = [];
  completions = [];
  renameTarget = null;
  taskEditId = '';
  if ($('taskEditDialog').open) $('taskEditDialog').close();
  if ($('accountDialog').open) $('accountDialog').close();
  $('workspaceSelect').replaceChildren();
  $('projectSelect').replaceChildren();
  $('searchInput').value = '';
  $('statusFilter').value = '';
  syncCombobox($('workspaceSelect'));
  syncCombobox($('projectSelect'));
  syncCombobox($('statusFilter'));
  renderStats({ total: 0, todo: 0, inProgress: 0, done: 0 });
  renderTasks();
  renderAssignees();
  renderCompletions();
  message('appMessage', '');
}

function showApp(user) {
  resetDashboard();
  currentUser = user;
  $('authView').hidden = true;
  $('appView').hidden = false;
  $('userName').textContent = user.name;
  renderAdminControls();
}

function logout() {
  accessToken = '';
  refreshToken = '';
  localStorage.removeItem('taskflow-access-token');
  localStorage.removeItem('taskflow-refresh-token');
  localStorage.removeItem('taskflow-token');
  currentUser = null;
  resetDashboard();
  $('appView').hidden = true;
  $('authView').hidden = false;
  $('authForm').reset();
  setMode('login');
}

function openAccountDialog() {
  if (!currentUser) return;
  $('accountForm').reset();
  $('accountName').value = currentUser.name;
  $('accountError').hidden = true;
  $('accountDialog').showModal();
  requestAnimationFrame(() => {
    $('accountName').focus();
    $('accountName').select();
  });
}

async function saveAccount() {
  const error = $('accountError');
  const currentPassword = $('accountCurrentPassword').value;
  const newPassword = $('accountNewPassword').value;
  const confirmPassword = $('accountConfirmPassword').value;
  const changingPassword = currentPassword || newPassword || confirmPassword;
  if (changingPassword && (!currentPassword || !newPassword || !confirmPassword)) {
    error.textContent = 'Cần nhập đủ mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu.';
    error.hidden = false;
    return;
  }
  if (newPassword && newPassword !== confirmPassword) {
    error.textContent = 'Mật khẩu xác nhận không khớp.';
    error.hidden = false;
    return;
  }
  error.hidden = true;
  $('accountSave').disabled = true;
  try {
    const body = { name: $('accountName').value };
    if (changingPassword) Object.assign(body, { currentPassword, newPassword, confirmPassword });
    const data = await api(`${API}/me`, { method: 'PATCH', body: JSON.stringify(body) });
    currentUser = data.user;
    $('userName').textContent = data.user.name;
    $('accountDialog').close();
    message('appMessage', 'Đã cập nhật tài khoản', true);
  } catch (exception) {
    error.textContent = exception.message;
    error.hidden = false;
  } finally {
    $('accountSave').disabled = false;
  }
}

function canManageWorkspace() {
  return currentUser?.role === 'ADMIN' && workspaces.some((workspace) => workspace.id === workspaceId && workspace.role === 'OWNER');
}

function renderAssignees() {
  const assignees = members.filter((member) => member.role === 'USER');
  $('assigneeSearch').value = '';
  $('taskAssignees').innerHTML = assignees.length ? assignees.map((member) => `
    <label class="assignee-option"><input type="checkbox" value="${member.id}"><span>${escapeHtml(member.name)}</span><small>${escapeHtml(member.email)}</small></label>
  `).join('') : '<span class="field-hint">Thêm user vào workspace trước khi giao việc.</span>';
  $('assigneeEmpty').hidden = true;
  updateAssigneeCount();
}

function updateAssigneeCount() {
  const count = document.querySelectorAll('#taskAssignees input:checked').length;
  $('assigneeCount').textContent = count ? `Đã chọn ${count} user` : 'Chưa chọn user';
}

function filterAssignees(searchId = 'assigneeSearch', listId = 'taskAssignees', emptyId = 'assigneeEmpty') {
  const query = $(searchId).value.trim().toLowerCase();
  let visible = 0;
  document.querySelectorAll(`#${listId} .assignee-option`).forEach((option) => {
    const matches = (option.textContent || '').toLowerCase().includes(query);
    option.hidden = !matches;
    if (matches) visible += 1;
  });
  $(emptyId).hidden = visible > 0 || !query;
}

function renderAdminControls() {
  const isAdmin = currentUser?.role === 'ADMIN';
  const canManage = canManageWorkspace();
  $('workspaceCreateControls').hidden = !isAdmin;
  $('projectCreateControls').hidden = !canManage;
  $('memberControls').hidden = !canManage;
  $('taskFormCard').hidden = !canManage;
  $('completionHistoryCard').hidden = !canManage;
  $('renameWorkspaceButton').hidden = !canManage;
  $('renameProjectButton').hidden = !canManage || !projectId;
  $('deleteWorkspaceButton').hidden = !canManage;
  $('deleteProjectButton').hidden = !canManage || !projectId;
  if (!canManage) {
    members = [];
    completions = [];
    renderAssignees();
    renderCompletions();
  }
}

function renderWorkspaces() {
  $('workspaceSelect').innerHTML = workspaces.map((workspace) => `
    <option value="${workspace.id}" ${workspace.id === workspaceId ? 'selected' : ''}>${escapeHtml(workspace.name)} (${workspace.role})</option>
  `).join('');
  renderAdminControls();
  enhanceSelects($('workspaceSelect'));
}

function renderProjects() {
  $('projectSelect').innerHTML = projects.map((project) => `
    <option value="${project.id}" ${project.id === projectId ? 'selected' : ''}>${escapeHtml(project.name)}</option>
  `).join('');
  renderAdminControls();
  enhanceSelects($('projectSelect'));
}

function renderStats(stats) {
  $('totalCount').textContent = stats.total;
  $('todoCount').textContent = stats.todo;
  $('progressCount').textContent = stats.inProgress;
  $('doneCount').textContent = stats.done;
}

function renderCompletions() {
  $('completionHistory').innerHTML = completions.length ? completions.map((completion) => `
    <li class="completion-item"><strong>${escapeHtml(completion.task.title)}</strong><span>${escapeHtml(completion.task.projectName)} · ${escapeHtml(completion.confirmedBy.name)} (${escapeHtml(completion.confirmedBy.email)}) · ${formatDateTime(completion.completedAt)}</span></li>
  `).join('') : '<li class="empty-state"><strong>Chưa có task hoàn thành</strong><span>Lịch sử xác nhận sẽ hiện ở đây.</span></li>';
}

function renderTasks() {
  const canManage = canManageWorkspace();
  $('taskList').innerHTML = tasks.length ? tasks.map((task) => {
    const title = escapeHtml(task.title);
    const assigneeNames = task.assignees.map((assignee) => escapeHtml(assignee.name)).join(', ');
    const overdue = task.overdue;
    return `
      <li class="task-item status-${task.status.toLowerCase().replace('_', '-')}${overdue ? ' overdue-task' : ''}">
        <div class="task-text">
          <strong>${title}</strong>${task.description ? `<p>${escapeHtml(task.description)}</p>` : ''}
          <div class="task-meta">
            <span class="task-chip priority-${task.priority}">Ưu tiên ${task.priority}/5</span>
            ${task.dueDate ? `<time class="task-chip due-date" datetime="${task.dueDate}">Hạn ${formatDueDate(task.dueDate)}</time>` : ''}
            ${overdue ? '<span class="task-chip overdue">Quá hạn: chưa xác nhận</span>' : ''}
            ${assigneeNames ? `<span class="task-chip">Giao: ${assigneeNames}</span>` : ''}
          </div>
        </div>
        <div class="task-actions">${canManage ? `<select data-status="${task.id}" aria-label="Trạng thái công việc ${title}"><option value="TODO" ${task.status === 'TODO' ? 'selected' : ''}>Cần làm</option><option value="IN_PROGRESS" ${task.status === 'IN_PROGRESS' ? 'selected' : ''}>Đang làm</option><option value="DONE" ${task.status === 'DONE' ? 'selected' : ''}>Hoàn thành</option></select><button data-edit="${task.id}" type="button" aria-label="Sửa công việc ${title}">Sửa</button><button class="danger" data-delete="${task.id}" type="button" aria-label="Xóa công việc ${title}">Xóa</button>` : ''}${task.status !== 'DONE' ? `<button class="complete-button" data-complete="${task.id}" type="button">Xác nhận đã làm xong</button>` : ''}</div>
      </li>
    `;
  }).join('') : '<li class="empty-state"><strong>Chưa có công việc</strong><span>Thêm công việc đầu tiên để bắt đầu.</span></li>';
  $('loadMoreButton').hidden = !nextCursor;

  document.querySelectorAll('[data-status]').forEach((select) => select.addEventListener('change', () => updateTask(select.dataset.status, { status: select.value })));
  document.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => editTask(button.dataset.edit)));
  document.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () => deleteTask(button.dataset.delete)));
  document.querySelectorAll('[data-complete]').forEach((button) => button.addEventListener('click', () => completeTask(button.dataset.complete)));
  enhanceSelects($('taskList'));
}

async function loadWorkspaces() {
  const data = await api(`${API}/workspaces`);
  workspaces = data.workspaces;
  if (!workspaces.some((workspace) => workspace.id === workspaceId)) workspaceId = workspaces[0]?.id || '';
  renderWorkspaces();
}

async function loadProjects() {
  if (!workspaceId) {
    projects = [];
    projectId = '';
    renderProjects();
    return;
  }
  const data = await api(`${API}/workspaces/${workspaceId}/projects`);
  projects = data.projects;
  if (!projects.some((project) => project.id === projectId)) projectId = projects[0]?.id || '';
  renderProjects();
}

async function loadMembers() {
  if (!canManageWorkspace()) {
    members = [];
    renderAssignees();
    return;
  }
  const data = await api(`${API}/workspaces/${workspaceId}/members`);
  members = data.members;
  renderAssignees();
}

async function loadCompletions() {
  if (!canManageWorkspace()) {
    completions = [];
    renderCompletions();
    return;
  }
  const data = await api(`${API}/workspaces/${workspaceId}/completions`);
  completions = data.completions;
  renderCompletions();
}

async function loadTasks(loadMore = false) {
  if (!projectId) {
    tasks = [];
    nextCursor = null;
    renderTasks();
    return;
  }
  const params = new URLSearchParams({ limit: '20', sort: 'createdAt', order: 'desc' });
  if (loadMore && nextCursor) params.set('cursor', nextCursor);
  if ($('searchInput').value) params.set('q', $('searchInput').value);
  if ($('statusFilter').value) params.set('status', $('statusFilter').value);
  const data = await api(`${API}/projects/${projectId}/tasks?${params}`);
  tasks = loadMore ? [...tasks, ...data.items] : data.items;
  nextCursor = data.pagination.nextCursor;
  renderTasks();
}

async function loadStats() {
  if (!workspaceId) return renderStats({ total: 0, todo: 0, inProgress: 0, done: 0 });
  const data = await api(`${API}/workspaces/${workspaceId}/stats`);
  renderStats(data.stats);
}

async function refresh() {
  await loadWorkspaces();
  await loadProjects();
  await Promise.all([loadMembers(), loadTasks(), loadStats(), loadCompletions()]);
}

async function updateTask(id, changes) {
  try {
    await api(`${API}/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });
    await Promise.all([loadTasks(), loadStats(), loadCompletions()]);
  } catch (error) {
    message('appMessage', error.message);
  }
}

function renderTaskEditAssignees(task) {
  const assigned = new Set(task.assignees.map((assignee) => assignee.id));
  const assignees = members.filter((member) => member.role === 'USER');
  $('taskEditAssigneeSearch').value = '';
  $('taskEditAssignees').innerHTML = assignees.length ? assignees.map((member) => `
    <label class="assignee-option"><input type="checkbox" value="${member.id}"${assigned.has(member.id) ? ' checked' : ''}><span>${escapeHtml(member.name)}</span><small>${escapeHtml(member.email)}</small></label>
  `).join('') : '<span class="field-hint">Chưa có user trong workspace này.</span>';
  $('taskEditAssigneeEmpty').hidden = true;
}

async function editTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;
  try {
    if (!members.length) await loadMembers();
    taskEditId = task.id;
    $('taskEditTitle').value = task.title;
    $('taskEditDescription').value = task.description;
    $('taskEditStatus').value = task.status;
    $('taskEditPriority').value = task.priority;
    syncCombobox($('taskEditStatus'));
    syncCombobox($('taskEditPriority'));
    $('taskEditDueDate').value = task.dueDate || '';
    setTaskDueDateMinimum();
    renderTaskEditAssignees(task);
    $('taskEditError').hidden = true;
    $('taskEditDialog').showModal();
    requestAnimationFrame(() => $('taskEditTitle').focus());
  } catch (error) {
    message('appMessage', error.message);
  }
}

async function saveTaskEdit() {
  const taskId = taskEditId;
  const error = $('taskEditError');
  const dueDate = $('taskEditDueDate');
  if (!taskId) return;
  setTaskDueDateMinimum();
  if (dueDate.value < dueDate.min) {
    error.textContent = 'Ngày hạn không được ở quá khứ.';
    error.hidden = false;
    return;
  }
  $('taskEditSave').disabled = true;
  try {
    await api(`${API}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: $('taskEditTitle').value,
        description: $('taskEditDescription').value,
        status: $('taskEditStatus').value,
        priority: Number($('taskEditPriority').value),
        dueDate: dueDate.value,
        assigneeIds: [...document.querySelectorAll('#taskEditAssignees input:checked')].map((input) => input.value)
      })
    });
    $('taskEditDialog').close();
    await Promise.all([loadTasks(), loadStats(), loadCompletions()]);
    message('appMessage', 'Đã cập nhật công việc', true);
  } catch (exception) {
    error.textContent = exception.message;
    error.hidden = false;
  } finally {
    $('taskEditSave').disabled = false;
  }
}

async function deleteTask(id) {
  if (!confirm('Bạn muốn xóa công việc này?')) return;
  try {
    await api(`${API}/tasks/${id}`, { method: 'DELETE' });
    await Promise.all([loadTasks(), loadStats(), loadCompletions()]);
  } catch (error) {
    message('appMessage', error.message);
  }
}

function openRenameDialog(kind, item) {
  renameTarget = { kind, id: item.id, name: item.name };
  $('renameDialogTitle').textContent = `Đổi tên ${kind === 'workspace' ? 'workspace' : 'dự án'}`;
  $('renameDialogCopy').textContent = `Tên hiện tại: ${item.name}`;
  $('renameDialogInput').value = item.name;
  $('renameDialogError').hidden = true;
  $('renameDialog').showModal();
  requestAnimationFrame(() => {
    $('renameDialogInput').focus();
    $('renameDialogInput').select();
  });
}

function renameWorkspace() {
  const workspace = workspaces.find((item) => item.id === workspaceId);
  if (workspace) openRenameDialog('workspace', workspace);
}

function renameProject() {
  const project = projects.find((item) => item.id === projectId);
  if (project) openRenameDialog('project', project);
}

async function saveRename() {
  const target = renameTarget;
  const name = $('renameDialogInput').value.trim();
  const error = $('renameDialogError');
  if (!target) return;
  if (name.length < 3) {
    error.textContent = 'Tên cần có ít nhất 3 ký tự.';
    error.hidden = false;
    return;
  }
  if (name === target.name) {
    $('renameDialog').close();
    return;
  }
  $('renameDialogSave').disabled = true;
  try {
    await api(`${API}/${target.kind === 'workspace' ? 'workspaces' : 'projects'}/${target.id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
    $('renameDialog').close();
    await refresh();
    message('appMessage', `Đã đổi tên ${target.kind === 'workspace' ? 'workspace' : 'dự án'}`, true);
  } catch (error) {
    $('renameDialogError').textContent = error.message;
    $('renameDialogError').hidden = false;
  } finally {
    $('renameDialogSave').disabled = false;
  }
}

async function deleteWorkspace() {
  if (!workspaceId || !confirm('Xóa workspace này cùng toàn bộ dự án, task và lịch sử?')) return;
  try {
    await api(`${API}/workspaces/${workspaceId}`, { method: 'DELETE' });
    workspaceId = '';
    projectId = '';
    await refresh();
    message('appMessage', 'Đã xóa workspace', true);
  } catch (error) {
    message('appMessage', error.message);
  }
}

async function deleteProject() {
  if (!projectId || !confirm('Xóa dự án này cùng toàn bộ task và lịch sử?')) return;
  try {
    await api(`${API}/projects/${projectId}`, { method: 'DELETE' });
    projectId = '';
    await refresh();
    message('appMessage', 'Đã xóa dự án', true);
  } catch (error) {
    message('appMessage', error.message);
  }
}

async function completeTask(id) {
  try {
    const data = await api(`${API}/tasks/${id}/complete`, { method: 'POST' });
    message('appMessage', data.completion ? 'Đã xác nhận hoàn thành' : 'Task đã được xác nhận trước đó', true);
    await Promise.all([loadTasks(), loadStats(), loadCompletions()]);
  } catch (error) {
    message('appMessage', error.message);
  }
}

$('switchAuth').addEventListener('click', () => setMode(mode === 'login' ? 'register' : 'login'));
$('authForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const body = { email: $('authEmail').value, password: $('authPassword').value };
    if (mode === 'register') {
      if ($('authPassword').value !== $('confirmPassword').value) return message('authMessage', 'Mật khẩu xác nhận không khớp');
      body.name = $('authName').value;
      body.confirmPassword = $('confirmPassword').value;
    }
    const data = await api(`${API}/auth/${mode}`, { method: 'POST', body: JSON.stringify(body) });
    saveTokens(data);
    showApp(data.user);
    await refresh();
  } catch (error) {
    message('authMessage', error.message);
  }
});

$('logoutButton').addEventListener('click', logout);
$('accountButton').addEventListener('click', openAccountDialog);
$('assigneeSearch').addEventListener('input', () => filterAssignees());
$('taskEditAssigneeSearch').addEventListener('input', () => filterAssignees('taskEditAssigneeSearch', 'taskEditAssignees', 'taskEditAssigneeEmpty'));
$('taskDueDate').addEventListener('focus', setTaskDueDateMinimum);
$('taskEditDueDate').addEventListener('focus', setTaskDueDateMinimum);
$('taskAssignees').addEventListener('change', updateAssigneeCount);
$('renameDialogForm').addEventListener('submit', (event) => { event.preventDefault(); void saveRename(); });
$('renameDialogCancel').addEventListener('click', () => $('renameDialog').close());
$('renameDialog').addEventListener('close', () => { renameTarget = null; });
$('taskEditForm').addEventListener('submit', (event) => { event.preventDefault(); void saveTaskEdit(); });
$('taskEditCancel').addEventListener('click', () => $('taskEditDialog').close());
$('taskEditDialog').addEventListener('close', () => { taskEditId = ''; });
$('accountForm').addEventListener('submit', (event) => { event.preventDefault(); void saveAccount(); });
$('accountCancel').addEventListener('click', () => $('accountDialog').close());
$('accountDialog').addEventListener('close', () => $('accountForm').reset());
$('renameWorkspaceButton').addEventListener('click', renameWorkspace);
$('renameProjectButton').addEventListener('click', renameProject);
$('deleteWorkspaceButton').addEventListener('click', deleteWorkspace);
$('deleteProjectButton').addEventListener('click', deleteProject);
$('workspaceSelect').addEventListener('change', async () => {
  workspaceId = $('workspaceSelect').value;
  projectId = '';
  await loadProjects();
  renderAdminControls();
  await Promise.all([loadMembers(), loadTasks(), loadStats(), loadCompletions()]);
});
$('workspaceForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const data = await api(`${API}/workspaces`, { method: 'POST', body: JSON.stringify({ name: $('workspaceName').value }) });
    workspaceId = data.workspace.id;
    $('workspaceForm').reset();
    await refresh();
  } catch (error) {
    message('appMessage', error.message);
  }
});
$('projectSelect').addEventListener('change', async () => { projectId = $('projectSelect').value; renderAdminControls(); await loadTasks(); });
$('memberForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api(`${API}/workspaces/${workspaceId}/members`, { method: 'POST', body: JSON.stringify({ email: $('memberEmail').value, role: 'VIEWER' }) });
    $('memberForm').reset();
    await loadMembers();
    message('appMessage', 'Đã thêm user vào workspace', true);
  } catch (error) {
    message('appMessage', error.message);
  }
});
$('projectForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const data = await api(`${API}/workspaces/${workspaceId}/projects`, { method: 'POST', body: JSON.stringify({ name: $('projectName').value }) });
    projectId = data.project.id;
    $('projectForm').reset();
    await Promise.all([loadProjects(), loadTasks(), loadStats()]);
  } catch (error) {
    message('appMessage', error.message);
  }
});

$('taskForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!projectId) return message('appMessage', 'Hãy tạo dự án trước');
  setTaskDueDateMinimum();
  if ($('taskDueDate').value && $('taskDueDate').value < $('taskDueDate').min) return message('appMessage', 'Ngày hạn không được ở quá khứ');
  try {
    await api(`${API}/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        title: $('taskTitle').value,
        description: $('taskDescription').value,
        status: $('taskStatus').value,
        priority: Number($('taskPriority').value),
        dueDate: $('taskDueDate').value || null,
        assigneeIds: [...document.querySelectorAll('#taskAssignees input:checked')].map((input) => input.value)
      })
    });
    $('taskForm').reset();
    syncCombobox($('taskStatus'));
    syncCombobox($('taskPriority'));
    updateAssigneeCount();
    filterAssignees();
    message('appMessage', 'Đã thêm công việc', true);
    await Promise.all([loadTasks(), loadStats()]);
  } catch (error) {
    message('appMessage', error.message);
  }
});

$('searchInput').addEventListener('input', () => loadTasks());
$('statusFilter').addEventListener('change', () => loadTasks());
$('loadMoreButton').addEventListener('click', () => loadTasks(true));
document.addEventListener('pointerdown', (event) => {
  if (event.target instanceof Element && !event.target.closest('.combobox')) closeComboboxes();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeComboboxes();
});

setTaskDueDateMinimum();
enhanceSelects();
setMode('login');
if (accessToken || refreshToken) {
  api(`${API}/me`).then(async ({ user }) => { showApp(user); await refresh(); }).catch(logout);
}
