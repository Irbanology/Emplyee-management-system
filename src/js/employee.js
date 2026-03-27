// IMPORT ALL MODULES...
import { getCurrentUser, getEmployeeDataFromDatabase, editEmployeeFromDatabase, updateProfileData, supabaseUrl, logout, checkUserLoginOrNot } from "./db.js";
import { createToastForNotification, formatUpdateDate, formatUpdateDateShort, getErrorMessage, hideLoading, hideSpinner, showSpinner, showLoading } from "./utils.js";
import { validateDailyUpdateForm } from "./validate.js";

// Normalize legacy department values for display consistency
const LEGACY_DEPARTMENT_MAP = {
  'Android Development': 'Mobile Development',
  'Mobile Dev': 'Mobile Development',
  'Human resources': 'Human Resources',
  'HR': 'Human Resources',
};

function normalizeDepartmentValue(raw) {
  if (raw == null) return '—';
  const v = String(raw).trim();
  if (!v) return '—';
  return LEGACY_DEPARTMENT_MAP[v] || v;
}


// GET ELEMENT...
const editProfileBtn = document.querySelector('.edit-profile-btn');
const model = document.querySelector(".modal");
const cancelBtn = document.querySelector('.cancel-btn');
const profileForm = document.querySelector('.profileForm');
const previewImg = document.querySelector('.previewImg');
const previewFile = document.querySelector('#profile-pic');
const closeImg = document.querySelector('.closeImg');
const logoutBtn = document.querySelector('.logout');
const dailyUpdateForm = document.getElementById('dailyUpdateForm');
const todayUpdateTextarea = document.getElementById('todayUpdate');
const dailyUpdateStatus = document.getElementById('dailyUpdateStatus');
const submitDailyUpdateBtn = document.getElementById('submitDailyUpdateBtn');

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


let initialLoadingTimer = null;
let initialLoadingShown = false;

function beginInitialLoad() {
  // Show loader only if fetch takes noticeable time.
  initialLoadingTimer = setTimeout(() => {
    showLoading("Loading Profile...");
    initialLoadingShown = true;
  }, 350);
}

function endInitialLoad() {
  if (initialLoadingTimer) {
    clearTimeout(initialLoadingTimer);
    initialLoadingTimer = null;
  }
  if (initialLoadingShown) {
    hideLoading();
    initialLoadingShown = false;
  }
}


if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    showSpinner();
    try {
      await logout();
      window.location.href = './index.html';
    } catch (err) {
      console.error('Logout:', err);
      createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', getErrorMessage(err, 'Could not sign out.'));
    } finally {
      hideSpinner();
    }
  });
}

// ADD LISTNER TO OPEN EDIT PROFILE MODEL...
if (editProfileBtn && model) {
  editProfileBtn.addEventListener("click", () => model.classList.add("active"));
}

// remove LISTNER FOR CLOSE EDIT PROFILE MODEL...
if (cancelBtn && model) {
  cancelBtn.addEventListener("click", () => {
    model.classList.remove("active");
    if (previewFile) previewFile.value = '';
    if (previewImg) { previewImg.src = ''; previewImg.style.display = 'none'; }
    if (closeImg) closeImg.style.display = 'none';
  });
}


// Ensure employeeData has dailyUpdates array and normalized items (for existing records)
function ensureDailyUpdates(empRecord) {
  if (!empRecord?.employeeData) return empRecord;
  if (!Array.isArray(empRecord.employeeData.dailyUpdates)) {
    empRecord.employeeData.dailyUpdates = [];
  } else {
    empRecord.employeeData.dailyUpdates = empRecord.employeeData.dailyUpdates.map((u) => ({
      ...u,
      // Backfill defaults for legacy records
      adminComments: Array.isArray(u.adminComments) ? u.adminComments : [],
      status: normalizeUpdateStatus(u.status, Array.isArray(u.adminComments) && u.adminComments.length > 0),
    }));
  }
  return empRecord;
}

// SHOW USER DATA OVER THE EMPLOYEE PAGE...
let currentEmployeeDataRef = null;
const showUserData = async () => {
  beginInitialLoad();
  try {
    const session = await checkUserLoginOrNot();
    if (!session) {
      window.location.href = './index.html';
      return;
    }

    const user = await getCurrentUser();
    if (!user?.email) {
      window.location.href = './index.html';
      return;
    }
    const allEmployeeData = await getEmployeeDataFromDatabase();
    let currentEmployeeData = (Array.isArray(allEmployeeData) ? allEmployeeData : []).filter(
      ({ employeeData }) => employeeData?.email === user.email
    );
    if (currentEmployeeData.length) {
      currentEmployeeData[0] = ensureDailyUpdates(currentEmployeeData[0]);
    }
    currentEmployeeDataRef = currentEmployeeData;

    showCurrentDataInPage(currentEmployeeData);
    updateDailyUpdateUI(currentEmployeeData);
    renderMyUpdates(currentEmployeeData);
  } catch (err) {
    console.error('showUserData:', err);
    createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', getErrorMessage(err, 'Failed to load profile.'));
  } finally {
    endInitialLoad();
  }
};

