/**
 * api.js
 * ---------------------------------------------------------------------------
 * Thin REST-style client for the Google Apps Script backend (Code.gs).
 *
 * IMPORTANT — Apps Script Web Apps only expose two HTTP entry points:
 * doGet(e) and doPost(e). There is no native routing for PUT/DELETE verbs.
 * To keep a clean REST-like contract on the client while staying compatible
 * with Apps Script, every write operation (create / update / delete /
 * updateStatus) is sent as an HTTP POST whose JSON body carries an
 * `action` field. The server (Code.gs) dispatches on that field.
 *
 * To avoid a CORS pre-flight (Apps Script web apps do not answer the
 * OPTIONS pre-flight request), POST requests are sent with
 * `Content-Type: text/plain;charset=utf-8`. This is a "simple request" per
 * the Fetch/CORS spec so no pre-flight is triggered. The body is still a
 * valid JSON string, and Code.gs parses it with JSON.parse(e.postData.contents).
 * ---------------------------------------------------------------------------
 */

const Api = (() => {
  'use strict';

  /**
   * Configuration.
   * Replace API_URL with your deployed Google Apps Script Web App URL,
   * e.g. "https://script.google.com/macros/s/XXXXXXXXXXXX/exec".
   * This value is read first from localStorage (set via setApiUrl) so the
   * app can be configured after deployment without editing source files.
   */
  const CONFIG = {
    DEFAULT_API_URL: 'https://script.google.com/macros/s/AKfycbyrzzgGmXiSzggnr0YNSb6cdq_UfgO5qKrIJOV2Jo9Zd0XeRkG3tpRKI0UpJH0eTOO7/exec',
    STORAGE_KEY_API_URL: 'gpsnavi.apiUrl',
    REQUEST_TIMEOUT_MS: 20000
  };

  /**
   * Returns the currently configured API URL.
   * @returns {string}
   */
  function getApiUrl() {
    return localStorage.getItem(CONFIG.STORAGE_KEY_API_URL) || CONFIG.DEFAULT_API_URL;
  }

  /**
   * Persists a new API URL to localStorage.
   * @param {string} url
   */
  function setApiUrl(url) {
    localStorage.setItem(CONFIG.STORAGE_KEY_API_URL, url.trim());
  }

  /**
   * Wraps fetch with a timeout so the UI never hangs indefinitely on a
   * dropped connection (important for field officers on weak signal).
   * @param {string} url
   * @param {RequestInit} options
   * @returns {Promise<Response>}
   */
  async function fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Parses a JSON response and normalizes backend errors into thrown Errors.
   * @param {Response} response
   * @returns {Promise<any>}
   */
  async function parseJsonResponse(response) {
    let payload;
    try {
      payload = await response.json();
    } catch (err) {
      throw new Error('การตอบกลับจากเซิร์ฟเวอร์ไม่ถูกต้อง (ไม่ใช่ JSON)');
    }
    if (!response.ok || payload.ok === false) {
      throw new Error(payload && payload.error ? payload.error : 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์');
    }
    return payload;
  }

  /**
   * Fetches all jobs from the sheet.
   * @returns {Promise<Array<Object>>}
   */
  async function getJobs() {
    const url = `${getApiUrl()}?action=list&_=${Date.now()}`;
    const response = await fetchWithTimeout(url, { method: 'GET' });
    const payload = await parseJsonResponse(response);
    return payload.data || [];
  }

  /**
   * Sends a write action (create/update/delete/updateStatus) to the backend.
   * @param {string} action
   * @param {Object} data
   * @returns {Promise<any>}
   */
  async function postAction(action, data) {
    const response = await fetchWithTimeout(getApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...data })
    });
    return parseJsonResponse(response);
  }

  /**
   * Creates a new job record.
   * @param {Object} job
   * @returns {Promise<Object>} the created job (with generated id/createdDate)
   */
  async function createJob(job) {
    const payload = await postAction('create', job);
    return payload.data;
  }

  /**
   * Updates an existing job record.
   * @param {Object} job must include `id`
   * @returns {Promise<Object>}
   */
  async function updateJob(job) {
    const payload = await postAction('update', job);
    return payload.data;
  }

  /**
   * Updates only the status field of a job (quick status change from card).
   * @param {string} id
   * @param {string} status
   * @returns {Promise<Object>}
   */
  async function updateStatus(id, status) {
    const payload = await postAction('updateStatus', { id, status });
    return payload.data;
  }

  /**
   * Deletes a job record permanently.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async function deleteJob(id) {
    await postAction('delete', { id });
  }

  return {
    getApiUrl,
    setApiUrl,
    getJobs,
    createJob,
    updateJob,
    updateStatus,
    deleteJob
  };
})();
