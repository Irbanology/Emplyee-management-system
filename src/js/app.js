import { loginAdminAndEmployee } from "./db.js";
import { createToastForNotification, hideSpinner, showSpinner } from './utils.js';

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
    adminEmail.value = ''
    adminPassword.value = ''
    employeeEmail.value = ''
    employeePassword.value = ''
}


adminBtnToChangeContainer.addEventListener('click',()=>{
    container.classList.add('active');
    emptyAllInputField()

});

employeeBtnToChangeContainer.addEventListener('click',()=>{
    container.classList.remove('active')
    emptyAllInputField()
})


//  ADD LISTENER TO SUBMIT FORM FOR ADMIN...
adminBtn.addEventListener("click", async () => {

    if (!adminEmail.value.trim() && !adminPassword.value.trim()) {
       createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', "Please fulfill the all required field.");
       return
    }

    if (!adminEmail.value.trim()) {
        createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', "Email is required.");
        return
    }

    if (!adminPassword.value.trim()) {
        createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', "Password is required.");
        return
    }

    showSpinner();
    const { data: { user }, error } = await loginAdminAndEmployee(adminEmail.value, adminPassword.value)
    
    
    if (error) {
        hideSpinner();
        createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', `${error.message}.`);
        return
    }

    if (user.email === 'admin@gmail.com') {
        hideSpinner();
        window.location.href = './admin.html';
    }

    if (user.email !== 'admin@gmail.com') {
        hideSpinner();
        createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', `Invalid login credentials.`);
    }

    hideSpinner();

    emptyAllInputField();
    
});


// ADD LISTENER TO SUBMIT FORM FOR EMPLOYEE...
employeeBtn.addEventListener("click", async () => {
    if (!employeeEmail.value.trim() && !employeePassword.value.trim()) {
       createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', "Please fulfill the all required field.");
       return
    }

    if (!employeeEmail.value.trim()) {
        createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', "Email is required.");
        return
    }

    if (!employeePassword.value.trim()) {
        createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', "Password is required.");
        return
    }

    showSpinner();
    const { data: { user }, error } = await loginAdminAndEmployee(employeeEmail.value, employeePassword.value)
    
    
    if (error) {
        
        hideSpinner();
        createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', `${error.message}.`);
        return
    }

    if (user.email === 'admin@gmail.com') {
        hideSpinner();
        createToastForNotification('error', 'fa-solid fa-circle-exclamation', 'Error', `Invalid login credentials.`);
    }else {
        hideSpinner();
        window.location.href = './employee.html'

    }

    
    hideSpinner();
    emptyAllInputField();
});










