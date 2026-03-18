import { getEmployeeDataFromDatabase } from "./db.js";
import { createToastForNotification, getErrorMessage } from "./utils.js";

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

function normalizeDepartment(raw) {
  if (raw == null) return '';
  const v = String(raw).trim();
  if (!v) return '';
  return LEGACY_DEPARTMENT_MAP[v] || v;
}

const validateForm = async function (form, editId) {
  if (!form?.elements) return false;
  try {
  const elements = form.elements;
  let isValid = true;

  for (let element of elements) {
    // Skip validation for buttons and non-required fields
    if (element.type === "submit" || element.type === "button") {
      continue;
    }

    // Check if the field is empty
    if (!element.value.trim()) {
      isValid = false;
      createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', `${element.name} ${element.name === 'department' ? 'selection' : '' } is required.`);
    }

    // Department must be one of the predefined values
    if (element.name === 'department' && element.value.trim()) {
      const normalized = normalizeDepartment(element.value);
      if (!ALLOWED_DEPARTMENTS.includes(normalized)) {
        isValid = false;
        createToastForNotification(
          'error',
          'fa-solid fa-circle-exclamation',
          'Error',
          `Invalid department. Please choose one of: ${ALLOWED_DEPARTMENTS.join(', ')}.`
        );
      }
    }

    // Additional validations (e.g., email format)
    if (element.type === "email" && element.value.trim()) {
      if (!isValidEmail(element.value)) {
        isValid = false;
        createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', "Invalid email address.");
       
      }

      if (!editId) {
        const isEMailSomeORnot = await isEmailSome(element.value)  
  
        if(isEMailSomeORnot) {
          isValid = false;
          createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', "Email already exists try another email.");
        }
      }

    }

    if (element.name === "password" && element.value.trim()) {
      if (!isValidPassword(element.value)) {
        isValid = false;
        createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', "Password must be at least 8 characters long.");
      }
    }

    if (element.name === "employeeId" && element.value.trim()) {
      if (!editId) {
        const taken = await isEmployeeIdTaken(element.value.trim());
        if (taken) {
          isValid = false;
          createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', "Employee ID already exists. Use a unique ID.");
        }
      }
    }

    // Joining date: year must be exactly 4 digits (1000–9999)
    if (element.name === "joiningDate" && element.value.trim()) {
      const dateVal = element.value.trim();
      const match = dateVal.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) {
        isValid = false;
        createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', "Joining date must be a valid date with a 4-digit year (e.g. 2025).");
      } else {
        const year = parseInt(match[1], 10);
        if (year < 1000 || year > 9999) {
          isValid = false;
          createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', "Joining date year must be exactly 4 digits (e.g. 2025).");
        }
      }
    }
  }

  // Employee ID is required (for new employees and edit)
  const employeeIdEl = form.querySelector('[name="employeeId"]');
  if (employeeIdEl && !employeeIdEl.value.trim()) {
    isValid = false;
    createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', "Employee ID is required.");
  }

  

  if (isValid) {
    saveFormData(form);
  }
  return isValid;
  } catch (err) {
    console.error('validateForm:', err);
    createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', getErrorMessage(err, 'Validation failed. Please try again.'));
    return false;
  }
}


// Helper function for email validation
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Password validation function
function isValidPassword(password) {
  return password.length >= 8; // Password must be at least 8 characters long
}

// checkEMail is not same...
async function isEmailSome(email) {
  try {
    const data = await getEmployeeDataFromDatabase();
    const isEMailSomeCheck = (Array.isArray(data) ? data : []).find(
      ({ employeeData }) => employeeData?.email === email
    );
    return typeof isEMailSomeCheck === 'object' && isEMailSomeCheck != null;
  } catch (err) {
    console.error('isEmailSome:', err);
    return false;
  }
}

// Check if employee ID is already used
async function isEmployeeIdTaken(employeeId) {
  try {
    const data = await getEmployeeDataFromDatabase();
    const found = (Array.isArray(data) ? data : []).find(
      ({ employeeData }) => employeeData?.employeeId === employeeId
    );
    return !!found;
  } catch (err) {
    console.error('isEmployeeIdTaken:', err);
    return false;
  }
}

// Validate daily work update form (single updateText field)
function validateDailyUpdateForm(updateText) {
  if (!updateText || !updateText.trim()) {
    createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', "Today's update is required.");
    return false;
  }
  return true;
}

// Save form data into the global object
const employeeData = {}
function saveFormData(form) {

  const formData = new FormData(form);

  // Populate the global employeeData object
  formData.forEach((value, key) => {
    employeeData[key] = value.trim();
  });

  // Normalize department to standardized values
  employeeData.department = normalizeDepartment(employeeData.department);

  // Add additional processing if needed
  employeeData.createdAt = new Date().getTime();
  employeeData.profilePicture = null;
  employeeData.dailyUpdates = [];
}




export {
  validateForm,
  employeeData,
  validateDailyUpdateForm,
}