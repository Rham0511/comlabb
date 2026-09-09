// public/js/maintenance-client.js
// Handles the Maintenance Request submission modal for students

(() => {
  const openBtn = document.getElementById('openReportBtn');
  const reportModal = document.getElementById('reportModal');
  const cancelBtn = document.getElementById('cancelReportBtn');
  const form = document.getElementById('reportForm');
  const msgEl = document.getElementById('reportFormMessage');
  const submitBtn = document.getElementById('submitReportBtn');

  if (!form) return; // nothing to do

  function showModal() {
    if (reportModal) reportModal.classList.add('show');
  }
  function hideModal() {
    if (reportModal) reportModal.classList.remove('show');
  }

  function setMessage(text, isError = false) {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.style.color = isError ? '#FCA5A5' : '#BBF7D0';
  }
  function clearMessage() { if (msgEl) msgEl.textContent = ''; }

  function setLoading(loading = true) {
    if (!submitBtn) return;
    submitBtn.disabled = loading;
    submitBtn.textContent = loading ? 'Submitting...' : 'Submit Report';
    if (loading) submitBtn.classList.add('opacity-70'); else submitBtn.classList.remove('opacity-70');
  }

  function clearForm() {
    form.reset();
  }

  openBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    clearMessage();
    showModal();
    document.getElementById('equipmentId')?.focus();
  });

  cancelBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    hideModal();
  });

  // close when clicking outside content
  window.addEventListener('click', (e) => {
    if (e.target === reportModal) hideModal();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessage();

    const equipmentId = document.getElementById('equipmentId').value.trim();
    const description = document.getElementById('description').value.trim();

    // client-side validation
    if (!equipmentId || !description) {
      setMessage('Please complete all required fields.', true);
      return;
    }

    const payload = {
      equipmentId,
      description,
      issueTitle: `Issue reported for ${equipmentId}`,
      category: 'General',
      priority: 'Medium'
    };

    try {
      setLoading(true);

      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        const err = body?.error || body?.message || 'Failed to submit report.';
        setMessage(err, true);
        setLoading(false);
        return;
      }

      setMessage('Maintenance request submitted — technician has been notified.', false);
      clearForm();
      window.dispatchEvent(new CustomEvent('maintenanceRequestSubmitted'));

      // close modal after short delay
      setTimeout(() => {
        hideModal();
        clearMessage();
      }, 1200);

    } catch (err) {
      setMessage('Network error — please try again.', true);
    } finally {
      setLoading(false);
    }
  });
})();
