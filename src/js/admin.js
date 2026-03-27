import { validateForm, employeeData } from "./validate.js";
import { createToastForNotification, formatUpdateDate, getErrorMessage, getRelativeTime, hideLoading, hideSpinner, showLoading, showSpinner } from "./utils.js";
import { 
  createEmployeeDataInDatabase,
  getEmployeeDataFromDatabase,
  deleteDataFromDatabase, 
  editEmployeeFromDatabase,
  checkUserLoginOrNot,
  logout,
  supabaseUrl} from "./db.js";

// Get elements
const toggleSidebar = document.getElementById('toggleSidebar');
const sidebar = document.getElementById('sidebar');
const closeSidebar = document.getElementById('closeToggleSidebar');
const roles = document.querySelectorAll('.role');
const employeeModal = document.getElementById("employeeModal");
const modal = document.getElementById("modal");
const openModal = document.getElementById("openModal");
const closeModal = document.getElementById("closeModal");
const form = document.getElementById("employeeForm");
const logoutBtn = document.querySelector('.logout-btn');
const themeToggleBtn = document.getElementById('themeToggleBtn');

// Department normalization (keeps filters + display consistent with legacy saved values)
const ALLOWED_DEPARTMENTS = [
  'Mobile Development',
  'Software Engineering',
  'Graphics Designing',
  'Marketing',
  'Human Resources',
];

const LEGACY_DEPARTMENT_MAP = {
  'Android Development': 'Mobile Development',
  'Mobile Dev': 'Mobile Development',
  'Human resources': 'Human Resources',
  'HR': 'Human Resources',
};

function normalizeDepartmentValue(raw) {
  if (raw == null) return '';
  const v = String(raw).trim();
  if (!v) return '';
  return LEGACY_DEPARTMENT_MAP[v] || v;
}


// CHECK ADMIN AUTHENTICATED OR NOT...
const sessionCheckForAdmin = async () => {
  try {
    const session = await checkUserLoginOrNot();
    if (!session) {
      window.location.href = './index.html';
      return;
    }
    hideLoading();
  } catch (err) {
    console.error('sessionCheckForAdmin:', err);
    window.location.href = './index.html';
  }
};

showLoading("Loading Admin Panel...");
sessionCheckForAdmin().catch(() => {});


if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    showSpinner();
    try {
      await logout();
      sessionCheckForAdmin();
    } catch (err) {
      console.error('Logout:', err);
      createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', getErrorMessage(err, 'Could not sign out.'));
    } finally {
      hideSpinner();
    }
  });
}

// Toggle Sidebar
if (toggleSidebar && sidebar) {
  toggleSidebar.addEventListener('click', () => sidebar.classList.toggle('active'));
}
if (closeSidebar && sidebar) {
  closeSidebar.addEventListener('click', () => sidebar.classList.remove('active'));
}

// Handle active role (including Daily Updates tab)
const employeeListSection = document.getElementById('employeeListSection');
const dailyUpdatesSection = document.getElementById('dailyUpdatesSection');
const employeeBtns = document.getElementById('employeeBtns');

roles.forEach(role => {
  role.addEventListener('click', async (e) => {
    roles.forEach(r => r.classList.remove('active'));
    role.classList.add('active');
    if (sidebar) sidebar.classList.remove('active');

    const section = role.getAttribute('data-section');
    if (section === 'daily-updates') {
      if (employeeListSection) employeeListSection.style.display = 'none';
      if (employeeBtns) employeeBtns.style.display = 'none';
      if (dailyUpdatesSection) {
        dailyUpdatesSection.style.display = 'block';
        loadDailyUpdatesView();
      }
      return;
    }

    if (employeeListSection) employeeListSection.style.display = 'block';
    if (employeeBtns) employeeBtns.style.display = 'flex';
    if (dailyUpdatesSection) dailyUpdatesSection.style.display = 'none';

    const roleEl = e.target.closest('.role');
    const department = roleEl?.getAttribute('data-department') ?? roleEl?.textContent?.trim() ?? '';
    const departmentNormalized = normalizeDepartmentValue(department);
    try {
      const employeesdata = await getEmployeeDataFromDatabase();
      if (department === '' || department === 'All Employees') {
        showEmployeeCard(employeesdata);
      } else {
        const departmentEmployeeData = employeesdata.filter((el) => {
          const empDept = normalizeDepartmentValue(el.employeeData?.department);
          return empDept === departmentNormalized;
        });
        showEmployeeCard(departmentEmployeeData);
      }
    } catch (err) {
      console.error('Failed to load employees:', err);
      createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', getErrorMessage(err, 'Could not load employees.'));
    }
  });
});

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  const firstRole = document.querySelector('.role');
  if (firstRole) firstRole.click();
});

// ————— Theme (admin) —————
const THEME_STORAGE_KEY = 'ems_admin_theme';

function applyTheme(theme) {
  const t = theme === 'light' ? 'light' : 'dark';
  document.body?.setAttribute('data-theme', t);

  // Keep icon consistent with current theme
  if (themeToggleBtn) {
    const icon = themeToggleBtn.querySelector('i');
    if (icon) {
      icon.className = t === 'light' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
    themeToggleBtn.setAttribute('aria-pressed', t === 'light' ? 'true' : 'false');
  }
}

function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(THEME_STORAGE_KEY); } catch (_) {}
  applyTheme(saved || 'dark'); // dark is default

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = document.body?.getAttribute('data-theme') || 'dark';
      const next = current === 'light' ? 'dark' : 'light';
      applyTheme(next);
      try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch (_) {}
    });
  }
}


// Open modal
if (openModal && modal) {
  openModal.addEventListener("click", () => modal.classList.add('active'));
}

