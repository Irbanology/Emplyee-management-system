import { checkUserLoginOrNot, getEmployeeDataFromDatabase, supabaseUrl } from "./db.js";
import { createToastForNotification, formatUpdateDate, getErrorMessage, hideSpinner, showSpinner } from "./utils.js";

const THEME_STORAGE_KEY = "ems_admin_theme";
const UPDATE_STATUS_ORDER = {
  submitted: 0,
  received: 1,
  replied: 2,
  completed: 3,
};

const el = {
  backBtn: document.getElementById("activityBackBtn"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  title: document.getElementById("activityPageTitle"),
  subtitle: document.getElementById("activityPageSubtitle"),
  profilePic: document.getElementById("activityProfilePic"),
  name: document.getElementById("activityEmployeeName"),
  empId: document.getElementById("activityEmployeeId"),
  dept: document.getElementById("activityEmployeeDept"),
  todayStatus: document.getElementById("activityTodayStatus"),
  streakText: document.getElementById("activityStreakText"),
  stats: document.getElementById("activityStats"),
  gridWrap: document.getElementById("activityGridWrap"),
  updatesList: document.getElementById("activityUpdatesList"),
  monthFilter: document.getElementById("activityMonthFilter"),
  search: document.getElementById("activitySearch"),
};

function escapeHtml(text) {
  if (text == null) return "—";
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

function applyTheme(theme) {
  const t = theme === "light" ? "light" : "dark";
  document.body?.setAttribute("data-theme", t);
  if (el.themeToggleBtn) {
    const icon = el.themeToggleBtn.querySelector("i");
    if (icon) icon.className = t === "light" ? "fa-solid fa-sun" : "fa-solid fa-moon";
    el.themeToggleBtn.setAttribute("aria-pressed", t === "light" ? "true" : "false");
  }
}

function initThemeFromUrlOrStorage() {
  const params = new URLSearchParams(window.location.search);
  const qpTheme = params.get("theme");
  if (qpTheme === "light" || qpTheme === "dark") {
    applyTheme(qpTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, qpTheme);
    } catch (_) {}
    return;
  }
  let saved = null;
  try {
    saved = localStorage.getItem(THEME_STORAGE_KEY);
  } catch (_) {}
  applyTheme(saved || "dark");
}

function wireThemeToggle() {
  if (!el.themeToggleBtn) return;
  el.themeToggleBtn.addEventListener("click", () => {
    const current = document.body?.getAttribute("data-theme") || "dark";
    const next = current === "light" ? "dark" : "light";
    applyTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch (_) {}
  });
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function toValidDateStr(val) {
  if (!val) return null;
  const s = String(val).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function normalizeUpdateStatus(rawStatus, hasComments = false) {
  const raw = String(rawStatus || "").trim().toLowerCase();
  if (raw in UPDATE_STATUS_ORDER) return raw;
  if (raw === "reviewed") return hasComments ? "replied" : "received";
  return "submitted";
}

function getStatusMeta(status) {
  const normalized = normalizeUpdateStatus(status);
  if (normalized === "received") return { className: "received", label: "Received" };
  if (normalized === "replied") return { className: "replied", label: "Replied" };
  if (normalized === "completed") return { className: "completed", label: "Completed" };
  return { className: "submitted", label: "Submitted" };
}

function normalizeUpdatesArray(employeeData) {
  const raw = employeeData?.dailyUpdates;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((u) => ({
      ...u,
      date: toValidDateStr(u?.date),
      createdAt: typeof u?.createdAt === "number" ? u.createdAt : 0,
      adminComments: Array.isArray(u?.adminComments) ? u.adminComments : [],
    }))
    .map((u) => ({
      ...u,
      status: normalizeUpdateStatus(u.status, u.adminComments.length > 0),
    }))
    .filter((u) => !!u.date)
    .sort((a, b) => {
      const dc = (b.date || "").localeCompare(a.date || "");
      if (dc !== 0) return dc;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
}

function getUniqueSubmittedDates(updates) {
  const set = new Set();
  (Array.isArray(updates) ? updates : []).forEach((u) => {
    if (u?.date) set.add(u.date);
  });
  return set;
}

function addDaysIso(isoDate, days) {
  const d = new Date(isoDate + "T00:00:00");
  if (isNaN(d.getTime())) return isoDate;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getMonthStartIso(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

function countDaysInclusive(startIso, endIso) {
  const a = new Date(startIso + "T00:00:00");
  const b = new Date(endIso + "T00:00:00");
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  const diff = Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff + 1 : 0;
}

function computeCurrentStreak(submittedDatesSet) {
  const today = getTodayStr();
  if (!submittedDatesSet?.has(today)) return 0;
  let streak = 0;
  let cursor = today;
  while (submittedDatesSet.has(cursor)) {
    streak++;
    cursor = addDaysIso(cursor, -1);
    if (streak > 3660) break;
  }
  return streak;
}

function buildContributionGrid({ submittedDatesSet, weeks = 18 }) {
  const totalDays = weeks * 7;
  const endIso = getTodayStr();
  const startIso = addDaysIso(endIso, -(totalDays - 1));
  const cells = [];
  for (let i = 0; i < totalDays; i++) {
    const dayIso = addDaysIso(startIso, i);
    const isActive = submittedDatesSet.has(dayIso);
    const isToday = dayIso === endIso;
    cells.push(
      `<div class="activity-cell${isActive ? " active" : ""}${isToday ? " today" : ""}" title="${escapeHtml(
        formatUpdateDate(dayIso)
      )}${isActive ? " — update submitted" : ""}"></div>`
    );
  }
  return `
    <p class="activity-grid-hint">Recent ${weeks} weeks • Highlighted days indicate submitted updates</p>
    <div class="activity-grid" aria-label="Recent activity grid">${cells.join("")}</div>
  `;
}

function buildStatCards({ totalUpdates, updatesThisMonth, missedDaysThisMonth, streak }) {
  return `
    <div class="activity-stat-card">
      <p class="stat-label">Total updates</p>
      <p class="stat-value">${escapeHtml(String(totalUpdates))}</p>
    </div>
    <div class="activity-stat-card">
      <p class="stat-label">This month</p>
      <p class="stat-value">${escapeHtml(String(updatesThisMonth))}</p>
    </div>
    <div class="activity-stat-card">
      <p class="stat-label">Missed days</p>
      <p class="stat-value">${escapeHtml(String(missedDaysThisMonth))}</p>
    </div>
    <div class="activity-stat-card">
      <p class="stat-label">Current streak</p>
      <p class="stat-value">${escapeHtml(String(streak))} <span class="stat-suffix">day${streak === 1 ? "" : "s"}</span></p>
    </div>
  `;
}

function getUpdatePreviewRaw(u) {
  if (u?.updateText != null && String(u.updateText).trim() !== "") return String(u.updateText).trim();
  const done = (u?.workDone || "").trim() || "—";
  const next = (u?.workPlanned || "").trim() || "—";
  const blockers = (u?.blockers || "").trim();
  return blockers ? `Completed: ${done}\nNext: ${next}\nBlockers: ${blockers}` : `Completed: ${done}\nNext: ${next}`;
}

function monthKeyFromIso(iso) {
  if (!iso || typeof iso !== "string") return null;
  const m = iso.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}`; // YYYY-MM
}

function monthLabelFromKey(key) {
  const m = String(key || "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return "—";
  const d = new Date(`${m[1]}-${m[2]}-01T00:00:00`);
  if (isNaN(d.getTime())) return key;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function renderMonthOptions(updates) {
  if (!el.monthFilter) return;
  const keys = new Set();
  updates.forEach((u) => {
    const k = monthKeyFromIso(u.date);
    if (k) keys.add(k);
  });
  const list = Array.from(keys).sort((a, b) => b.localeCompare(a));
  el.monthFilter.innerHTML = `<option value="">All months</option>` + list.map((k) => `<option value="${k}">${escapeHtml(monthLabelFromKey(k))}</option>`).join("");
}

function renderUpdatesList(updates) {
  if (!el.updatesList) return;
  if (!updates.length) {
    el.updatesList.innerHTML = `<div class="activity-empty">No updates match your filters.</div>`;
    return;
  }
  el.updatesList.innerHTML = updates
    .map((u) => {
      const statusMeta = getStatusMeta(u.status);
      const safePreview = escapeHtml(getUpdatePreviewRaw(u));
      return `
        <div class="activity-update-item">
          <div class="activity-update-top">
            <span class="activity-update-date">${escapeHtml(formatUpdateDate(u.date))}</span>
            <span class="activity-update-status ${statusMeta.className}">${statusMeta.label}</span>
          </div>
          <div class="activity-update-body">
            <div class="activity-update-field">
              <p class="activity-update-field-label">Update</p>
              <p class="activity-update-field-text">${safePreview}</p>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function makeSearchableText(u) {
  const fields = [
    u?.date,
    u?.status,
    u?.updateText,
    u?.workDone,
    u?.workPlanned,
    u?.blockers,
    ...(Array.isArray(u?.adminComments) ? u.adminComments.map((c) => c?.commentText) : []),
  ];
  return fields
    .filter((x) => x != null)
    .map((x) => String(x))
    .join("\n")
    .toLowerCase();
}

function applyFiltersAndRender({ allUpdates }) {
  const q = (el.search?.value || "").trim().toLowerCase();
  const monthKey = el.monthFilter?.value || "";

  let filtered = allUpdates;
  if (monthKey) {
    filtered = filtered.filter((u) => monthKeyFromIso(u.date) === monthKey);
  }
  if (q) {
    filtered = filtered.filter((u) => makeSearchableText(u).includes(q));
  }
  renderUpdatesList(filtered);
}

async function sessionCheck() {
  try {
    const session = await checkUserLoginOrNot();
    if (!session) {
      window.location.href = "./index.html";
      return false;
    }
    return true;
  } catch (_) {
    window.location.href = "./index.html";
    return false;
  }
}

async function loadActivity() {
  showSpinner();
  try {
    const ok = await sessionCheck();
    if (!ok) return;

    const params = new URLSearchParams(window.location.search);
    const rowId = params.get("id");
    if (!rowId) {
      createToastForNotification("error", "fa-solid fa-circle-exclamation", "Error", "Missing employee id.");
      return;
    }

    const all = await getEmployeeDataFromDatabase();
    const rec = (Array.isArray(all) ? all : []).find((r) => String(r.id) === String(rowId));
    if (!rec?.employeeData) {
      createToastForNotification("error", "fa-solid fa-circle-exclamation", "Error", "Employee not found.");
      return;
    }

    const emp = rec.employeeData;
    const updates = normalizeUpdatesArray(emp);
    const submittedDates = getUniqueSubmittedDates(updates);
    const todayIso = getTodayStr();
    const isActiveToday = submittedDates.has(todayIso);
    const streak = computeCurrentStreak(submittedDates);

    const totalUpdates = updates.length;
    const monthStartIso = getMonthStartIso(new Date());
    const updatesThisMonth = updates.filter((u) => u.date >= monthStartIso && u.date <= todayIso).length;
    const daysSoFarThisMonth = countDaysInclusive(monthStartIso, todayIso);
    let submittedDaysThisMonth = 0;
    for (const d of submittedDates) if (d >= monthStartIso && d <= todayIso) submittedDaysThisMonth++;
    const missedDaysThisMonth = Math.max(0, daysSoFarThisMonth - submittedDaysThisMonth);

    const safeName = escapeHtml(emp.fullName || "—");
    const safeEmpId = escapeHtml(emp.employeeId || "—");
    const safeDept = escapeHtml(emp.department || "—");
    const imgSrc = !emp.profilePicture ? "./assets/images/human-img.png" : `${supabaseUrl}/storage/v1/object/public/${emp.profilePicture}`;

    if (el.profilePic) el.profilePic.src = imgSrc;
    if (el.name) el.name.textContent = emp.fullName || "—";
    if (el.empId) el.empId.textContent = `ID: ${emp.employeeId || "—"}`;
    if (el.dept) el.dept.textContent = `Department: ${emp.department || "—"}`;
    if (el.title) el.title.textContent = `Activity • ${emp.fullName || "Employee"}`;
    if (el.subtitle) el.subtitle.textContent = `${emp.employeeId || emp.email || ""}`.trim() || "All updates and insights";

    if (el.todayStatus) {
      el.todayStatus.className = `activity-status ${isActiveToday ? "active" : "missed"}`;
      el.todayStatus.innerHTML = `<i class="fa-solid ${isActiveToday ? "fa-circle-check" : "fa-circle-xmark"}"></i> ${
        isActiveToday ? "Active Today" : "Missed Today"
      }`;
    }

    if (el.streakText) el.streakText.textContent = `Current Streak: ${streak} day${streak === 1 ? "" : "s"}`;
    if (el.stats) el.stats.innerHTML = buildStatCards({ totalUpdates, updatesThisMonth, missedDaysThisMonth, streak });

    if (el.gridWrap) {
      el.gridWrap.innerHTML = buildContributionGrid({ submittedDatesSet: submittedDates, weeks: 18 });
    }

    renderMonthOptions(updates);
    renderUpdatesList(updates);

    if (el.search) {
      el.search.addEventListener("input", () => applyFiltersAndRender({ allUpdates: updates }));
    }
    if (el.monthFilter) {
      el.monthFilter.addEventListener("change", () => applyFiltersAndRender({ allUpdates: updates }));
    }

    // Accessibility-friendly document title
    document.title = `Activity • ${emp.fullName || "Employee"}`;

    // Ensure header chips show safe text (already textContent), keep escaped versions if needed elsewhere
    void safeName;
    void safeEmpId;
    void safeDept;
  } catch (err) {
    console.error("employee-activity load:", err);
    createToastForNotification("error", "fa-solid fa-circle-exclamation", "Error", getErrorMessage(err, "Could not load activity."));
  } finally {
    hideSpinner();
  }
}

function wireBackButton() {
  if (!el.backBtn) return;
  el.backBtn.addEventListener("click", () => {
    window.location.href = "./admin.html";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initThemeFromUrlOrStorage();
  wireThemeToggle();
  wireBackButton();
  loadActivity().catch(() => {});
});

