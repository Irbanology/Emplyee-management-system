import { validateForm, employeeData } from "./validate.js";
import { createToastForNotification, formatUpdateDate, getErrorMessage, getRelativeTime, hideSpinner, showLoading, showSpinner } from "./utils.js";
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


// CHECK ADMIN AUTHHENTICATED OR NOT...
const sessionCheckForAdmin = async () => {
  try {
    const session = await checkUserLoginOrNot();
    if (!session) {
      window.location.href = './index.html';
      return;
    }
  } catch (err) {
    console.error('sessionCheckForAdmin:', err);
    window.location.href = './index.html';
  }
};

sessionCheckForAdmin().catch(() => {});
showLoading("Loading Admin Panel...");


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
    try {
      const employeesdata = await getEmployeeDataFromDatabase();
      if (department === '' || department === 'All Employees') {
        showEmployeeCard(employeesdata);
      } else {
        const departmentEmployeeData = employeesdata.filter((el) => el.employeeData?.department === department);
        showEmployeeCard(departmentEmployeeData);
      }
    } catch (err) {
      console.error('Failed to load employees:', err);
      createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', getErrorMessage(err, 'Could not load employees.'));
    }
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const firstRole = document.querySelector('.role');
  if (firstRole) firstRole.click();
});


// Open modal
if (openModal && modal) {
  openModal.addEventListener("click", () => modal.classList.add('active'));
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
    console.log("EDITING ID:", editId);
    try {
      const allData = await getEmployeeDataFromDatabase();
      const existing = allData.find((e) => String(e.id) === String(editId));
      const merged = {
        ...employeeData,
        dailyUpdates: existing?.employeeData?.dailyUpdates ?? [],
        userId: existing?.employeeData?.userId,
        profilePicture: existing?.employeeData?.profilePicture ?? null,
      };
      console.log("EDITING employeeData (merged):", merged);
      const editEmployeeData = await editEmployeeFromDatabase(merged, editId);
      showEmployeeCard(editEmployeeData);
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
    // No id on card — only class and data-employeeid so each click targets the correct card
    employeeContainer.innerHTML += `<div class="employee-card" data-employeeid="${id}">
                <div class="card-header">
                  <img src="${!employeeData.profilePicture ? "./assets/images/human-img.png" : `${supabaseUrl}/storage/v1/object/public/${employeeData.profilePicture}` }" alt="Profile Picture" class="profile-pic">
                </div>
                <div class="card-body">
                  <h2 class="employee-name">${employeeData.fullName}</h2>
                  <p class="employee-id-small">ID: ${empId}</p>
                  <p class="employee-department">Department: ${employeeData.department}</p>
                  <p class="employee-description">
                   ${employeeData.description}
                  </p>
                  <div class="date-div">
                    <p>${getRelativeTime(employeeData.createdAt)}</p>
                  </div>
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

  employeeModal.innerHTML = `<div class="modal-content employee-detail">
          <span id="closeEmployeeModal" class="close" >&times;</span>
          <div class="cover-video">
            <video src="./assets/videos/cover-video.mp4" muted autoplay loop alt='cover video'></video>
          </div>
          <div class="profile-section">
            <img src="${!employeeData.profilePicture ? "./assets/images/human-img.png" : `${supabaseUrl}/storage/v1/object/public/${employeeData.profilePicture}` }" alt="Profile Picture" class="profile-pic-modal">
            <h1>${employeeData?.fullName}</h1>
            <p>Employee ID: <span>${employeeData?.employeeId || '—'}</span></p>
            <p>Department  <span>${employeeData?.department}</span></p>
          </div>

          <div class="details">
            <h2>Employee Personal Information:</h2>
            <ul>
                <li><strong>Email:</strong> ${employeeData?.email}</li>
                <li><strong>Joining Date:</strong> ${employeeData?.joiningDate}</li>
            </ul>
          </div>

          <div class="btns">
            <button class="EditBtn"><span><i class="fa-solid fa-pen-to-square"></i></span> Edit Employee</button>
            <button class="deleteBtn"><span><i class="fa-solid fa-trash"></i></span> Delete Employee</button>
          </div>
    </div>`

  // Close modal
  const closeBtn = employeeModal.querySelector('#closeEmployeeModal');
  if (closeBtn) closeBtn.addEventListener('click', () => employeeModal.classList.remove('active'));

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
    if (deptEl) deptEl.value = employeeData?.department ?? '';
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
        status: u.status === 'reviewed' ? 'reviewed' : 'submitted',
        adminComments: Array.isArray(u.adminComments) ? u.adminComments : [],
      };
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

/** workDone only, 1–2 lines (ellipsis via CSS), for table Update column */
function getWorkDonePreview(u) {
  const raw = (u.workDone != null ? String(u.workDone).trim() : '') || '—';
  return escapeHtml(raw);
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
    const workDoneTitle = (u.workDone != null ? String(u.workDone).trim() : '') || '—';

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
        <p class="update-row-preview" title="${escapeHtml(workDoneTitle)}">${getWorkDonePreview(u)}</p>
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
    renderUpdatesList(allUpdatesAggregate);

    const filterEmployee = document.getElementById('filterUpdateEmployee');
    if (filterEmployee) {
      filterEmployee.innerHTML = '<option value="">All Employees</option>';
    data.forEach(({ employeeData: emp }) => {
      if (filterEmployee) filterEmployee.innerHTML += `<option value="${emp.email}">${emp.fullName} (${emp.employeeId || emp.email})</option>`;
    });
    }

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
  const dateFilter = document.getElementById('filterUpdateDate')?.value ?? '';
  const employeeFilter = document.getElementById('filterUpdateEmployee')?.value ?? '';
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
  if (dateInput) dateInput.value = '';
  if (employeeSelect) employeeSelect.value = '';
  try {
    const data = await getEmployeeDataFromDatabase();
    allUpdatesAggregate = aggregateAllUpdates(data);
    currentUpdatesPage = 1;
    renderUpdatesList(allUpdatesAggregate);
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
  const isReviewed = u.status === 'reviewed';
  const statusLabel = isReviewed ? 'Reviewed' : 'Submitted';

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
      <span class="update-status-badge ${isReviewed ? 'reviewed' : 'submitted'}">${statusLabel}</span>
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
      openUpdateDetailModal(dbId, updateId);
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
            status: 'reviewed',
            adminComments: [...existingComments, newComment],
          };
        });

        employeeRecord.employeeData.dailyUpdates = updatedUpdates;

        const updatedAllData = await editEmployeeFromDatabase(employeeRecord.employeeData, employeeRecord.id);
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
      openUpdateDetailModal(dbId, updateId);
    }
  });
}