// Joining date: enforce 4-digit year only (clear invalid values on change)
const joiningDateEl = document.getElementById('joiningDate');
if (joiningDateEl) {
  joiningDateEl.addEventListener('change', function () {
    const val = this.value.trim();
    if (!val) return;
    const match = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const year = match ? parseInt(match[1], 10) : NaN;
    if (!match || year < 1000 || year > 9999) {
      this.value = '';
      createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', 'Joining date year must be exactly 4 digits (e.g. 2025).');
    }
  });
}

// Close modal
if (closeModal && modal && form) {
  closeModal.addEventListener("click", () => {
    modal.classList.remove('active');
    const btn = form.querySelector('.btn-green');
    if (btn) btn.innerHTML = '<span><i class="fa-solid fa-user-plus"></i></span> Add Employee';
    document.querySelector('#email')?.removeAttribute('readonly');
    document.querySelector('#password')?.removeAttribute('readonly');
    form.removeAttribute('data-edit-id');
    document.querySelector('#employeeId')?.removeAttribute('readonly');
    form.reset();
  });
}

// Single window click handler: close modals only when clicking overlay (not content)
window.addEventListener("click", (e) => {
  if (e.target === modal && modal) {
    modal.classList.remove('active');
    if (form) {
      const btn = form.querySelector('.btn-green');
      if (btn) btn.innerHTML = '<span><i class="fa-solid fa-user-plus"></i></span> Add Employee';
      form.removeAttribute('data-edit-id');
      form.reset();
    }
    document.querySelector('#email')?.removeAttribute('readonly');
    document.querySelector('#password')?.removeAttribute('readonly');
    document.querySelector('#employeeId')?.removeAttribute('readonly');
  } else if (e.target === employeeModal && employeeModal) {
    employeeModal.classList.remove('active');
  }
});


// FORM SUBMITION OR VALIDATION STARTED HERE....
if (form) {
  form.addEventListener("submit", async function (event) {
  event.preventDefault();

  const formEl = event.target;
  const editId = formEl.getAttribute('data-edit-id');

  // Call reusable validation function
  const isValid = await validateForm(formEl, editId);
  
  if (editId) {
    document.querySelector('#password').setAttribute('readonly', '');
  }else {
    document.querySelector('#password').removeAttribute('readonly');
  }

  if (editId && isValid) {
    showSpinner();
    try {
      const allData = await getEmployeeDataFromDatabase();
      const existing = allData.find((e) => String(e.id) === String(editId));
      const merged = {
        ...employeeData,
        dailyUpdates: existing?.employeeData?.dailyUpdates ?? [],
        userId: existing?.employeeData?.userId,
        profilePicture: existing?.employeeData?.profilePicture ?? null,
      };
      await editEmployeeFromDatabase(merged, editId);
      const allDataAfterEdit = await getEmployeeDataFromDatabase();
      showEmployeeCard(allDataAfterEdit);
      const firstRole = document.querySelector('.role');
      if (firstRole) {
        roles.forEach(r => r.classList.remove('active'));
        firstRole.classList.add('active');
        firstRole.click();
      }
      if (modal) modal.classList.remove('active');
      document.querySelector('#email')?.removeAttribute('readonly');
      document.querySelector('#password')?.removeAttribute('readonly');
      const btn = formEl.querySelector('.btn-green');
      if (btn) btn.innerHTML = '<span><i class="fa-solid fa-user-plus"></i></span> Add Employee';
      formEl.removeAttribute('data-edit-id');
      createToastForNotification('success', 'fa-solid fa-circle-check', 'Success', "Employee updated successfully!");
      formEl.reset();
    } catch (err) {
      console.error("Employee update failed:", err);
      createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', getErrorMessage(err, 'Update failed. Please try again.'));
    } finally {
      hideSpinner();
    }
    return;
  }

  if (isValid) {
    showSpinner();
    try {
      const getEmployeeData = await createEmployeeDataInDatabase(employeeData);
      showEmployeeCard(getEmployeeData);
      const firstRole = document.querySelector('.role');
      if (firstRole) {
        roles.forEach(r => r.classList.remove('active'));
        firstRole.classList.add('active');
        firstRole.click();
      }
      formEl.reset();
      if (modal) modal.classList.remove('active');
      createToastForNotification('success', 'fa-solid fa-circle-check', 'Success', "Employee created successfully!");
    } catch (err) {
      createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', getErrorMessage(err, 'Failed to create employee.'));
    } finally {
      hideSpinner();
    }
  }
  });
}


// SHOW EMPLOYEE CARD IN HTML. THAT FUNCTIONALITY STARTED HERE...
const employeeContainer = document.querySelector('.employee-list-card-container');
const showEmployeeCard = (employeeData) => {
  if (!employeeContainer) return;
  const list = Array.isArray(employeeData) ? employeeData : [];
  employeeContainer.innerHTML = '';
  if (list.length === 0) {
    
    employeeContainer.innerHTML = `<div class="empty-employee">
            <span><i class="fa-solid fa-users-slash"></i></span>
            <h3>No employee has been created so far.</h3>
          </div>`
    const emptyEl = employeeContainer.querySelector('.empty-employee');
    if (emptyEl) emptyEl.classList.add('active');
    return;
  }
  list.forEach(({ id, employeeData }) => {
    if (!employeeData) return;
    const empId = employeeData.employeeId || '—';
    // Escape user/DB content to prevent XSS
    const safeName = escapeHtml(employeeData.fullName);
    const safeId = escapeHtml(empId);
    const safeDept = escapeHtml(normalizeDepartmentValue(employeeData.department));
    const rawPreview = (employeeData.description || '').trim() || `Department: ${normalizeDepartmentValue(employeeData.department) || '—'}`;
    const safePreview = escapeHtml(rawPreview);
    const imgSrc = !employeeData.profilePicture ? './assets/images/human-img.png' : `${supabaseUrl}/storage/v1/object/public/${employeeData.profilePicture}`;
    employeeContainer.innerHTML += `<div class="employee-card" data-employeeid="${id}">
                <div class="card-header">
                  <img src="${imgSrc}" alt="Profile Picture" class="profile-pic">
                </div>
                <div class="card-body">
                  <h2 class="employee-name">${safeName}</h2>
                  <p class="employee-id-small">ID: ${safeId}</p>
                  <p class="employee-department">Department: ${safeDept}</p>
                  <p class="employee-preview">${safePreview}</p>
                  <span class="time-badge">${getRelativeTime(employeeData.createdAt)}</span>
                </div>
    </div>`;
  });
};

