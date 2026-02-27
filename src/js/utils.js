


// CREATE TOAST HERE;
const notifications = document.querySelector('.notifications');
const createToastForNotification = function (type, icon, title, text){
    let newToast = document.createElement('div');
    newToast.innerHTML = `
        <div class="toast ${type}">
        <i class="${icon}"></i>
        <div class="content">
            <div class="title">${title}</div>
            <span>${text}</span>
            </div>
            <i class="fa-solid fa-xmark" onclick="(this.parentElement).remove()"></i>
        </div>`;
    notifications.appendChild(newToast);
    newToast.timeOut = setTimeout(
        ()=>newToast.remove(), 5000
    )
}

// GET RELATIVE TIME TO SHOW A TIME...
const getRelativeTime = function (milliseconds) {
    const currentTime = new Date().getTime();

    const minute = Math.floor((currentTime - milliseconds) / 1000 / 60);
    const hour = Math.floor(minute / 60);
    const day = Math.floor(hour / 24);
    
    return minute < 1 ? 'just now' : minute < 60 ? `${minute} min ago` : hour  < 24 ? `${hour} hour ago` : `${day} day ago`;
};


// CREATE LOADING FUNCTIONS HIDE AND SHOW AND PERFORM LOADING SPINER...
function showSpinner() {
  document.getElementById('spinner').style.display = 'flex';
}

function hideSpinner() {
  document.getElementById('spinner').style.display = 'none';
}


let loadingTimeout; // Declare a variable for timeout

function showLoading(text) {
  // Create the loading animation dynamically
  const loadingWrapper = document.createElement('div');
  loadingWrapper.classList.add('loading-wrapper')
  loadingWrapper.innerHTML = `<div class="loading-animation" id="loadingAnimation">
      <video src="./assets/videos/loading-video.mp4" muted autoplay loop></video>
      <div class="loading-bar"></div>
        <p>${text}</p>
    </div>`


  // Append the loading animation to the body
  document.body.appendChild(loadingWrapper);

  // Start a timeout to remove the loading element after 3 seconds
  loadingTimeout = setTimeout(() => {
    hideLoading();
  }, 3000);
}

function hideLoading() {
  // Clear the timeout to avoid potential multiple calls
  clearTimeout(loadingTimeout);

  // Remove the loading element from the DOM
  const loadingWrapper = document.querySelector('.loading-wrapper');
  if (loadingWrapper) {
    loadingWrapper.remove();
  }
}






export { 
    createToastForNotification,
    getRelativeTime,
    showSpinner,
    hideSpinner,
    showLoading

}