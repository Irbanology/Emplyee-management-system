import { loginAdminAndEmployee } from "./db.js";
import { createToastForNotification, getErrorMessage, hideSpinner, showSpinner } from './utils.js';

const container = document.getElementById('container');
const adminBtnToChangeContainer = document.getElementById('register');
const employeeBtnToChangeContainer = document.getElementById('login');
const adminEmail = document.querySelector("#adminEmail");
const adminPassword = document.querySelector("#adminPassword");
const adminBtn = document.querySelector("#adminBtn");
const employeeEmail = document.querySelector("#employeeEmail");
const employeePassword = document.querySelector("#employeePassword");
const employeeBtn = document.querySelector("#employeeBtn");

// FUNCTION TO EMPTY ALL INPUT FIELD
const emptyAllInputField = () => {
  try {
    if (adminEmail) adminEmail.value = '';
    if (adminPassword) adminPassword.value = '';
    if (employeeEmail) employeeEmail.value = '';
    if (employeePassword) employeePassword.value = '';
  } catch (err) {
    console.error('emptyAllInputField:', err);
  }
};

if (adminBtnToChangeContainer && container) {
  adminBtnToChangeContainer.addEventListener('click', () => {
    container.classList.add('active');
    emptyAllInputField();
  });
}
if (employeeBtnToChangeContainer && container) {
  employeeBtnToChangeContainer.addEventListener('click', () => {
    container.classList.remove('active');
    emptyAllInputField();
  });
}


//  ADD LISTENER TO SUBMIT FORM FOR ADMIN...
if (adminBtn) {
  adminBtn.addEventListener("click", async () => {
    if (!adminEmail?.value.trim() || !adminPassword?.value.trim()) {
      createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', "Please fill in email and password.");
      return;
    }
    showSpinner();
    try {
      const { data, error } = await loginAdminAndEmployee(adminEmail.value.trim(), adminPassword.value.trim());
      if (error) {
        createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', getErrorMessage(error, 'Invalid email or password.'));
        return;
      }
      const user = data?.user;
      if (!user?.email) {
        createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', 'Login failed. Please try again.');
        return;
      }
      if (user.email === 'admin@gmail.com') {
        window.location.href = './admin.html';
        return;
      }
      createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', 'Invalid login credentials.');
    } catch (err) {
      console.error('Admin login:', err);
      createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', getErrorMessage(err, 'Login failed. Please try again.'));
    } finally {
      hideSpinner();
      emptyAllInputField();
    }
  });
}


// ADD LISTENER TO SUBMIT FORM FOR EMPLOYEE...
if (employeeBtn) {
  employeeBtn.addEventListener("click", async () => {
    if (!employeeEmail?.value.trim() || !employeePassword?.value.trim()) {
      createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', "Please fill in email and password.");
      return;
    }
    showSpinner();
    try {
      const { data, error } = await loginAdminAndEmployee(employeeEmail.value.trim(), employeePassword.value.trim());
      if (error) {
        createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', getErrorMessage(error, 'Invalid email or password.'));
        return;
      }
      const user = data?.user;
      if (!user?.email) {
        createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', 'Login failed. Please try again.');
        return;
      }
      if (user.email === 'admin@gmail.com') {
        createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', 'Invalid login credentials.');
        return;
      }
      window.location.href = './employee.html';
    } catch (err) {
      console.error('Employee login:', err);
      createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', getErrorMessage(err, 'Login failed. Please try again.'));
    } finally {
      hideSpinner();
      emptyAllInputField();
    }
  });
}