// Event delegation: one listener on .employee-list-card-container — no per-card ids or listeners
if (employeeContainer) {
  employeeContainer.addEventListener('click', (e) => {
    const card = e.target.closest('.employee-card');
    if (!card) return;
    const rowId = card.getAttribute('data-employeeid');
    if (!rowId) return;
    openEmployeeDetail(rowId);
  });
}

// Open employee detail modal by employee row id
const openEmployeeDetail = async (employeeId) => {
  if (!employeeModal) return;
  try {
    const detailData = await getEmployeeDataFromDatabase();
    const detailEmployeeDataForModel = (Array.isArray(detailData) ? detailData : []).find(
      (employee) => String(employee.id) === String(employeeId)
    );
    if (!detailEmployeeDataForModel) {
      createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', 'Employee not found. The list may be outdated.');
      return;
    }
    showDataInEmployeeDetailModel(detailEmployeeDataForModel);
    employeeModal.classList.add('active');
  } catch (err) {
    console.error('openEmployeeDetail:', err);
    createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', getErrorMessage(err, 'Could not load employee details.'));
  }
};

// Show detail modal for the opened employee only; id is the table row id used for edit/delete
const showDataInEmployeeDetailModel = ({ id, employeeData }) => {
  if (!employeeModal) return;
  const openedEmployeeRowId = id;

  const safeFullName = escapeHtml(employeeData?.fullName);
  const safeEmployeeId = escapeHtml(employeeData?.employeeId || '—');
  const safeDepartment = escapeHtml(normalizeDepartmentValue(employeeData?.department));
  const safeEmail = escapeHtml(employeeData?.email);
  const safeJoiningDate = escapeHtml(employeeData?.joiningDate);
  const modalImgSrc = !employeeData?.profilePicture ? './assets/images/human-img.png' : `${supabaseUrl}/storage/v1/object/public/${employeeData.profilePicture}`;
  
  const updates = normalizeUpdatesArray(employeeData);
  const submittedDates = getUniqueSubmittedDates(updates);
  const todayIso = getTodayStr();
  const isActiveToday = submittedDates.has(todayIso);

  const totalUpdates = updates.length;
  const monthStartIso = getMonthStartIso(new Date());
  const updatesThisMonth = updates.filter((u) => u.date >= monthStartIso && u.date <= todayIso).length;
  const daysSoFarThisMonth = countDaysInclusive(monthStartIso, todayIso);
  const submittedDaysThisMonth = (() => {
    let c = 0;
    for (const d of submittedDates) {
      if (d >= monthStartIso && d <= todayIso) c++;
    }
    return c;
  })();
  const missedDaysThisMonth = Math.max(0, daysSoFarThisMonth - submittedDaysThisMonth);
  const streak = computeCurrentStreak(submittedDates);
  const grid = buildContributionGrid({ submittedDatesSet: submittedDates, weeks: 12 });

  // Last update time (relative). Prefer createdAt; fallback to update date start-of-day.
  const lastUpdateMs = (() => {
    const latest = updates[0];
    if (!latest) return null;
    if (typeof latest.createdAt === 'number' && latest.createdAt > 0) return latest.createdAt;
    const d = new Date(String(latest.date) + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d.getTime();
  })();
  const lastUpdateText = lastUpdateMs ? getRelativeTime(lastUpdateMs) : '—';

  employeeModal.innerHTML = `<div class="modal-content employee-detail">
          <span id="closeEmployeeModal" class="close" >&times;</span>
          <div class="cover-banner"></div>
          <div class="profile-section">
            <img src="${modalImgSrc}" alt="Profile Picture" class="profile-pic-modal">
            <h1>${safeFullName}</h1>
            <div class="employee-info">
              <div class="info-box dark">
                <span class="label">Employee ID:</span>
                <span class="badge">${safeEmployeeId}</span>
              </div>
              <div class="info-box dark">
                <span class="label">Department:</span>
                <span class="badge">${safeDepartment}</span>
              </div>
            </div>
          </div>

          <div class="details">
            <h2>Employee Personal Information:</h2>
            <ul>
                <li><strong>Email:</strong> ${safeEmail}</li>
                <li><strong>Joining Date:</strong> ${safeJoiningDate}</li>
            </ul>
            ${(employeeData?.description && String(employeeData.description).trim())
              ? `<p class="employee-short-desc">${escapeHtml(String(employeeData.description).trim())}</p>`
              : ``}
          </div>

          <div class="activity-panel" aria-label="Employee activity">
            <div class="activity-panel-header">
              <h2 class="activity-title">Activity</h2>
              <div class="activity-actions">
                <span class="activity-status ${isActiveToday ? 'active' : 'missed'}">
                  <i class="fa-solid ${isActiveToday ? 'fa-circle-check' : 'fa-circle-xmark'}"></i>
                  ${isActiveToday ? 'Active Today' : 'Missed Today'}
                </span>
                <button type="button" class="activity-view-btn" data-action="view-activity">
                  <span><i class="fa-solid fa-chart-line"></i></span> View Full Activity
                </button>
              </div>
            </div>

            <div class="activity-stats">
              <div class="activity-stat-card">
                <p class="stat-label">Total updates</p>
                <p class="stat-value">${escapeHtml(String(totalUpdates))}</p>
              </div>
              <div class="activity-stat-card">
                <p class="stat-label">This month</p>
                <p class="stat-value">${escapeHtml(String(updatesThisMonth))}</p>
              </div>
              <div class="activity-stat-card">
                <p class="stat-label">Missed days</p>
                <p class="stat-value">${escapeHtml(String(missedDaysThisMonth))}</p>
              </div>
              <div class="activity-stat-card">
                <p class="stat-label">Last update</p>
                <p class="stat-value">${escapeHtml(String(lastUpdateText))}</p>
              </div>
              <div class="activity-stat-card">
                <p class="stat-label">Current streak</p>
                <p class="stat-value">${escapeHtml(String(streak))} <span class="stat-suffix">day${streak === 1 ? '' : 's'}</span></p>
              </div>
            </div>

            <div class="activity-grid-wrap">
              <p class="activity-grid-hint">Recent 12 weeks • Highlighted days indicate submitted updates</p>
              ${grid.html}
            </div>
          </div>

          <div class="btns">
            <button class="EditBtn"><span><i class="fa-solid fa-pen-to-square"></i></span> Edit Employee</button>
            <button class="deleteBtn"><span><i class="fa-solid fa-trash"></i></span> Delete Employee</button>
          </div>
    </div>`

  // Close modal
  const closeBtn = employeeModal.querySelector('#closeEmployeeModal');
  if (closeBtn) closeBtn.addEventListener('click', () => employeeModal.classList.remove('active'));

  // View full activity
  const viewBtn = employeeModal.querySelector('[data-action="view-activity"]');
  if (viewBtn) {
    viewBtn.addEventListener('click', () => {
      const theme = document.body?.getAttribute('data-theme') || '';
      const qp = new URLSearchParams({ id: String(openedEmployeeRowId), theme });
      window.location.href = `./employee-activity.html?${qp.toString()}`;
    });
  }

  // DELETE EMPLOYEE FROM UI AND DATABASE (uses opened employee only)
  const deleteBtn = employeeModal.querySelector('.deleteBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
    showSpinner();
    try {
      const error = await deleteDataFromDatabase(openedEmployeeRowId);
      if (error) {
        hideSpinner();
        createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', getErrorMessage(error, 'Could not delete employee.'));
        return;
      }
      const data = await getEmployeeDataFromDatabase();
      showEmployeeCard(data);
      employeeModal.classList.remove('active');
      const firstRole = document.querySelector('.role');
      if (firstRole) {
        roles.forEach(r => r.classList.remove('active'));
        firstRole.classList.add('active');
        firstRole.click();
      }
      createToastForNotification('success', 'fa-solid fa-circle-check', 'Success', "Employee deleted successfully.");
    } catch (err) {
      createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', getErrorMessage(err, 'An error occurred while deleting.'));
    } finally {
      hideSpinner();
    }
  });
  }

  // EDIT EMPLOYEE — apply to the currently opened employee only
  const editBtn = employeeModal.querySelector('.EditBtn');
  if (editBtn && form) {
    editBtn.addEventListener('click', () => {
    const submitBtn = form.querySelector('.btn-green');
    if (submitBtn) submitBtn.innerHTML = '<span><i class="fa-solid fa-pen-to-square"></i></span> Update Employee';

    employeeModal.classList.remove('active');
    if (modal) modal.classList.add('active');

    const fullNameEl = document.querySelector('#fullName');
    if (fullNameEl) fullNameEl.value = employeeData?.fullName ?? '';
    const employeeIdInput = document.querySelector('#employeeId');
    if (employeeIdInput) {
      employeeIdInput.value = employeeData?.employeeId ?? '';
      employeeIdInput.setAttribute('readonly', '');
    }
    const emailEl = document.querySelector('#email');
    if (emailEl) { emailEl.value = employeeData?.email ?? ''; emailEl.setAttribute('readonly', ''); }
    const passwordEl = document.querySelector('#password');
    if (passwordEl) { passwordEl.value = employeeData?.password ?? ''; passwordEl.setAttribute('readonly', ''); }
    const joiningEl = document.querySelector('#joiningDate');
    if (joiningEl) joiningEl.value = employeeData?.joiningDate ?? '';
    const deptEl = document.querySelector('#department');
    if (deptEl) {
      const normalized = normalizeDepartmentValue(employeeData?.department ?? '');
      deptEl.value = ALLOWED_DEPARTMENTS.includes(normalized) ? normalized : '';
    }
    const descEl = document.querySelector('#description');
    if (descEl) descEl.value = employeeData?.description ?? '';

    form.setAttribute('data-edit-id', openedEmployeeRowId);
  });
  }
};