showUserData();

// FUNCTION TO SHOW CURRENT DATA OVER THE PAGE...
const showCurrentDataInPage = (employeeData) => {
  if (!Array.isArray(employeeData) || !employeeData.length) {
    const emptyVal = '—';
    const img = document.querySelector('.profile-photo img');
    if (img) img.src = './assets/images/human-img.png';
    const nameEl = document.querySelector('.employee-name');
    if (nameEl) nameEl.textContent = emptyVal;
    const deptEl = document.querySelector('.IT');
    if (deptEl) deptEl.textContent = emptyVal;
    const fullNameInput = document.querySelector('#fullname');
    if (fullNameInput) { fullNameInput.value = ''; fullNameInput.removeAttribute('data-employeeid'); }
    const sel = (q) => document.querySelector(q);
    if (sel('.fullName')) sel('.fullName').textContent = emptyVal;
    if (sel('.email')) sel('.email').textContent = emptyVal;
    if (sel('.joining-date')) sel('.joining-date').textContent = emptyVal;
    if (sel('.desc')) sel('.desc').textContent = emptyVal;
    return;
  }
  const data = employeeData[0]?.employeeData;
  const img = document.querySelector('.profile-photo img');
  if (img) img.src = !data?.profilePicture ? './assets/images/human-img.png' : `${supabaseUrl}/storage/v1/object/public/${data.profilePicture}`;
  const nameEl = document.querySelector('.employee-name');
  if (nameEl) nameEl.textContent = data?.fullName ?? '—';
  const deptEl = document.querySelector('.IT');
  if (deptEl) deptEl.textContent = normalizeDepartmentValue(data?.department);
  const fullNameInput = document.querySelector('#fullname');
  if (fullNameInput) {
    fullNameInput.value = data?.fullName ?? '';
    fullNameInput.setAttribute('data-employeeid', employeeData[0]?.id ?? '');
  }
  const sel = (q) => document.querySelector(q);
  if (sel('.fullName')) sel('.fullName').textContent = data?.fullName ?? '—';
  if (sel('.email')) sel('.email').textContent = data?.email ?? '—';
  if (sel('.joining-date')) sel('.joining-date').textContent = data?.joiningDate ?? '—';
  if (sel('.desc')) sel('.desc').textContent = data?.description ?? '—';
};

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function hasSubmittedToday(employeeData) {
  const data = employeeData?.[0]?.employeeData;
  if (!data || !Array.isArray(data.dailyUpdates)) return false;
  const today = getTodayStr();
  return data.dailyUpdates.some((u) => u.date === today);
}

function updateDailyUpdateUI(employeeData) {
  if (!dailyUpdateStatus || !submitDailyUpdateBtn) return;
  if (hasSubmittedToday(employeeData)) {
    dailyUpdateStatus.textContent = "You have already submitted your update for today.";
    dailyUpdateStatus.className = "daily-update-status submitted";
    submitDailyUpdateBtn.disabled = true;
  } else {
    dailyUpdateStatus.textContent = "";
    dailyUpdateStatus.className = "daily-update-status";
    submitDailyUpdateBtn.disabled = false;
  }
}

