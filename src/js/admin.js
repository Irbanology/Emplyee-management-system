import { validateForm, employeeData } from "./validate.js";
import { createToastForNotification, formatUpdateDate, getRelativeTime, hideSpinner, showLoading, showSpinner } from "./utils.js";
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
  const session = await checkUserLoginOrNot();
  if (!session) {
    window.location.href = './index.html';
  }
};

sessionCheckForAdmin();
showLoading("Loading Admin Panel...");


logoutBtn.addEventListener("click", async () => {
  showSpinner();
  await logout()
  sessionCheckForAdmin();
  hideSpinner();
});

// Toggle Sidebar
toggleSidebar.addEventListener('click', () => {
  sidebar.classList.toggle('active');
});

// Toggle Sidebar with close button
closeSidebar.addEventListener('click', () => {
  sidebar.classList.remove('active');
});

// Handle active role (including Daily Updates tab)
const employeeListSection = document.getElementById('employeeListSection');
const dailyUpdatesSection = document.getElementById('dailyUpdatesSection');
const employeeBtns = document.getElementById('employeeBtns');

roles.forEach(role => {
  role.addEventListener('click', async (e) => {
    roles.forEach(r => r.classList.remove('active'));
    role.classList.add('active');
    sidebar.classList.remove('active');

    const section = role.getAttribute('data-section');
    if (section === 'daily-updates') {
      employeeListSection.style.display = 'none';
      employeeBtns.style.display = 'none';
      dailyUpdatesSection.style.display = 'block';
      loadDailyUpdatesView();
      return;
    }

    employeeListSection.style.display = 'block';
    employeeBtns.style.display = 'flex';
    dailyUpdatesSection.style.display = 'none';

    const roleEl = e.target.closest('.role');
    const department = roleEl?.getAttribute('data-department') ?? roleEl?.textContent?.trim() ?? '';
    const employeesdata = await getEmployeeDataFromDatabase();

    if (department === '' || department === 'All Employees') {
      showEmployeeCard(employeesdata);
    } else {
      const departmentEmployeeData = employeesdata.filter((el) => el.employeeData.department === department);
      showEmployeeCard(departmentEmployeeData);
    }
  });
});

document.addEventListener("DOMContentLoaded", () => {
   const roles = document.querySelector('.role');
   roles.click();
})


// Open modal
openModal.addEventListener("click", () => {
  modal.classList.add('active');
});

// Close modal
closeModal.addEventListener("click", () => {
  modal.classList.remove('active');
  form.querySelector('.btn-green').innerHTML = '<span><i class="fa-solid fa-user-plus"></i></span> Add Employee';
  document.querySelector('#email').removeAttribute('readonly');
  document.querySelector('#password').removeAttribute('readonly');
  form.removeAttribute('data-edit-id');
  const employeeIdInput = document.querySelector('#employeeId');
  if (employeeIdInput) employeeIdInput.removeAttribute('readonly');
  form.reset();
});

// Single window click handler: close modals only when clicking overlay (not content)
window.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.classList.remove('active');
    form.querySelector('.btn-green').textContent = 'Add Employee';
    form.removeAttribute('data-edit-id');
    form.reset();
  } else if (e.target === employeeModal) {
    employeeModal.classList.remove('active');
  }
});


// FORM SUBMITION OR VALIDATION STARTED HERE....
form.addEventListener("submit", async function (event) {
  event.preventDefault();
  
  const form = event.target;
  const editId = form.getAttribute('data-edit-id');
  const roles = document.querySelector('.role');

  // Call reusable validation function
  const isValid = await validateForm(form, editId);
  
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
      roles.classList.add('active');
      roles.click();
      modal.classList.remove('active');
      document.querySelector('#email').removeAttribute('readonly');
      document.querySelector('#password').removeAttribute('readonly');
      form.querySelector('.btn-green').innerHTML = '<span><i class="fa-solid fa-user-plus"></i></span> Add Employee';
      form.removeAttribute('data-edit-id');
      createToastForNotification('success', 'fa-solid fa-circle-check', 'Success', "Employee updated successfully!");
      form.reset();
    } catch (err) {
      console.error("Employee update failed:", err);
      createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', err?.message || "Update failed. Check console.");
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
      roles.classList.add('active');
      roles.click();
      form.reset();
      modal.classList.remove('active');
      createToastForNotification('success', 'fa-solid fa-circle-check', 'Success', "Employee created successfully!");
    } catch (err) {
      createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', err?.message || "Failed to create employee.");
    } finally {
      hideSpinner();
    }
  }
});