// ————— Daily Updates (admin) —————
const UPDATES_PAGE_SIZE = 10;
let allUpdatesAggregate = [];
let currentFilteredUpdates = [];
let currentUpdatesPage = 1;

const UPDATE_STATUS_ORDER = {
  submitted: 0,
  received: 1,
  replied: 2,
  completed: 3,
};

function normalizeUpdateStatus(rawStatus, hasComments = false) {
  const raw = String(rawStatus || '').trim().toLowerCase();
  if (raw in UPDATE_STATUS_ORDER) return raw;
  if (raw === 'reviewed') return hasComments ? 'replied' : 'received';
  return 'submitted';
}

function getStatusMeta(status) {
  const normalized = normalizeUpdateStatus(status);
  if (normalized === 'received') return { label: 'Received', className: 'received' };
  if (normalized === 'replied') return { label: 'Replied', className: 'replied' };
  if (normalized === 'completed') return { label: 'Completed', className: 'completed' };
  return { label: 'Submitted', className: 'submitted' };
}

function aggregateAllUpdates(employeesData) {
  const list = [];
  const data = Array.isArray(employeesData) ? employeesData : [];
  data.forEach((item) => {
    const id = item.id;
    const emp = item.employeeData;
    if (!emp) return;
    const updates = Array.isArray(emp.dailyUpdates) ? emp.dailyUpdates : [];
    updates.forEach((u) => {
      const normalizedUpdate = {
        ...u,
        adminComments: Array.isArray(u.adminComments) ? u.adminComments : [],
      };
      normalizedUpdate.status = normalizeUpdateStatus(normalizedUpdate.status, normalizedUpdate.adminComments.length > 0);
      list.push({
        ...normalizedUpdate,
        employeeName: emp.fullName,
        employeeId: emp.employeeId || '—',
        employeeEmail: emp.email,
        dbId: id,
      });
    });
  });
  list.sort((a, b) => {
    const dateCmp = (b.date || '').localeCompare(a.date || '');
    if (dateCmp !== 0) return dateCmp;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  return list;
}

function buildUpdateField(label, value, fieldKey) {
  const raw = (value || '').trim();
  const safeText = escapeHtml(raw || '—');
  return `
    <div class="update-field">
      <p><strong>${label}:</strong></p>
      <div class="update-text-wrapper" data-field="${fieldKey}">
        <div class="update-text-content">${safeText}</div>
      </div>
    </div>
  `;
}

/** Hash string to a hue (0–360) for consistent name color */
function getNameColor(name) {
  if (!name || typeof name !== 'string') return '42DEDF';
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h) + name.charCodeAt(i);
  h = Math.abs(h) % 360;
  return `hsl(${h}, 65%, 60%)`;
}

/** Raw combined preview for title attribute (updateText or legacy workDone/workPlanned) */
function getUpdatePreviewRaw(u) {
  if (u.updateText != null && String(u.updateText).trim() !== '') {
    return String(u.updateText).trim();
  }
  const done = (u.workDone || '').trim() || '—';
  const next = (u.workPlanned || '').trim() || '—';
  return `Completed: ${done} • Next: ${next}`;
}

/** Escaped combined preview for HTML (max 2 lines via CSS) */
function getUpdatePreviewText(u) {
  return escapeHtml(getUpdatePreviewRaw(u));
}

function cleanPreviewText(raw) {
  if (raw == null) return '—';
  const str = String(raw)
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .trim();
  if (!str) return '—';
  // Keep it readable in a single compact preview (CSS still clamps lines)
  const oneLine = str.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= 150) return oneLine;
  const cut = oneLine.slice(0, 150);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trimEnd() + '...';
}

