/**
 * app.js
 * ---------------------------------------------------------------------------
 * GPS Navigator V2 — application logic (vanilla ES2023, no framework).
 * Handles: rendering job cards, add/edit/delete flows, status changes,
 * navigation to Google Maps, search & filtering, dark mode, offline caching,
 * and service worker registration.
 * ---------------------------------------------------------------------------
 */

(() => {
  'use strict';

  /* ============================ Constants ============================ */

  const STATUS = {
    PROGRESS: 'กำลังดำเนินการ',
    DONE: 'เสร็จสิ้น',
    CANCELLED: 'ยกเลิก'
  };

  const STATUS_CLASS_MAP = {
    [STATUS.PROGRESS]: 'status-chip--progress',
    [STATUS.DONE]: 'status-chip--done',
    [STATUS.CANCELLED]: 'status-chip--cancelled'
  };

  const THEME_STORAGE_KEY = 'gpsnavi.theme';
  const JOBS_CACHE_KEY = 'gpsnavi.jobsCache';
  const TOAST_DURATION_MS = 3200;

  /* ============================ State ============================ */

  const state = {
    jobs: [],
    searchTerm: '',
    filterWorkType: '',
    filterStatus: '',
    editingId: null,
    pendingDeleteId: null,
    isLoading: true,
    isOnline: navigator.onLine
  };

  /* ============================ DOM references ============================ */

  const dom = {
    cardGrid: document.getElementById('cardGrid'),
    skeletonGrid: document.getElementById('skeletonGrid'),
    emptyState: document.getElementById('emptyState'),
    noResultState: document.getElementById('noResultState'),
    resultCount: document.getElementById('resultCount'),
    searchInput: document.getElementById('searchInput'),
    filterWorkType: document.getElementById('filterWorkType'),
    filterStatus: document.getElementById('filterStatus'),
    refreshBtn: document.getElementById('refreshBtn'),
    fabAddBtn: document.getElementById('fabAddBtn'),
    desktopAddBtn: document.getElementById('desktopAddBtn'),
    emptyAddBtn: document.getElementById('emptyAddBtn'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    iconSun: document.getElementById('iconSun'),
    iconMoon: document.getElementById('iconMoon'),
    connectionBadge: document.getElementById('connectionBadge'),
    offlineBanner: document.getElementById('offlineBanner'),
    toastContainer: document.getElementById('toastContainer'),

    // Job modal
    jobModalOverlay: document.getElementById('jobModalOverlay'),
    jobModalTitle: document.getElementById('jobModalTitle'),
    jobModalCloseBtn: document.getElementById('jobModalCloseBtn'),
    jobForm: document.getElementById('jobForm'),
    jobId: document.getElementById('jobId'),
    workType: document.getElementById('workType'),
    parcelId: document.getElementById('parcelId'),
    requestNo: document.getElementById('requestNo'),
    fullName: document.getElementById('fullName'),
    phone: document.getElementById('phone'),
    lat: document.getElementById('lat'),
    lon: document.getElementById('lon'),
    status: document.getElementById('status'),
    useCurrentLocationBtn: document.getElementById('useCurrentLocationBtn'),
    jobCancelBtn: document.getElementById('jobCancelBtn'),
    jobSaveBtn: document.getElementById('jobSaveBtn'),

    // Confirm modal
    confirmModalOverlay: document.getElementById('confirmModalOverlay'),
    confirmCancelBtn: document.getElementById('confirmCancelBtn'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn')
  };

  /* ============================ Utilities ============================ */

  /**
   * Escapes HTML special characters to prevent injection when interpolating
   * user-provided text into innerHTML.
   * @param {string} value
   * @returns {string}
   */
  function escapeHtml(value) {
    const str = value === null || value === undefined ? '' : String(value);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Debounces a function call by the given delay.
   * @param {Function} fn
   * @param {number} delayMs
   * @returns {Function}
   */
  function debounce(fn, delayMs) {
    let timerId;
    return (...args) => {
      clearTimeout(timerId);
      timerId = setTimeout(() => fn(...args), delayMs);
    };
  }

  /**
   * Formats an ISO date string into a readable Thai-locale date/time.
   * @param {string} isoString
   * @returns {string}
   */
  function formatDate(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    return date.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /**
   * Validates a latitude value is within range.
   * @param {number} value
   * @returns {boolean}
   */
  function isValidLat(value) {
    return Number.isFinite(value) && value >= -90 && value <= 90;
  }

  /**
   * Validates a longitude value is within range.
   * @param {number} value
   * @returns {boolean}
   */
  function isValidLon(value) {
    return Number.isFinite(value) && value >= -180 && value <= 180;
  }

  /**
   * Shows a transient toast notification.
   * @param {string} message
   * @param {'success'|'error'|'info'} type
   */
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    dom.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('is-leaving');
      setTimeout(() => toast.remove(), 200);
    }, TOAST_DURATION_MS);
  }

  /* ============================ Theme (dark mode) ============================ */

  /**
   * Applies the given theme to the document and updates the toggle icon.
   * @param {'light'|'dark'} theme
   */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    dom.iconSun.style.display = theme === 'dark' ? 'none' : 'block';
    dom.iconMoon.style.display = theme === 'dark' ? 'block' : 'none';
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }

  /**
   * Initializes theme from saved preference or OS setting.
   */
  function initTheme() {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved) {
      applyTheme(saved);
      return;
    }
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }

  /**
   * Toggles between light and dark theme.
   */
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  /* ============================ Connectivity ============================ */

  /**
   * Reflects the current online/offline status in the UI.
   */
  function updateConnectionUi() {
    state.isOnline = navigator.onLine;
    dom.connectionBadge.classList.toggle('conn-badge--offline', !state.isOnline);
    dom.connectionBadge.classList.toggle('conn-badge--online', state.isOnline);
    dom.connectionBadge.classList.add('is-visible');
    dom.connectionBadge.querySelector('.conn-badge__text').textContent = state.isOnline ? 'ออนไลน์' : 'ออฟไลน์';
    dom.offlineBanner.hidden = state.isOnline;
  }

  /**
   * Persists the last known job list to localStorage for offline viewing.
   */
  function cacheJobsLocally() {
    try {
      localStorage.setItem(JOBS_CACHE_KEY, JSON.stringify(state.jobs));
    } catch (err) {
      // Storage full or unavailable — non-fatal, offline cache is best-effort.
      console.warn('ไม่สามารถบันทึกแคชข้อมูลได้', err);
    }
  }

  /**
   * Reads the last cached job list from localStorage.
   * @returns {Array<Object>}
   */
  function readCachedJobs() {
    try {
      const raw = localStorage.getItem(JOBS_CACHE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      return [];
    }
  }

  /* ============================ Data loading ============================ */

  /**
   * Loads jobs from the backend, falling back to the local cache if the
   * network request fails (e.g. no connectivity in the field).
   */
  async function loadJobs() {
    state.isLoading = true;
    renderAll();
    try {
      const jobs = await Api.getJobs();
      state.jobs = jobs;
      cacheJobsLocally();
    } catch (err) {
      console.warn('โหลดข้อมูลจากเซิร์ฟเวอร์ไม่สำเร็จ ใช้ข้อมูลแคชแทน', err);
      const cached = readCachedJobs();
      state.jobs = cached;
      if (cached.length > 0) {
        showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กำลังแสดงข้อมูลล่าสุดที่บันทึกไว้', 'error');
      } else {
        showToast('ไม่สามารถโหลดข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต', 'error');
      }
    } finally {
      state.isLoading = false;
      renderAll();
    }
  }

  /* ============================ Filtering ============================ */

  /**
   * Returns the jobs list filtered by search term, work type, and status.
   * @returns {Array<Object>}
   */
  function getFilteredJobs() {
    const term = state.searchTerm.trim().toLowerCase();
    return state.jobs.filter((job) => {
      if (state.filterWorkType && job.workType !== state.filterWorkType) return false;
      if (state.filterStatus && job.status !== state.filterStatus) return false;
      if (!term) return true;
      const haystack = [job.fullName, job.parcelId, job.requestNo, job.phone]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }

  /* ============================ Rendering ============================ */

  /**
   * Builds the HTML markup for a single job card.
   * @param {Object} job
   * @returns {string}
   */
  function buildCardHtml(job) {
    const statusClass = STATUS_CLASS_MAP[job.status] || 'status-chip--progress';
    const lat = Number(job.lat);
    const lon = Number(job.lon);
    const coordsText = isValidLat(lat) && isValidLon(lon) ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : 'ไม่ระบุพิกัด';

    return `
      <article class="job-card" data-id="${escapeHtml(job.id)}">
        <div class="job-card__head">
          <div>
            <div class="job-card__type">${escapeHtml(job.workType || '-')}</div>
            <div class="job-card__name">${escapeHtml(job.fullName || 'ไม่ระบุชื่อ')}</div>
          </div>
          <span class="status-chip ${statusClass}">
            <span class="status-chip__dot"></span>${escapeHtml(job.status || '-')}
          </span>
        </div>

        <div class="job-card__meta">
          <div class="job-card__meta-item">
            <span class="job-card__meta-label">รหัสแปลง</span>
            <span class="job-card__meta-value">${escapeHtml(job.parcelId || '-')}</span>
          </div>
          <div class="job-card__meta-item">
            <span class="job-card__meta-label">เลขที่คำร้อง</span>
            <span class="job-card__meta-value">${escapeHtml(job.requestNo || '-')}</span>
          </div>
          <div class="job-card__meta-item">
            <span class="job-card__meta-label">เบอร์โทร</span>
            <span class="job-card__meta-value">${escapeHtml(job.phone || '-')}</span>
          </div>
          <div class="job-card__meta-item">
            <span class="job-card__meta-label">วันที่เพิ่ม</span>
            <span class="job-card__meta-value">${escapeHtml(formatDate(job.createdDate))}</span>
          </div>
        </div>

        <div class="job-card__coords">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
            <path d="M12 22s7-7.58 7-13a7 7 0 1 0-14 0c0 5.42 7 13 7 13Z" stroke="currentColor" stroke-width="1.8"/>
            <circle cx="12" cy="9" r="2.4" stroke="currentColor" stroke-width="1.8"/>
          </svg>
          <span>${coordsText}</span>
        </div>

        <div class="job-card__footer">
          <select class="job-card__status-select" data-action="quick-status" aria-label="เปลี่ยนสถานะ">
            <option value="${STATUS.PROGRESS}" ${job.status === STATUS.PROGRESS ? 'selected' : ''}>${STATUS.PROGRESS}</option>
            <option value="${STATUS.DONE}" ${job.status === STATUS.DONE ? 'selected' : ''}>${STATUS.DONE}</option>
            <option value="${STATUS.CANCELLED}" ${job.status === STATUS.CANCELLED ? 'selected' : ''}>${STATUS.CANCELLED}</option>
          </select>
          <div class="job-card__actions">
            <button class="btn btn--outline btn--sm" type="button" data-action="edit" aria-label="แก้ไขงาน">แก้ไข</button>
            <button class="btn btn--ghost btn--sm" type="button" data-action="delete" aria-label="ลบงาน">ลบ</button>
          </div>
        </div>

        <button class="btn btn--accent btn--full" type="button" data-action="navigate" ${coordsText === 'ไม่ระบุพิกัด' ? 'disabled' : ''}>
          🚗 นำทาง
        </button>
      </article>
    `;
  }

  /**
   * Renders the card grid, skeleton, and empty/no-result states based on
   * current state (loading, jobs, filters).
   */
  function renderAll() {
    updateResultCountLabel();

    if (state.isLoading) {
      dom.skeletonGrid.hidden = false;
      dom.cardGrid.hidden = true;
      dom.emptyState.hidden = true;
      dom.noResultState.hidden = true;
      return;
    }
    dom.skeletonGrid.hidden = true;

    if (state.jobs.length === 0) {
      dom.cardGrid.hidden = true;
      dom.emptyState.hidden = false;
      dom.noResultState.hidden = true;
      return;
    }

    const filtered = getFilteredJobs();
    if (filtered.length === 0) {
      dom.cardGrid.hidden = true;
      dom.emptyState.hidden = true;
      dom.noResultState.hidden = false;
      return;
    }

    dom.emptyState.hidden = true;
    dom.noResultState.hidden = true;
    dom.cardGrid.hidden = false;
    dom.cardGrid.innerHTML = filtered.map(buildCardHtml).join('');
  }

  /**
   * Updates the "N รายการ" summary label above the grid.
   */
  function updateResultCountLabel() {
    if (state.isLoading) {
      dom.resultCount.textContent = 'กำลังโหลดข้อมูล...';
      return;
    }
    const total = state.jobs.length;
    const filtered = getFilteredJobs().length;
    const hasActiveFilter = Boolean(state.searchTerm || state.filterWorkType || state.filterStatus);
    dom.resultCount.textContent = hasActiveFilter
      ? `พบ ${filtered} จากทั้งหมด ${total} รายการ`
      : `ทั้งหมด ${total} รายการ`;
  }

  /* ============================ Job modal (add/edit) ============================ */

  /**
   * Resets the job form to its default empty state.
   */
  function resetJobForm() {
    dom.jobForm.reset();
    dom.jobId.value = '';
    clearFieldErrors();
    dom.status.value = STATUS.PROGRESS;
  }

  /**
   * Opens the job modal in "add" mode.
   */
  function openAddModal() {
    state.editingId = null;
    resetJobForm();
    dom.jobModalTitle.textContent = 'เพิ่มงานใหม่';
    dom.jobModalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => dom.workType.focus(), 50);
  }

  /**
   * Opens the job modal in "edit" mode, pre-filled with the given job.
   * @param {string} id
   */
  function openEditModal(id) {
    const job = state.jobs.find((j) => String(j.id) === String(id));
    if (!job) {
      showToast('ไม่พบข้อมูลงานนี้', 'error');
      return;
    }
    state.editingId = job.id;
    resetJobForm();
    dom.jobId.value = job.id;
    dom.workType.value = job.workType || '';
    dom.parcelId.value = job.parcelId || '';
    dom.requestNo.value = job.requestNo || '';
    dom.fullName.value = job.fullName || '';
    dom.phone.value = job.phone || '';
    dom.lat.value = job.lat ?? '';
    dom.lon.value = job.lon ?? '';
    dom.status.value = job.status || STATUS.PROGRESS;
    dom.jobModalTitle.textContent = 'แก้ไขงาน';
    dom.jobModalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  /**
   * Closes the job modal.
   */
  function closeJobModal() {
    dom.jobModalOverlay.hidden = true;
    document.body.style.overflow = '';
    state.editingId = null;
  }

  /**
   * Clears all inline field error messages and invalid styling.
   */
  function clearFieldErrors() {
    dom.jobForm.querySelectorAll('.field-error').forEach((el) => (el.textContent = ''));
    dom.jobForm.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
  }

  /**
   * Sets an inline error message for a given field name.
   * @param {string} fieldName
   * @param {string} message
   */
  function setFieldError(fieldName, message) {
    const errorEl = dom.jobForm.querySelector(`[data-error-for="${fieldName}"]`);
    const inputEl = dom.jobForm.querySelector(`#${fieldName}`);
    if (errorEl) errorEl.textContent = message;
    if (inputEl) inputEl.classList.add('is-invalid');
  }

  /**
   * Validates the job form. Returns a normalized data object if valid,
   * or null if invalid (and populates field errors).
   * @returns {Object|null}
   */
  function validateJobForm() {
    clearFieldErrors();
    let isValid = true;

    const workType = dom.workType.value.trim();
    const fullName = dom.fullName.value.trim();
    const phone = dom.phone.value.trim();
    const latRaw = dom.lat.value.trim();
    const lonRaw = dom.lon.value.trim();
    const lat = Number(latRaw);
    const lon = Number(lonRaw);

    if (!workType) {
      setFieldError('workType', 'กรุณาเลือกประเภทงาน');
      isValid = false;
    }
    if (!fullName) {
      setFieldError('fullName', 'กรุณากรอกชื่อ-สกุล');
      isValid = false;
    }
    if (phone && !/^[0-9+\-\s()]{6,20}$/.test(phone)) {
      setFieldError('phone', 'รูปแบบเบอร์โทรไม่ถูกต้อง');
      isValid = false;
    }
    if (!latRaw || !isValidLat(lat)) {
      setFieldError('lat', 'กรุณากรอกละติจูดที่ถูกต้อง (-90 ถึง 90)');
      isValid = false;
    }
    if (!lonRaw || !isValidLon(lon)) {
      setFieldError('lon', 'กรุณากรอกลองจิจูดที่ถูกต้อง (-180 ถึง 180)');
      isValid = false;
    }

    if (!isValid) return null;

    return {
      workType,
      parcelId: dom.parcelId.value.trim(),
      requestNo: dom.requestNo.value.trim(),
      fullName,
      phone,
      lat,
      lon,
      status: dom.status.value
    };
  }

  /**
   * Toggles the save button into a loading state.
   * @param {boolean} isLoadingState
   */
  function setSaveButtonLoading(isLoadingState) {
    dom.jobSaveBtn.disabled = isLoadingState;
    dom.jobSaveBtn.querySelector('.btn__label').style.visibility = isLoadingState ? 'hidden' : 'visible';
    dom.jobSaveBtn.querySelector('.btn__spinner').hidden = !isLoadingState;
    dom.jobSaveBtn.style.position = 'relative';
    if (isLoadingState) {
      dom.jobSaveBtn.querySelector('.btn__spinner').style.position = 'absolute';
    }
  }

  /**
   * Handles job form submission for both create and update flows.
   * @param {SubmitEvent} event
   */
  async function handleJobFormSubmit(event) {
    event.preventDefault();
    const data = validateJobForm();
    if (!data) return;

    setSaveButtonLoading(true);
    try {
      if (state.editingId) {
        const updated = await Api.updateJob({ id: state.editingId, ...data });
        const index = state.jobs.findIndex((j) => String(j.id) === String(state.editingId));
        if (index !== -1) state.jobs[index] = updated;
        showToast('บันทึกการแก้ไขเรียบร้อยแล้ว', 'success');
      } else {
        const created = await Api.createJob(data);
        state.jobs.unshift(created);
        showToast('เพิ่มงานใหม่เรียบร้อยแล้ว', 'success');
      }
      cacheJobsLocally();
      closeJobModal();
      renderAll();
    } catch (err) {
      showToast(err.message || 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error');
    } finally {
      setSaveButtonLoading(false);
    }
  }

  /**
   * Uses the browser Geolocation API to fill the lat/lon fields with the
   * officer's current position.
   */
  function useCurrentLocation() {
    if (!('geolocation' in navigator)) {
      showToast('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง', 'error');
      return;
    }
    dom.useCurrentLocationBtn.disabled = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        dom.lat.value = position.coords.latitude.toFixed(6);
        dom.lon.value = position.coords.longitude.toFixed(6);
        dom.useCurrentLocationBtn.disabled = false;
        showToast('ใช้ตำแหน่งปัจจุบันเรียบร้อยแล้ว', 'success');
      },
      (error) => {
        dom.useCurrentLocationBtn.disabled = false;
        showToast('ไม่สามารถระบุตำแหน่งได้: ' + error.message, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  /* ============================ Delete flow ============================ */

  /**
   * Opens the confirmation modal for deleting a job.
   * @param {string} id
   */
  function openConfirmDelete(id) {
    state.pendingDeleteId = id;
    dom.confirmModalOverlay.hidden = false;
  }

  /**
   * Closes the delete confirmation modal.
   */
  function closeConfirmModal() {
    dom.confirmModalOverlay.hidden = true;
    state.pendingDeleteId = null;
  }

  /**
   * Executes the delete after user confirmation.
   */
  async function handleConfirmDelete() {
    const id = state.pendingDeleteId;
    if (!id) return;
    dom.confirmDeleteBtn.disabled = true;
    try {
      await Api.deleteJob(id);
      state.jobs = state.jobs.filter((j) => String(j.id) !== String(id));
      cacheJobsLocally();
      showToast('ลบรายการเรียบร้อยแล้ว', 'success');
      closeConfirmModal();
      renderAll();
    } catch (err) {
      showToast(err.message || 'ลบข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error');
    } finally {
      dom.confirmDeleteBtn.disabled = false;
    }
  }

  /* ============================ Quick status change ============================ */

  /**
   * Handles an inline status change from a job card's select control.
   * @param {string} id
   * @param {string} newStatus
   * @param {HTMLSelectElement} selectEl
   */
  async function handleQuickStatusChange(id, newStatus, selectEl) {
    const job = state.jobs.find((j) => String(j.id) === String(id));
    const previousStatus = job ? job.status : null;
    selectEl.disabled = true;
    try {
      const updated = await Api.updateStatus(id, newStatus);
      const index = state.jobs.findIndex((j) => String(j.id) === String(id));
      if (index !== -1) state.jobs[index] = updated;
      cacheJobsLocally();
      showToast('อัปเดตสถานะเรียบร้อยแล้ว', 'success');
      renderAll();
    } catch (err) {
      showToast(err.message || 'อัปเดตสถานะไม่สำเร็จ', 'error');
      if (previousStatus) selectEl.value = previousStatus;
    } finally {
      selectEl.disabled = false;
    }
  }

  /* ============================ Navigation ============================ */

  /**
   * Opens Google Maps directions to the given coordinates in a new tab.
   * @param {number} lat
   * @param {number} lon
   */
  function navigateToJob(lat, lon) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
    window.open(url, '_blank', 'noopener');
  }

  /* ============================ Event delegation on card grid ============================ */

  /**
   * Handles all click/change interactions inside the card grid via
   * delegation, keyed off `data-action` attributes.
   * @param {Event} event
   */
  function handleCardGridClick(event) {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    const card = event.target.closest('.job-card');
    if (!card) return;
    const id = card.dataset.id;
    const action = actionEl.dataset.action;

    if (action === 'edit') {
      openEditModal(id);
    } else if (action === 'delete') {
      openConfirmDelete(id);
    } else if (action === 'navigate') {
      const job = state.jobs.find((j) => String(j.id) === String(id));
      if (job && isValidLat(Number(job.lat)) && isValidLon(Number(job.lon))) {
        navigateToJob(job.lat, job.lon);
      }
    }
  }

  /**
   * Handles status <select> changes inside the card grid via delegation.
   * @param {Event} event
   */
  function handleCardGridChange(event) {
    const selectEl = event.target.closest('[data-action="quick-status"]');
    if (!selectEl) return;
    const card = event.target.closest('.job-card');
    if (!card) return;
    handleQuickStatusChange(card.dataset.id, selectEl.value, selectEl);
  }

  /* ============================ Service worker ============================ */

  /**
   * Registers the service worker for offline app-shell caching.
   */
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => {
        console.warn('การลงทะเบียน Service Worker ล้มเหลว', err);
      });
    });
  }

  /* ============================ Event bindings ============================ */

  /**
   * Wires up all DOM event listeners for the application.
   */
  function bindEvents() {
    dom.fabAddBtn.addEventListener('click', openAddModal);
    dom.desktopAddBtn.addEventListener('click', openAddModal);
    dom.emptyAddBtn.addEventListener('click', openAddModal);

    dom.jobModalCloseBtn.addEventListener('click', closeJobModal);
    dom.jobCancelBtn.addEventListener('click', closeJobModal);
    dom.jobModalOverlay.addEventListener('click', (e) => {
      if (e.target === dom.jobModalOverlay) closeJobModal();
    });
    dom.jobForm.addEventListener('submit', handleJobFormSubmit);
    dom.useCurrentLocationBtn.addEventListener('click', useCurrentLocation);

    dom.confirmCancelBtn.addEventListener('click', closeConfirmModal);
    dom.confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
    dom.confirmModalOverlay.addEventListener('click', (e) => {
      if (e.target === dom.confirmModalOverlay) closeConfirmModal();
    });

    dom.cardGrid.addEventListener('click', handleCardGridClick);
    dom.cardGrid.addEventListener('change', handleCardGridChange);

    dom.searchInput.addEventListener(
      'input',
      debounce((e) => {
        state.searchTerm = e.target.value;
        renderAll();
      }, 200)
    );
    dom.filterWorkType.addEventListener('change', (e) => {
      state.filterWorkType = e.target.value;
      renderAll();
    });
    dom.filterStatus.addEventListener('change', (e) => {
      state.filterStatus = e.target.value;
      renderAll();
    });

    dom.refreshBtn.addEventListener('click', loadJobs);
    dom.themeToggleBtn.addEventListener('click', toggleTheme);

    window.addEventListener('online', () => {
      updateConnectionUi();
      showToast('กลับมาออนไลน์แล้ว กำลังซิงค์ข้อมูล...', 'info');
      loadJobs();
    });
    window.addEventListener('offline', updateConnectionUi);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!dom.jobModalOverlay.hidden) closeJobModal();
        if (!dom.confirmModalOverlay.hidden) closeConfirmModal();
      }
    });
  }

  /* ============================ Init ============================ */

  /**
   * Application entry point.
   */
  function init() {
    initTheme();
    updateConnectionUi();
    bindEvents();
    registerServiceWorker();
    loadJobs();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