// SHOW EMPLOYEE CARD IN HTML. THAT FUNCTIONALITY STARTED HERE...
const employeeContainer = document.querySelector('.employee-list-card-container');
const showEmployeeCard = (employeeData) => {
  
  employeeContainer.innerHTML = '';
  if (employeeData.length === 0) {
    
    employeeContainer.innerHTML = `<div class="empty-employee">
            <span><i class="fa-solid fa-users-slash"></i></span>
            <h3>No employee has been created so far.</h3>
          </div>`
    employeeContainer.querySelector('.empty-employee').classList.add('active')
  }
  
  employeeData.forEach(({ id, employeeData }) => {
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
  const detailData = await getEmployeeDataFromDatabase();
  const detailEmployeeDataForModel = detailData?.find((employee) => String(employee.id) === String(employeeId));

  if (!detailEmployeeDataForModel) {
    createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', 'Employee not found. The list may be outdated.');
    return;
  }

  showDataInEmployeeDetailModel(detailEmployeeDataForModel);
  employeeModal.classList.add('active');
};

// Show detail modal for the opened employee only; id is the table row id used for edit/delete
const showDataInEmployeeDetailModel = ({ id, employeeData }) => {
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
  employeeModal.querySelector('#closeEmployeeModal').addEventListener("click", () => {
    employeeModal.classList.remove('active');
  });

  // DELETE EMPLOYEE FROM UI AND DATABASE (uses opened employee only)
  employeeModal.querySelector('.deleteBtn').addEventListener("click", async () => {
    showSpinner();
    const roles = document.querySelector('.role');
    try {
      const error = await deleteDataFromDatabase(openedEmployeeRowId);
      if (error) {
        hideSpinner();
        createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', error?.message || "Could not delete employee.");
        return;
      }
      const data = await getEmployeeDataFromDatabase();
      showEmployeeCard(data);
      employeeModal.classList.remove('active');
      roles.classList.add('active');
      roles.click();
      createToastForNotification('success', 'fa-solid fa-circle-check', 'Success', "Employee deleted successfully.");
    } catch (err) {
      createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', err?.message || "An error occurred while deleting.");
    } finally {
      hideSpinner();
    }
  });

  // EDIT EMPLOYEE — apply to the currently opened employee only
  employeeModal.querySelector('.EditBtn').addEventListener("click", () => {
    form.querySelector('.btn-green').innerHTML = '<span><i class="fa-solid fa-pen-to-square"></i></span> Update Employee';

    employeeModal.classList.remove('active');
    modal.classList.add("active");

    document.querySelector('#fullName').value = employeeData.fullName;
    const employeeIdInput = document.querySelector('#employeeId');
    if (employeeIdInput) {
      employeeIdInput.value = employeeData.employeeId || '';
      employeeIdInput.setAttribute('readonly', '');
    }
    document.querySelector('#email').value = employeeData.email;
    document.querySelector('#email').setAttribute('readonly', '');
    document.querySelector('#password').value = employeeData.password;
    document.querySelector('#password').setAttribute('readonly', '');
    document.querySelector('#joiningDate').value = employeeData.joiningDate;
    document.querySelector('#department').value = employeeData.department;
    document.querySelector('#description').value = employeeData.description;

    form.setAttribute('data-edit-id', openedEmployeeRowId);
  });
};

// ————— Daily Updates (admin) —————
let allUpdatesAggregate = [];

function aggregateAllUpdates(employeesData) {
  const list = [];
  employeesData.forEach(({ id, employeeData: emp }) => {
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

function renderUpdatesList(updates) {
  const container = document.getElementById('updatesListContainer');
  container.innerHTML = '';
  if (!updates.length) {
    container.innerHTML = '<div class="empty-employee" id="noUpdatesPlaceholder"><span><i class="fa-solid fa-clipboard-list"></i></span><h3>No daily updates match the filters.</h3></div>';
    return;
  }
  updates.forEach((u) => {
    const card = document.createElement('div');
    card.className = 'update-card';
    card.setAttribute('data-db-id', u.dbId);
    card.setAttribute('data-update-id', u.updateId);

    const isReviewed = u.status === 'reviewed';
    const statusLabel = isReviewed ? 'Reviewed' : 'Submitted';
    const statusStyles = isReviewed
      ? 'background-color:#d1fae5;color:#047857;'
      : 'background-color:#fee2e2;color:#b91c1c;';

    const comments = Array.isArray(u.adminComments) ? u.adminComments : [];

    card.innerHTML = `
      <div class="update-card-header">
        <span class="update-employee-name">${escapeHtml(u.employeeName)}</span>
        <span class="update-employee-id">${escapeHtml(u.employeeId)}</span>
        <span class="update-date">${escapeHtml(formatUpdateDate(u.date))}</span>
        <span class="update-status" style="margin-left:auto;padding:2px 10px;border-radius:999px;font-size:12px;${statusStyles}">${statusLabel}</span>
      </div>
      <div class="update-card-body">
        ${buildUpdateField('Work Done', u.workDone, 'workDone')}
        ${buildUpdateField('Work Planned', u.workPlanned, 'workPlanned')}
        ${buildUpdateField('Blockers', u.blockers, 'blockers')}
      </div>
      <div class="update-card-comments">
        <h4>Admin Comments</h4>
        <div class="comments-list">
          ${
            comments.length
              ? comments
                  .map(
                    (c) => `
            <div class="comment-item" data-comment-id="${c.commentId}">
              <span class="comment-text">${escapeHtml(c.commentText || '')}</span>
            </div>`
                  )
                  .join('')
              : '<p class="no-comments">No comments yet.</p>'
          }
        </div>
        <button type="button" class="btn-green add-comment-btn"><span><i class="fa-solid fa-comment-dots"></i></span> Add Comment</button>
        <div class="add-comment-form" style="display: none; margin-top: 8px;">
          <textarea class="admin-comment-input" rows="2" placeholder="Add your comment..."></textarea>
          <button type="button" class="btn-green submit-comment-btn" style="margin-top: 4px;"><span><i class="fa-solid fa-paper-plane"></i></span> Submit Comment</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function escapeHtml(text) {
  if (text == null) return '—';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderNotSubmittedToday(employeesData) {
  const today = new Date().toISOString().slice(0, 10);
  const submitted = new Set();
  employeesData.forEach(({ employeeData: emp }) => {
    const updates = Array.isArray(emp.dailyUpdates) ? emp.dailyUpdates : [];
    const hasToday = updates.some((u) => u.date === today);
    if (hasToday) submitted.add(emp.email);
  });
  const notSubmitted = employeesData.filter((e) => !submitted.has(e.employeeData.email));
  const el = document.getElementById('updatesNotSubmitted');
  if (notSubmitted.length === 0) {
    el.innerHTML = '<p class="updates-status submitted-all">All employees have submitted for today.</p>';
    return;
  }
  el.innerHTML = '<p class="updates-status pending-label">Not submitted today:</p><ul class="pending-list">' +
    notSubmitted.map((e) => `<li>${escapeHtml(e.employeeData.fullName)} (${escapeHtml(e.employeeData.employeeId || e.employeeData.email)})</li>`).join('') + '</ul>';
}

async function loadDailyUpdatesView() {
  showSpinner();
  const data = await getEmployeeDataFromDatabase();
  allUpdatesAggregate = aggregateAllUpdates(data);
  renderUpdatesList(allUpdatesAggregate);

  const filterEmployee = document.getElementById('filterUpdateEmployee');
  filterEmployee.innerHTML = '<option value="">All Employees</option>';
  data.forEach(({ employeeData: emp }) => {
    filterEmployee.innerHTML += `<option value="${emp.email}">${emp.fullName} (${emp.employeeId || emp.email})</option>`;
  });

  renderNotSubmittedToday(data);
  hideSpinner();
}

document.getElementById('applyUpdateFilters').addEventListener('click', () => {
  const dateFilter = document.getElementById('filterUpdateDate').value;
  const employeeFilter = document.getElementById('filterUpdateEmployee').value;
  let filtered = allUpdatesAggregate.filter((u) => {
    if (dateFilter && u.date !== dateFilter) return false;
    if (employeeFilter && u.employeeEmail !== employeeFilter) return false;
    return true;
  });
  renderUpdatesList(filtered);
});

document.getElementById('clearUpdateFilters').addEventListener('click', async () => {
  document.getElementById('filterUpdateDate').value = '';
  document.getElementById('filterUpdateEmployee').value = '';
  const data = await getEmployeeDataFromDatabase();
  allUpdatesAggregate = aggregateAllUpdates(data);
  renderUpdatesList(allUpdatesAggregate);
  renderNotSubmittedToday(data);
});

// Event delegation for admin comments
const updatesListContainerEl = document.getElementById('updatesListContainer');

if (updatesListContainerEl) {
  updatesListContainerEl.addEventListener('click', async (e) => {
    const target = e.target;

    const card = target.closest('.update-card');
    if (!card) return;

    // Toggle "Add Comment" form visibility
    const addCommentBtn = target.closest('.add-comment-btn');
    if (addCommentBtn) {
      const form = card.querySelector('.add-comment-form');
      if (!form) return;
      const isHidden = form.style.display === 'none' || !form.style.display;
      form.style.display = isHidden ? 'block' : 'none';
      if (isHidden) {
        const textarea = form.querySelector('.admin-comment-input');
        if (textarea) textarea.focus();
      }
      return;
    }

    // Submit admin comment
    const submitCommentBtn = target.closest('.submit-comment-btn');
    if (submitCommentBtn) {
      const form = card.querySelector('.add-comment-form');
      if (!form) return;
      const textarea = form.querySelector('.admin-comment-input');
      if (!textarea) return;
      const commentText = textarea.value.trim();
      if (!commentText) {
        createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', 'Comment cannot be empty.');
        return;
      }

      const dbId = card.getAttribute('data-db-id');
      const updateId = card.getAttribute('data-update-id');
      if (!dbId || !updateId) {
        createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', 'Could not identify this update record.');
        return;
      }

      showSpinner();
      try {
        const employees = await getEmployeeDataFromDatabase();
        const employeeRecord = employees.find((e) => String(e.id) === String(dbId));
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

        const dateFilter = document.getElementById('filterUpdateDate').value;
        const employeeFilter = document.getElementById('filterUpdateEmployee').value;
        const filtered = allUpdatesAggregate.filter((u) => {
          if (dateFilter && u.date !== dateFilter) return false;
          if (employeeFilter && u.employeeEmail !== employeeFilter) return false;
          return true;
        });

        renderUpdatesList(filtered);
        renderNotSubmittedToday(updatedAllData);

        textarea.value = '';
        form.style.display = 'none';

        createToastForNotification('success', 'fa-solid fa-circle-check', 'Success', 'Comment added successfully.');
      } catch (err) {
        createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', err?.message || 'Failed to add comment.');
      } finally {
        hideSpinner();
      }
    }
  });
}