/** Update preview (prefer updateText; fallback to workDone) for table Update column */
function getUpdatePreviewForTable(u) {
  const raw = (u.updateText != null && String(u.updateText).trim() !== '')
    ? String(u.updateText)
    : (u.workDone != null ? String(u.workDone) : '');
  return escapeHtml(cleanPreviewText(raw));
}

function renderUpdatesList(updates) {
  const container = document.getElementById('updatesListContainer');
  const paginationEl = document.getElementById('updatesPagination');
  if (!container) return;
  container.innerHTML = '';
  if (paginationEl) paginationEl.innerHTML = '';

  currentFilteredUpdates = updates;
  const totalPages = Math.max(1, Math.ceil(updates.length / UPDATES_PAGE_SIZE));
  const start = (currentUpdatesPage - 1) * UPDATES_PAGE_SIZE;
  const pageUpdates = updates.slice(start, start + UPDATES_PAGE_SIZE);

  if (!updates.length) {
    container.innerHTML = `
      <tr class="updates-empty-row">
        <td colspan="3">
          <div class="empty-employee" id="noUpdatesPlaceholder">
            <span><i class="fa-solid fa-clipboard-list"></i></span>
            <h3>No daily updates match the filters.</h3>
          </div>
        </td>
      </tr>`;
    return;
  }

  pageUpdates.forEach((u) => {
    const comments = Array.isArray(u.adminComments) ? u.adminComments : [];
    const latestComment = comments.length ? (comments[comments.length - 1].commentText || '') : '';
    const nameColor = getNameColor(u.employeeName);
    const previewTitleRaw = cleanPreviewText(getUpdatePreviewRaw(u));

    const row = document.createElement('tr');
    row.className = 'update-overview-row';
    row.setAttribute('data-db-id', u.dbId);
    row.setAttribute('data-update-id', u.updateId || '');

    row.innerHTML = `
      <td class="updates-col updates-col-name">
        <span class="update-row-name" style="color:${nameColor}">${escapeHtml(u.employeeName)}</span>
        <span class="update-row-id-badge">[${escapeHtml(u.employeeId)}]</span>
      </td>
      <td class="updates-col updates-col-update">
        <p class="update-row-preview" title="${escapeHtml(previewTitleRaw)}">${getUpdatePreviewForTable(u)}</p>
        <button type="button" class="link-view" data-action="view-full">View</button>
      </td>
      <td class="updates-col updates-col-comments">
        <p class="update-row-comment-preview">${latestComment ? escapeHtml(latestComment) : 'No comments'}</p>
        <button type="button" class="link-add" data-action="add-comment">+ Add</button>
        <div class="add-comment-form" style="display: none;">
          <textarea class="admin-comment-input" rows="2" placeholder="Add your comment..."></textarea>
          <button type="button" class="btn-green submit-comment-btn">Submit</button>
        </div>
      </td>
    `;
    container.appendChild(row);
  });

  // Pagination
  if (!paginationEl) return;
  const frag = document.createDocumentFragment();
  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'pagination-btn';
  prevBtn.textContent = 'Prev';
  prevBtn.disabled = currentUpdatesPage === 1;
  prevBtn.addEventListener('click', () => {
    if (currentUpdatesPage > 1) {
      currentUpdatesPage--;
      renderUpdatesList(currentFilteredUpdates);
    }
  });
  frag.appendChild(prevBtn);

  const maxVisible = 5;
  let from = Math.max(1, currentUpdatesPage - Math.floor(maxVisible / 2));
  let to = Math.min(totalPages, from + maxVisible - 1);
  if (to - from + 1 < maxVisible) from = Math.max(1, to - maxVisible + 1);

  if (from > 1) {
    const one = document.createElement('button');
    one.type = 'button';
    one.className = 'pagination-btn pagination-num';
    one.textContent = '1';
    one.addEventListener('click', () => { currentUpdatesPage = 1; renderUpdatesList(currentFilteredUpdates); });
    frag.appendChild(one);
    if (from > 2) {
      const dots = document.createElement('span');
      dots.className = 'pagination-dots';
      dots.textContent = '...';
      frag.appendChild(dots);
    }
  }

  for (let i = from; i <= to; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pagination-btn pagination-num' + (i === currentUpdatesPage ? ' active' : '');
    btn.textContent = String(i);
    const page = i;
    btn.addEventListener('click', () => { currentUpdatesPage = page; renderUpdatesList(currentFilteredUpdates); });
    frag.appendChild(btn);
  }

  if (to < totalPages) {
    if (to < totalPages - 1) {
      const dots = document.createElement('span');
      dots.className = 'pagination-dots';
      dots.textContent = '...';
      frag.appendChild(dots);
    }
    const last = document.createElement('button');
    last.type = 'button';
    last.className = 'pagination-btn pagination-num';
    last.textContent = String(totalPages);
    last.addEventListener('click', () => { currentUpdatesPage = totalPages; renderUpdatesList(currentFilteredUpdates); });
    frag.appendChild(last);
  }

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'pagination-btn';
  nextBtn.textContent = 'Next';
  nextBtn.disabled = currentUpdatesPage === totalPages;
  nextBtn.addEventListener('click', () => {
    if (currentUpdatesPage < totalPages) {
      currentUpdatesPage++;
      renderUpdatesList(currentFilteredUpdates);
    }
  });
  frag.appendChild(nextBtn);
  if (paginationEl) paginationEl.appendChild(frag);
}

