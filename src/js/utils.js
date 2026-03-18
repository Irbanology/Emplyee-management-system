
// ————— Centralized error handling —————
const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Returns a user-friendly error message from any thrown value.
 * Handles Supabase errors, Error instances, and unknown objects.
 */
function getErrorMessage(err, fallback = DEFAULT_ERROR_MESSAGE) {
  if (err == null) return fallback;
  if (typeof err === 'string') return err || fallback;
  const msg = err?.message ?? err?.error_description ?? err?.msg ?? err?.error;
  if (typeof msg === 'string' && msg.trim()) return msg.trim();
  return fallback;
}

function escapeToastText(str) {
  if (str == null || typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// CREATE TOAST HERE;
const notifications = document.querySelector('.notifications');
const createToastForNotification = function (type, icon, title, text) {
  if (!notifications) return;
  const safeTitle = escapeToastText(title ?? '');
  const safeText = escapeToastText(text ?? '');
  let newToast = document.createElement('div');
  newToast.innerHTML = `
    <div class="toast ${type}">
      <i class="${icon}"></i>
      <div class="content">
        <div class="title">${safeTitle}</div>
        <span>${safeText}</span>
      </div>
      <i class="fa-solid fa-xmark" aria-label="Close notification" role="button"></i>
    </div>`;
  notifications.appendChild(newToast);
  const closeBtn = newToast.querySelector('.fa-xmark');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (newToast.timeOut) clearTimeout(newToast.timeOut);
      newToast.remove();
    });
  }
  newToast.timeOut = setTimeout(() => newToast.remove(), 5000);
};

// Format date string (YYYY-MM-DD) as "Fri, 27 Feb 2026"
function formatUpdateDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return dateStr || '—';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const day = d.getDate();
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const year = d.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
}

// Short date for compact cards: "Fri, 27 Feb"
function formatUpdateDateShort(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return dateStr || '—';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const day = d.getDate();
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  return `${weekday}, ${day} ${month}`;
}

// GET RELATIVE TIME TO SHOW A TIME...
const getRelativeTime = function (milliseconds) {
    const currentTime = new Date().getTime();

    const minute = Math.floor((currentTime - milliseconds) / 1000 / 60);
    const hour = Math.floor(minute / 60);
    const day = Math.floor(hour / 24);
    
    const hourStr = hour === 1 ? 'hour' : 'hours';
    const dayStr = day === 1 ? 'day' : 'days';
    return minute < 1 ? 'just now' : minute < 60 ? `${minute} min ago` : hour < 24 ? `${hour} ${hourStr} ago` : `${day} ${dayStr} ago`;
};


// CREATE LOADING FUNCTIONS HIDE AND SHOW AND PERFORM LOADING SPINER...
function showSpinner() {
  const el = document.getElementById('spinner');
  if (el) el.style.display = 'flex';
}

function hideSpinner() {
  const el = document.getElementById('spinner');
  if (el) el.style.display = 'none';
}


let loadingTimeout; // Declare a variable for timeout

function showLoading(text) {
  try {
    const safeText = escapeToastText(text ?? 'Loading...');
    const loadingWrapper = document.createElement('div');
    loadingWrapper.classList.add('loading-wrapper');
    loadingWrapper.innerHTML = `<div class="loading-animation" id="loadingAnimation">
      <div class="loading-bar"></div>
      <p>${safeText}</p>
    </div>`;
    if (document.body) document.body.appendChild(loadingWrapper);
    // Fallback: hide after 5s if caller never calls hideLoading (e.g. slow or stuck load)
    loadingTimeout = setTimeout(() => hideLoading(), 5000);
  } catch (err) {
    console.error('showLoading:', err);
  }
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
  formatUpdateDate,
  formatUpdateDateShort,
  showSpinner,
  hideSpinner,
  showLoading,
  hideLoading,
  getErrorMessage,
  DEFAULT_ERROR_MESSAGE,
};