function escapeHtmlEmployee(text) {
  if (text == null || text === '') return '—';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/** Fast HTML escape for modal content (no DOM, avoids main-thread jank) */
function escapeHtmlFast(str) {
  if (str == null || str === '') return '—';
  const s = String(str);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function trimPreview(str, maxLen = 100) {
  if (str == null) return '—';
  const t = String(str).trim();
  if (!t) return '—';
  return t.length <= maxLen ? t : t.substring(0, maxLen) + '...';
}

function renderMyUpdates(employeeData) {
  const container = document.getElementById('myUpdatesList');
  if (!container) return;

  const data = employeeData?.[0]?.employeeData;
  const updates = Array.isArray(data?.dailyUpdates) ? data.dailyUpdates : [];

  const sorted = [...updates].sort((a, b) => {
    const dateCmp = (b.date || '').localeCompare(a.date || '');
    if (dateCmp !== 0) return dateCmp;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  if (sorted.length === 0) {
    container.innerHTML = '<p class="my-updates-empty">No updates submitted yet. Submit your first update above.</p>';
    return;
  }

  container.innerHTML = sorted.map((u) => {
    const statusMeta = getStatusMeta(u.status);
    const previewText = u.updateText != null
      ? trimPreview(u.updateText, 120)
      : `${trimPreview(u.workDone, 60)} • ${trimPreview(u.workPlanned, 60)}`;

    return `
      <div class="update-card" data-update-id="${escapeHtmlEmployee(u.updateId)}" role="button" tabindex="0">
        <div class="top">
          <span class="date">${escapeHtmlEmployee(formatUpdateDateShort(u.date))}</span>
          <span class="status ${statusMeta.className}">${escapeHtmlEmployee(statusMeta.label)}</span>
        </div>
        <p class="preview">${escapeHtmlEmployee(previewText)}</p>
      </div>
    `;
  }).join('');
}

// Cached modal elements (avoid repeated getElementById on open)
const updateDetailModalEl = document.getElementById('updateDetailModal');
const updateDetailTitleEl = document.getElementById('updateDetailTitle');
const updateDetailBodyEl = document.getElementById('updateDetailBody');

// Open full update in modal (uses currentEmployeeDataRef). Defers DOM work to rAF for responsive click.
function openUpdateDetailModal(updateId) {
  if (!currentEmployeeDataRef?.length) return;
  const data = currentEmployeeDataRef[0]?.employeeData;
  const updates = Array.isArray(data?.dailyUpdates) ? data.dailyUpdates : [];
  const u = updates.find((x) => String(x.updateId) === String(updateId));
  if (!u) return;
  if (!updateDetailModalEl || !updateDetailTitleEl || !updateDetailBodyEl) return;

  const titleText = `Update — ${formatUpdateDate(u.date)}`;
  const comments = Array.isArray(u.adminComments) ? u.adminComments : [];
  const commentsHtml = comments.length
    ? comments.map((c) => `<div class="update-detail-comment"><span class="update-detail-comment-text">${escapeHtmlFast(c.commentText || '')}</span></div>`).join('')
    : '<p class="update-detail-no-comments">No admin comments yet.</p>';

  const hasUpdateText = u.updateText != null && String(u.updateText).trim() !== '';
  const contentHtml = hasUpdateText
    ? `
    <div class="update-detail-section">
      <p class="update-detail-label">Today's Update</p>
      <div class="update-detail-text">${escapeHtmlFast(u.updateText || '—')}</div>
    </div>
    <div class="update-detail-section update-detail-admin">
      <p class="update-detail-label">Admin feedback</p>
      <div class="update-detail-comments-list">${commentsHtml}</div>
    </div>
  `
    : `
    <div class="update-detail-section">
      <p class="update-detail-label">Work Done</p>
      <div class="update-detail-text">${escapeHtmlFast(u.workDone || '—')}</div>
    </div>
    <div class="update-detail-section">
      <p class="update-detail-label">Work Planned</p>
      <div class="update-detail-text">${escapeHtmlFast(u.workPlanned || '—')}</div>
    </div>
    <div class="update-detail-section">
      <p class="update-detail-label">Blockers</p>
      <div class="update-detail-text">${escapeHtmlFast(u.blockers || '—')}</div>
    </div>
    <div class="update-detail-section update-detail-admin">
      <p class="update-detail-label">Admin feedback</p>
      <div class="update-detail-comments-list">${commentsHtml}</div>
    </div>
  `;

  requestAnimationFrame(() => {
    updateDetailTitleEl.textContent = titleText;
    updateDetailBodyEl.innerHTML = contentHtml;
    updateDetailModalEl.classList.add('active');
    updateDetailModalEl.setAttribute('aria-hidden', 'false');
  });
}

async function completeUpdateIfAcknowledged(updateId) {
  if (!currentEmployeeDataRef?.length) return;
  const record = currentEmployeeDataRef[0];
  const updates = Array.isArray(record?.employeeData?.dailyUpdates) ? record.employeeData.dailyUpdates : [];
  let changed = false;

  const updatedUpdates = updates.map((u) => {
    if (String(u.updateId) !== String(updateId)) return u;
    const comments = Array.isArray(u.adminComments) ? u.adminComments : [];
    if (!comments.length) return { ...u, adminComments: comments, status: normalizeUpdateStatus(u.status, false) };
    const current = normalizeUpdateStatus(u.status, true);
    if (UPDATE_STATUS_ORDER.completed <= UPDATE_STATUS_ORDER[current]) {
      return { ...u, adminComments: comments, status: current };
    }
    changed = true;
    return { ...u, adminComments: comments, status: 'completed' };
  });

  if (!changed) return;
  record.employeeData.dailyUpdates = updatedUpdates;
  await editEmployeeFromDatabase(record.employeeData, record.id);
  currentEmployeeDataRef = [{ ...record, employeeData: { ...record.employeeData } }];
  renderMyUpdates(currentEmployeeDataRef);
}

function closeUpdateDetailModal() {
  if (updateDetailModalEl) {
    updateDetailModalEl.classList.remove('active');
    updateDetailModalEl.setAttribute('aria-hidden', 'true');
  }
}

// Delegated click for update cards + modal close
const myUpdatesListEl = document.getElementById('myUpdatesList');
if (myUpdatesListEl) {
  myUpdatesListEl.addEventListener('click', async (e) => {
    const card = e.target.closest('.update-card');
    if (card) {
      const updateId = card.getAttribute('data-update-id');
      if (updateId) {
        openUpdateDetailModal(updateId);
        try {
          await completeUpdateIfAcknowledged(updateId);
        } catch (_) {
          // Keep UI responsive even if completion sync fails.
        }
      }
      return;
    }
  });
}

document.getElementById('updateDetailClose')?.addEventListener('click', closeUpdateDetailModal);
document.querySelector('.update-detail-backdrop')?.addEventListener('click', closeUpdateDetailModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeUpdateDetailModal();
}, { passive: true });

// PREVIEW IMG CODE FOR SHOW EMPLOYEE PROFILE IMG PREVIEW...
if (previewFile) {
  previewFile.addEventListener("change", (event) => {
    const file = event.target?.files?.[0];
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    if (previewImg) {
      previewImg.src = localUrl;
      previewImg.style.display = 'block';
    }
    if (closeImg) closeImg.style.display = 'block';
  });
}

// DELETE THE IMAGE AND FILE IN PREVIEW WITH THE HELP OF CLOSE BTN...
if (closeImg) {
  closeImg.addEventListener('click', (event) => {
    event.stopImmediatePropagation();
    event.preventDefault();
    if (previewFile) previewFile.value = '';
    if (previewImg) { previewImg.src = ''; previewImg.style.display = 'none'; }
    closeImg.style.display = 'none';
  });
}


// ADD LISTENER TO SUBMIT PROFILE FORM....
if (profileForm) {
  profileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    let fullName = null;
    let profilePictureName = null;
    let employeId = null;

    for (const element of form.elements) {
      if (element.type === 'submit' || element.type === 'button') continue;
      if (element.type === 'text') {
        if (!element.value.trim()) {
          createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', "Full name is required.");
          return;
        }
        fullName = element.value;
        employeId = element.dataset.employeeid;
      }
      if (element.type === 'file' && element.files?.length) {
        profilePictureName = element.files[0];
      }
    }

    showSpinner();
    try {
      const { findEmployee, errors } = await updateProfileData(fullName, profilePictureName, employeId);
      if (!errors) {
        currentEmployeeDataRef = [findEmployee];
        showCurrentDataInPage([findEmployee]);
        if (model) model.classList.remove("active");
        if (previewFile) previewFile.value = '';
        if (previewImg) { previewImg.src = ''; previewImg.style.display = 'none'; }
        if (closeImg) closeImg.style.display = 'none';
        createToastForNotification('success', 'fa-solid fa-circle-check', 'Success', "Profile updated successfully!");
      } else {
        if (model) model.classList.remove("active");
        if (previewFile) previewFile.value = '';
        if (previewImg) { previewImg.src = ''; previewImg.style.display = 'none'; }
        if (closeImg) closeImg.style.display = 'none';
        createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', getErrorMessage(errors, 'Profile update failed.'));
      }
    } catch (err) {
      console.error('Profile update:', err);
      createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', getErrorMessage(err, 'Profile update failed.'));
    } finally {
      hideSpinner();
    }
  });
}

// ————— Daily Work Update —————
if (dailyUpdateForm) {
  dailyUpdateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const updateText = (todayUpdateTextarea?.value ?? '').trim();

    if (!validateDailyUpdateForm(updateText)) return;
    if (!currentEmployeeDataRef?.length) {
      createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', 'Employee data not loaded.');
      return;
    }

    const today = getTodayStr();
    if (hasSubmittedToday(currentEmployeeDataRef)) {
      createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', 'You can only submit one update per day.');
      return;
    }

    const nowTs = Date.now();
    const updateEntry = {
      updateId: nowTs.toString(),
      date: today,
      updateText,
      createdAt: nowTs,
      status: 'submitted',
      adminComments: [],
    };

    const record = currentEmployeeDataRef[0];
    record.employeeData.dailyUpdates = record.employeeData.dailyUpdates || [];
    record.employeeData.dailyUpdates.push(updateEntry);

    showSpinner();
    try {
      await editEmployeeFromDatabase(record.employeeData, record.id);
      currentEmployeeDataRef = [{ ...record, employeeData: { ...record.employeeData } }];
      updateDailyUpdateUI(currentEmployeeDataRef);
      renderMyUpdates(currentEmployeeDataRef);
      dailyUpdateForm.reset();
      submitDailyUpdateBtn.disabled = true;
      createToastForNotification('success', 'fa-solid fa-circle-check', 'Success', 'Daily update submitted successfully!');
    } catch (err) {
      createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', getErrorMessage(err, 'Failed to submit update.'));
    } finally {
      hideSpinner();
    }
  });
}