function escapeHtml(text) {
  if (text == null) return '—';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ————— Employee Activity helpers (admin) —————
function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function toValidDateStr(val) {
  if (!val) return null;
  const s = String(val).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function normalizeUpdatesArray(employeeData) {
  const raw = employeeData?.dailyUpdates;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((u) => ({
      ...u,
      date: toValidDateStr(u?.date),
      createdAt: typeof u?.createdAt === 'number' ? u.createdAt : 0,
      adminComments: Array.isArray(u?.adminComments) ? u.adminComments : [],
    }))
    .map((u) => ({
      ...u,
      status: normalizeUpdateStatus(u.status, u.adminComments.length > 0),
    }))
    .filter((u) => !!u.date);
}

async function setUpdateStatusForwardOnly(dbId, updateId, targetStatus) {
  const next = normalizeUpdateStatus(targetStatus);
  if (!(next in UPDATE_STATUS_ORDER)) return false;
  const employees = await getEmployeeDataFromDatabase();
  const employeeRecord = employees.find((emp) => String(emp.id) === String(dbId));
  if (!employeeRecord?.employeeData) return false;

  const updatesArr = Array.isArray(employeeRecord.employeeData.dailyUpdates)
    ? employeeRecord.employeeData.dailyUpdates
    : [];
  let changed = false;

  const updatedUpdates = updatesArr.map((u) => {
    if (String(u.updateId) !== String(updateId)) return u;
    const comments = Array.isArray(u.adminComments) ? u.adminComments : [];
    const current = normalizeUpdateStatus(u.status, comments.length > 0);
    if (UPDATE_STATUS_ORDER[next] <= UPDATE_STATUS_ORDER[current]) {
      return { ...u, status: current, adminComments: comments };
    }
    changed = true;
    return { ...u, status: next, adminComments: comments };
  });

  if (!changed) return false;
  employeeRecord.employeeData.dailyUpdates = updatedUpdates;
  await editEmployeeFromDatabase(employeeRecord.employeeData, employeeRecord.id);
  return true;
}

function getUniqueSubmittedDates(updates) {
  const set = new Set();
  (Array.isArray(updates) ? updates : []).forEach((u) => {
    if (u?.date) set.add(u.date);
  });
  return set;
}

function addDaysIso(isoDate, days) {
  const d = new Date(isoDate + 'T00:00:00');
  if (isNaN(d.getTime())) return isoDate;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getMonthStartIso(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

function countDaysInclusive(startIso, endIso) {
  const a = new Date(startIso + 'T00:00:00');
  const b = new Date(endIso + 'T00:00:00');
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  const diff = Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff + 1 : 0;
}

function computeCurrentStreak(submittedDatesSet) {
  const today = getTodayStr();
  if (!submittedDatesSet?.has(today)) return 0;
  let streak = 0;
  let cursor = today;
  while (submittedDatesSet.has(cursor)) {
    streak++;
    cursor = addDaysIso(cursor, -1);
    if (streak > 3660) break;
  }
  return streak;
}

function buildContributionGrid({ submittedDatesSet, weeks = 12 }) {
  const totalDays = weeks * 7;
  const endIso = getTodayStr();
  const startIso = addDaysIso(endIso, -(totalDays - 1));
  const cells = [];

  for (let i = 0; i < totalDays; i++) {
    const dayIso = addDaysIso(startIso, i);
    const isActive = submittedDatesSet.has(dayIso);
    const isToday = dayIso === endIso;
    cells.push(
      `<div class="activity-cell${isActive ? ' active' : ''}${isToday ? ' today' : ''}" title="${escapeHtml(formatUpdateDate(dayIso))}${isActive ? ' — update submitted' : ''}"></div>`
    );
  }

  return {
    startIso,
    endIso,
    html: `<div class="activity-grid" aria-label="Recent activity grid">${cells.join('')}</div>`,
  };
}

function renderNotSubmittedToday(employeesData) {
  const data = Array.isArray(employeesData) ? employeesData : [];
  const today = new Date().toISOString().slice(0, 10);
  const submitted = new Set();
  data.forEach(({ employeeData: emp }) => {
    const updates = Array.isArray(emp.dailyUpdates) ? emp.dailyUpdates : [];
    const hasToday = updates.some((u) => u.date === today);
    if (hasToday) submitted.add(emp.email);
  });
  const notSubmitted = data.filter((e) => !submitted.has(e.employeeData?.email));
  const el = document.getElementById('updatesNotSubmitted');
  if (!el) return;
  if (notSubmitted.length === 0) {
    el.innerHTML = '<p class="updates-status submitted-all">All employees have submitted for today.</p>';
    return;
  }
  el.innerHTML = '<p class="updates-status pending-label">Not submitted today:</p><ul class="pending-list">' +
    notSubmitted.map((e) => `<li>${escapeHtml(e.employeeData.fullName)} (${escapeHtml(e.employeeData.employeeId || e.employeeData.email)})</li>`).join('') + '</ul>';
}

async function loadDailyUpdatesView() {
  showSpinner();
  try {
    const data = await getEmployeeDataFromDatabase();
    allUpdatesAggregate = aggregateAllUpdates(data);
    currentUpdatesPage = 1;

    const filterEmployee = document.getElementById('filterUpdateEmployee');
    if (filterEmployee) {
      filterEmployee.innerHTML = '<option value="">All Employees</option>';
    data.forEach(({ employeeData: emp }) => {
      if (filterEmployee) {
        const optValue = String(emp.email ?? '').replace(/"/g, '&quot;');
        filterEmployee.innerHTML += `<option value="${optValue}">${escapeHtml(emp.fullName)} (${escapeHtml(emp.employeeId || emp.email)})</option>`;
      }
    });
    }

    // Default: show only today's updates (safe: users can change date/employee then Apply)
    const dateInput = document.getElementById('filterUpdateDate');
    const today = new Date().toISOString().slice(0, 10);
    if (dateInput && !dateInput.value) dateInput.value = today;

    const dateFilter = dateInput?.value ?? '';
    const employeeFilter = document.getElementById('filterUpdateEmployee')?.value ?? '';
    const initialFiltered = allUpdatesAggregate.filter((u) => {
      if (dateFilter && u.date !== dateFilter) return false;
      if (employeeFilter && u.employeeEmail !== employeeFilter) return false;
      return true;
    });
    renderUpdatesList(initialFiltered);

    renderNotSubmittedToday(data);
  } catch (err) {
    console.error('Failed to load daily updates:', err);
    createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', getErrorMessage(err, 'Could not load daily updates. Check your connection.'));
    const container = document.getElementById('updatesListContainer');
    if (container) {
      container.innerHTML = '<div class="empty-employee" id="noUpdatesPlaceholder"><span><i class="fa-solid fa-clipboard-list"></i></span><h3>Could not load updates. Try again later.</h3></div>';
    }
  } finally {
    hideSpinner();
  }
}

document.getElementById('applyUpdateFilters')?.addEventListener('click', () => {
  const today = new Date().toISOString().slice(0, 10);
  let dateFilter = document.getElementById('filterUpdateDate')?.value ?? '';
  const employeeFilter = document.getElementById('filterUpdateEmployee')?.value ?? '';
  // If user didn't choose any filters, keep the default "today only" view
  if (!dateFilter && !employeeFilter) dateFilter = today;
  let filtered = allUpdatesAggregate.filter((u) => {
    if (dateFilter && u.date !== dateFilter) return false;
    if (employeeFilter && u.employeeEmail !== employeeFilter) return false;
    return true;
  });
  currentUpdatesPage = 1;
  renderUpdatesList(filtered);
});

document.getElementById('clearUpdateFilters')?.addEventListener('click', async () => {
  const dateInput = document.getElementById('filterUpdateDate');
  const employeeSelect = document.getElementById('filterUpdateEmployee');
  const today = new Date().toISOString().slice(0, 10);
  // Reset back to the default view: today's updates only
  if (dateInput) dateInput.value = today;
  if (employeeSelect) employeeSelect.value = '';
  try {
    const data = await getEmployeeDataFromDatabase();
    allUpdatesAggregate = aggregateAllUpdates(data);
    currentUpdatesPage = 1;
    const todayOnly = allUpdatesAggregate.filter((u) => u.date === today);
    renderUpdatesList(todayOnly);
    renderNotSubmittedToday(data);
  } catch (err) {
    console.error('Clear filters / reload:', err);
    createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', getErrorMessage(err, 'Could not reload updates.'));
  }
});

// ————— Update detail modal (full update view) —————
const updateDetailModal = document.getElementById('updateDetailModal');
const updateDetailModalBody = document.getElementById('updateDetailModalBody');

function openUpdateDetailModal(dbId, updateId) {
  if (!updateDetailModal || !updateDetailModalBody) return;
  const u = allUpdatesAggregate.find((x) => String(x.dbId) === String(dbId) && String(x.updateId) === String(updateId));
  if (!u) return;
  const comments = Array.isArray(u.adminComments) ? u.adminComments : [];
  const statusMeta = getStatusMeta(u.status);

  const hasUpdateText = u.updateText != null && String(u.updateText).trim() !== '';
  const fieldsHtml = hasUpdateText
    ? buildUpdateField("Today's Update", u.updateText, 'updateText')
    : `${buildUpdateField('Work Done', u.workDone, 'workDone')}
       ${buildUpdateField('Work Planned', u.workPlanned, 'workPlanned')}
       ${buildUpdateField('Blockers', u.blockers, 'blockers')}`;

  if (!updateDetailModalBody) return;
  updateDetailModalBody.innerHTML = `
    <h2 class="update-detail-title">Update details</h2>
    <div class="update-detail-meta">
      <span class="update-employee-name">${escapeHtml(u.employeeName)}</span>
      <span class="update-employee-id">${escapeHtml(u.employeeId)}</span>
      <span class="update-date">${escapeHtml(formatUpdateDate(u.date))}</span>
      <span class="update-status-badge ${statusMeta.className}">${statusMeta.label}</span>
    </div>
    <div class="update-detail-fields">
      ${fieldsHtml}
    </div>
    <div class="update-detail-comments">
      <h4>Admin Comments</h4>
      <div class="comments-list">
        ${comments.length
          ? comments.map((c) => `<div class="comment-item"><span class="comment-text">${escapeHtml(c.commentText || '')}</span></div>`).join('')
          : '<p class="no-comments">No comments yet.</p>'}
      </div>
    </div>
  `;
  updateDetailModal.classList.add('active');
}

async function openUpdateDetailModalWithStatus(dbId, updateId) {
  openUpdateDetailModal(dbId, updateId);
  // Admin viewed update: move Submitted -> Received only once.
  try {
    const changed = await setUpdateStatusForwardOnly(dbId, updateId, 'received');
    if (!changed) return;
    const updatedAllData = await getEmployeeDataFromDatabase();
    allUpdatesAggregate = aggregateAllUpdates(updatedAllData);
    currentFilteredUpdates = allUpdatesAggregate.filter((u) => {
      const dateFilter = document.getElementById('filterUpdateDate')?.value ?? '';
      const employeeFilter = document.getElementById('filterUpdateEmployee')?.value ?? '';
      if (dateFilter && u.date !== dateFilter) return false;
      if (employeeFilter && u.employeeEmail !== employeeFilter) return false;
      return true;
    });
    renderUpdatesList(currentFilteredUpdates);
  } catch (_) {
    // Non-blocking: modal stays open even if status sync fails.
  }
}

function closeUpdateDetailModal() {
  if (updateDetailModal) updateDetailModal.classList.remove('active');
}

document.getElementById('closeUpdateDetailModal')?.addEventListener('click', closeUpdateDetailModal);
window.addEventListener('click', (e) => {
  if (e.target === updateDetailModal) closeUpdateDetailModal();
});

// Event delegation: row click, View Full, Add Comment, Submit Comment
const updatesListContainerEl = document.getElementById('updatesListContainer');

if (updatesListContainerEl) {
  updatesListContainerEl.addEventListener('click', async (e) => {
    const target = e.target;
    const row = target.closest('tr');
    if (!row || row.classList.contains('updates-empty-row')) return;
    if (!row.classList.contains('update-overview-row')) return;

    const dbId = row.getAttribute('data-db-id');
    const updateId = row.getAttribute('data-update-id');

    // View Full button → open detail modal
    if (target.closest('[data-action="view-full"]')) {
      e.stopPropagation();
      openUpdateDetailModalWithStatus(dbId, updateId);
      return;
    }

    // Add Comment → toggle inline form
    if (target.closest('[data-action="add-comment"]')) {
      e.stopPropagation();
      const form = row.querySelector('.add-comment-form');
      if (!form) return;
      const isHidden = form.style.display === 'none' || !form.style.display;
      form.style.display = isHidden ? 'block' : 'none';
      if (isHidden) {
        const textarea = form.querySelector('.admin-comment-input');
        if (textarea) textarea.focus();
      }
      return;
    }

    // Submit Comment
    if (target.closest('.submit-comment-btn')) {
      e.stopPropagation();
      const form = row.querySelector('.add-comment-form');
      if (!form) return;
      const textarea = form.querySelector('.admin-comment-input');
      if (!textarea) return;
      const commentText = textarea.value.trim();
      if (!commentText) {
        createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', 'Comment cannot be empty.');
        return;
      }
      if (!dbId || !updateId) {
        createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', 'Could not identify this update record.');
        return;
      }

      showSpinner();
      try {
        const employees = await getEmployeeDataFromDatabase();
        const employeeRecord = employees.find((emp) => String(emp.id) === String(dbId));
        if (!employeeRecord || !employeeRecord.employeeData) {
          createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', 'Employee record not found.');
          return;
        }

        const updatesArr = Array.isArray(employeeRecord.employeeData.dailyUpdates)
          ? employeeRecord.employeeData.dailyUpdates
          : [];
        const nowTs = Date.now();
        const updatedUpdates = updatesArr.map((u) => {
          if (String(u.updateId) !== String(updateId)) return u;
          const existingComments = Array.isArray(u.adminComments) ? u.adminComments : [];
          const newComment = {
            commentId: nowTs.toString(),
            commentText,
            createdAt: nowTs,
          };
          return {
            ...u,
            status: normalizeUpdateStatus('replied', true),
            adminComments: [...existingComments, newComment],
          };
        });

        employeeRecord.employeeData.dailyUpdates = updatedUpdates;

        await editEmployeeFromDatabase(employeeRecord.employeeData, employeeRecord.id);
        const updatedAllData = await getEmployeeDataFromDatabase();
        allUpdatesAggregate = aggregateAllUpdates(updatedAllData);
        currentFilteredUpdates = allUpdatesAggregate.filter((u) => {
          const dateFilter = document.getElementById('filterUpdateDate').value;
          const employeeFilter = document.getElementById('filterUpdateEmployee').value;
          if (dateFilter && u.date !== dateFilter) return false;
          if (employeeFilter && u.employeeEmail !== employeeFilter) return false;
          return true;
        });

        renderUpdatesList(currentFilteredUpdates);
        renderNotSubmittedToday(updatedAllData);

        textarea.value = '';
        form.style.display = 'none';

        createToastForNotification('success', 'fa-solid fa-circle-check', 'Success', 'Comment added successfully.');
      } catch (err) {
        createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', getErrorMessage(err, 'Failed to add comment.'));
      } finally {
        hideSpinner();
      }
      return;
    }

    // Row click (anywhere else) → open detail modal
    if (target.closest('.update-overview-row') && !target.closest('.add-comment-form') && !target.closest('button')) {
      openUpdateDetailModalWithStatus(dbId, updateId);
    }
  });
}
