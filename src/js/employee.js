// IMPORT ALL MODULES...
import { getCurrentUser, getEmployeeDataFromDatabase, editEmployeeFromDatabase, updateProfileData, supabaseUrl, logout, checkUserLoginOrNot } from "./db.js";
import { createToastForNotification, hideSpinner, showSpinner, showLoading } from "./utils.js";
import { validateDailyUpdateForm } from "./validate.js";


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
const dailyUpdateStatus = document.getElementById('dailyUpdateStatus');
const submitDailyUpdateBtn = document.getElementById('submitDailyUpdateBtn');


// CHECK ADMIN AUTHHENTICATED OR NOT...
const sessionCheckForEmployee = async () => {
  const session = await checkUserLoginOrNot();
  if (!session) {
    window.location.href = './index.html';
  }
};

sessionCheckForEmployee();
showLoading("Loading Profile...")


logoutBtn.addEventListener("click", async () => {
  showSpinner();
  await logout()
  sessionCheckForEmployee();
  hideSpinner();
});


// ADD LISTNER TO OPEN EDIT PROFILE MODEL...
editProfileBtn.addEventListener("click", () => {
    model.classList.add("active");
});


// remove LISTNER FOR CLOSE EDIT PROFILE MODEL...
cancelBtn.addEventListener("click", () => {
    model.classList.remove("active");
    previewFile.value = '';
    previewImg.src = '';
    previewImg.style.display = 'none';
    closeImg.style.display = 'none';
    
});


// Ensure employeeData has dailyUpdates array (for existing records)
function ensureDailyUpdates(empRecord) {
  if (!empRecord?.employeeData) return empRecord;
  if (!Array.isArray(empRecord.employeeData.dailyUpdates)) {
    empRecord.employeeData.dailyUpdates = [];
  }
  return empRecord;
}

// SHOW USER DATA OVER THE EMPLOYEE PAGE...
let currentEmployeeDataRef = null;
const showUserData = async () => {
  const User = await getCurrentUser();
  const allEmployeeData = await getEmployeeDataFromDatabase();
  let currentEmployeeData = allEmployeeData.filter(({ employeeData }) => employeeData.email === User.email);
  if (currentEmployeeData.length) {
    currentEmployeeData[0] = ensureDailyUpdates(currentEmployeeData[0]);
  }
  currentEmployeeDataRef = currentEmployeeData;

  showCurrentDataInPage(currentEmployeeData);
  updateDailyUpdateUI(currentEmployeeData);
};

showUserData();

// FUNCTION TO SHOW CURRENT DATA OVER THE PAGE...
const showCurrentDataInPage = (employeeData) => {
    const data = employeeData[0]?.employeeData

    document.querySelector('.profile-photo img').src = `${!data.profilePicture ? './assets/images/human-img.png' : `${supabaseUrl}/storage/v1/object/public/${data.profilePicture}` }`;

    document.querySelector('.employee-name').textContent = data?.fullName;
    document.querySelector('.IT').textContent = data?.department;

    document.querySelector('#fullname').value = data?.fullName
    document.querySelector('#fullname').setAttribute('data-employeeid', employeeData[0]?.id);

    document.querySelector(".fullName").textContent = data?.fullName;
    document.querySelector(".email").innerHTML = data?.email;
    document.querySelector(".joining-date").innerHTML = data?.joiningDate;
    document.querySelector(".desc").innerHTML = data?.description;
}

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

// PREVIEW IMG CODE FOR SHOW EMPLOYEE PROFILE IMG PREVIEW...
previewFile.addEventListener("change", (event) => {
  const files = event.target.files[0]
  const localUrl = URL.createObjectURL(files)
  previewImg.src = localUrl;
  previewImg.style.display = 'block';
  closeImg.style.display = 'block';
  
});

// DELETE THE IMAGE AND FILE IN PREVIEW WITH THE HELP OF CLOSE BTN...
closeImg.addEventListener('click', (event) => {
  event.stopImmediatePropagation(); 
  event.preventDefault();
  previewFile.value = '';
  previewImg.src = '';
  previewImg.style.display = 'none';
  closeImg.style.display = 'none';
});


// ADD LISTENER TO SUBMIT PROFILE FORM....
profileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  let fullName = null;
  let profilePictureName = null;
  let employeId = null;

  for (const element of form.elements) {
    if (element.type == 'submit' || element.type === 'button') {
      continue
    }

    if (element.type === 'text') {
      if(!element.value.trim()) {
        createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', "Full name is required.");
      }else {
        fullName = element.value;
        employeId = element.dataset.employeeid;
      }
    }

    if (element.type === 'file') {
      if (element.files.length !== 0) {
        
        profilePictureName = element.files[0];
        
      }
      
      
    }
    
  }

  showSpinner()
  const {findEmployee, errors} = await updateProfileData(fullName, profilePictureName, employeId);



  if (!errors) {
    currentEmployeeDataRef = [findEmployee];
    showCurrentDataInPage([findEmployee]);
    model.classList.remove("active");
    previewFile.value = '';
    previewImg.src = '';
    previewImg.style.display = 'none';
    closeImg.style.display = 'none';
    hideSpinner();
    createToastForNotification('success', 'fa-solid fa-circle-check', 'Success', "Profile updated successfully!");
  } else {
    model.classList.remove("active");
    previewFile.value = '';
    previewImg.src = '';
    previewImg.style.display = 'none';
    closeImg.style.display = 'none';
    hideSpinner()
    createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', `${errors.message}!`);

  }
});

// ————— Daily Work Update —————
if (dailyUpdateForm) {
  dailyUpdateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const workDone = dailyUpdateForm.querySelector('#workDoneToday').value.trim();
    const workPlanned = dailyUpdateForm.querySelector('#workPlannedNext').value.trim();
    const blockers = dailyUpdateForm.querySelector('#blockers').value.trim();

    if (!validateDailyUpdateForm(workDone, workPlanned, blockers)) return;
    if (!currentEmployeeDataRef?.length) {
      createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', 'Employee data not loaded.');
      return;
    }

    const today = getTodayStr();
    if (hasSubmittedToday(currentEmployeeDataRef)) {
      createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', 'You can only submit one update per day.');
      return;
    }

    const updateEntry = {
      updateId: Date.now().toString(),
      date: today,
      workDone,
      workPlanned,
      blockers,
      createdAt: Date.now(),
      status: 'submitted',
    };

    const record = currentEmployeeDataRef[0];
    record.employeeData.dailyUpdates = record.employeeData.dailyUpdates || [];
    record.employeeData.dailyUpdates.push(updateEntry);

    showSpinner();
    try {
      await editEmployeeFromDatabase(record.employeeData, record.id);
      currentEmployeeDataRef = [{ ...record, employeeData: { ...record.employeeData } }];
      updateDailyUpdateUI(currentEmployeeDataRef);
      dailyUpdateForm.reset();
      createToastForNotification('success', 'fa-solid fa-circle-check', 'Success', 'Daily update submitted successfully!');
    } catch (err) {
      createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', err?.message || 'Failed to submit update.');
    } finally {
      hideSpinner();
    }
  });
}
