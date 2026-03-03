import { getEmployeeDataFromDatabase } from "./db.js";
import { createToastForNotification, getErrorMessage } from "./utils.js";

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