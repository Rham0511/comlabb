// public/js/admin-maintenance.js
// Admin Maintenance Requests management: list requests, load workflows, and assign technicians

(async () => {
  const tableBody = document.getElementById('maintenanceTableBody');
  const assignMessage = document.getElementById('assignMessage');
  const totalRequestsCount = document.getElementById('totalRequestsCount');
  const pendingRequestsCount = document.getElementById('pendingRequestsCount');
  const inProgressRequestsCount = document.getElementById('inProgressRequestsCount');
  const resolvedRequestsCount = document.getElementById('resolvedRequestsCount');
  const maintenanceSearchInput = document.getElementById('maintenanceSearchInput');
  const dateFilter = document.getElementById('dateFilter');
  const adminAvatar = document.getElementById('adminAvatar');
  const adminUserName = document.getElementById('adminUserName');
  const adminUserRole = document.getElementById('adminUserRole');
  let currentRequests = [];
  let activeStatusFilter = 'All';
  let activeDateFilter = 'All';
  let activeSearchText = '';
  const paginationState = {
    currentPage: 1,
    rowsPerPage: 7
  };

  if (!tableBody) return; // not on this page

  const setMessage = (el, text, isError = false) => {
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? '#FCA5A5' : '#BBF7D0';
  };

  const setText = (el, value) => {
    if (!el) return;
    el.textContent = value != null ? String(value) : '0';
  };

  const fetchSummary = async () => {
    try {
      const res = await fetch('/api/maintenance-summary');
      if (!res.ok) throw new Error('Failed to load summary');
      const data = await res.json();
      setText(totalRequestsCount, data.totalRequests);
      setText(pendingRequestsCount, data.pendingRequests);
      setText(inProgressRequestsCount, data.inProgressRequests);
      setText(resolvedRequestsCount, data.resolvedRequests);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/maintenance');
      if (!res.ok) throw new Error('Failed to load requests');
      const data = await res.json();
      currentRequests = data || [];
      renderTable(filterRequests(currentRequests));
    } catch (err) {
      console.error(err);
      setMessage(assignMessage, 'Failed to load maintenance requests', true);
    }
  };

  const isWithinDateRange = (value, range) => {
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    const day = startOfWeek.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    startOfWeek.setDate(startOfToday.getDate() + diff);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    switch (range) {
      case 'Today':
        return date >= startOfToday;
      case 'This Week':
        return date >= startOfWeek;
      case 'This Month':
        return date >= startOfMonth;
      default:
        return true;
    }
  };

  const filterRequests = (rows) => {
    const searchTerm = activeSearchText.trim().toLowerCase();

    return rows.filter((r) => {
      const matchesSearch = !searchTerm || [
        r.equipmentId,
        r.equipmentName,
        r.reporterName,
        r.technicianName,
        r.issueTitle
      ].some((value) => String(value || '').toLowerCase().includes(searchTerm));

      const matchesStatus = activeStatusFilter === 'All' || r.status === activeStatusFilter;
      const matchesDate = activeDateFilter === 'All' || isWithinDateRange(r.dateReported, activeDateFilter);

      return matchesSearch && matchesStatus && matchesDate;
    });
  };

  const setStatusFilter = (status) => {
    activeStatusFilter = status;
    paginationState.currentPage = 1;
    document.querySelectorAll('.status-filter').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === status);
    });
    renderTable(filterRequests(currentRequests));
  };

  const setDateFilter = (range) => {
    activeDateFilter = range;
    paginationState.currentPage = 1;
    renderTable(filterRequests(currentRequests));
  };

  const setSearchText = (value) => {
    activeSearchText = value;
    paginationState.currentPage = 1;
    renderTable(filterRequests(currentRequests));
  };

  const getVisiblePaginationItems = (totalPages, currentPage) => {
    if (totalPages <= 1) return [];
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const items = [1];
    if (currentPage <= 2) {
      items.push(2);
      items.push('...');
      items.push(totalPages);
    } else if (currentPage >= totalPages - 1) {
      items.push('...');
      items.push(totalPages - 1);
      items.push(totalPages);
    } else {
      items.push('...');
      items.push(currentPage);
      items.push(currentPage + 1);
      items.push('...');
      items.push(totalPages);
    }
    return items;
  };

  const renderPaginationControls = (rows) => {
    const paginationContainer = document.getElementById('maintenancePagination');
    const paginationInfo = document.getElementById('maintenancePaginationInfo');
    if (!paginationContainer) return;

    const totalPages = Math.max(1, Math.ceil((rows?.length || 0) / paginationState.rowsPerPage));
    paginationState.currentPage = Math.min(Math.max(1, paginationState.currentPage), totalPages);

    const startIndex = rows && rows.length ? (paginationState.currentPage - 1) * paginationState.rowsPerPage + 1 : 0;
    const endIndex = rows && rows.length ? Math.min(paginationState.currentPage * paginationState.rowsPerPage, rows.length) : 0;
    if (paginationInfo) {
      paginationInfo.textContent = rows && rows.length ? `Showing ${startIndex}-${endIndex} of ${rows.length}` : 'Showing 0 of 0';
    }

    paginationContainer.innerHTML = '';
    if (totalPages <= 1) return;

    const createButton = (label, page, isActive, isDisabled, isPageNumber = false) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.disabled = isDisabled;

      if (isPageNumber) {
        button.className = isActive
          ? 'flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500 bg-emerald-600 font-bold text-white shadow-sm transition'
          : 'flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-800/40 bg-emerald-950/40 text-emerald-300 transition hover:bg-emerald-900/60';
      } else {
        button.className = 'rounded-lg border border-emerald-800/50 bg-emerald-950/40 px-3 py-1.5 text-sm text-emerald-300 transition hover:bg-emerald-900/50';
      }

      if (isDisabled) {
        button.classList.add('cursor-not-allowed', 'opacity-40');
      }

      if (!isDisabled) {
        button.addEventListener('click', () => {
          paginationState.currentPage = page;
          renderTable(rows);
        });
      }
      return button;
    };

    paginationContainer.appendChild(createButton('Previous', paginationState.currentPage - 1, false, paginationState.currentPage <= 1));

    const visiblePages = getVisiblePaginationItems(totalPages, paginationState.currentPage);
    visiblePages.forEach((pageItem) => {
      if (pageItem === '...') {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'px-1 font-bold text-emerald-500/60';
        ellipsis.textContent = '...';
        paginationContainer.appendChild(ellipsis);
        return;
      }

      paginationContainer.appendChild(createButton(String(pageItem), pageItem, pageItem === paginationState.currentPage, false, true));
    });

    paginationContainer.appendChild(createButton('Next', paginationState.currentPage + 1, false, paginationState.currentPage >= totalPages));
  };

  const renderTable = (rows) => {
    if (!rows.length) {
      tableBody.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">No maintenance reports match your filters.</td></tr>';
      renderPaginationControls(rows);
      return;
    }

    const totalPages = Math.max(1, Math.ceil(rows.length / paginationState.rowsPerPage));
    paginationState.currentPage = Math.min(Math.max(1, paginationState.currentPage), totalPages);
    const startIndex = (paginationState.currentPage - 1) * paginationState.rowsPerPage;
    const pageRows = rows.slice(startIndex, startIndex + paginationState.rowsPerPage);

    tableBody.innerHTML = pageRows.map(r => {
      const reportedAt = r.dateReported ? new Date(r.dateReported).toLocaleString() : 'N/A';
      const statusClass = getStatusBadgeClass(r.status);
      const currentStatus = r.status || 'Pending';
      return `
        <tr class="hover:bg-slate-900/70">
          <td class="px-4 py-3">${escapeHtml(r.equipmentId || 'N/A')}</td>
          <td class="px-4 py-3">${escapeHtml(r.equipmentName || 'Unknown Equipment')}</td>
          <td class="px-4 py-3">${escapeHtml(r.reporterName || 'Guest Student')}</td>
          <td class="px-4 py-3"><span class="status-badge ${statusClass}">${escapeHtml(currentStatus)}</span></td>
          <td class="px-4 py-3">${escapeHtml(reportedAt)}</td>
        </tr>
      `;
    }).join('\n');

    renderPaginationControls(rows);
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Pending': return 'status-pending';
      case 'In Progress': return 'status-in-progress';
      case 'Resolved': return 'status-resolved';
      case 'Rejected': return 'status-rejected';
      default: return 'status-secondary';
    }
  };

  const updateMaintenanceStatus = async (requestId, status) => {
    try {
      const res = await fetch(`/api/maintenance/${requestId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = body?.error || body?.message || 'Failed to update status';
        setMessage(assignMessage, err, true);
        return false;
      }
      setMessage(assignMessage, 'Status updated successfully', false);
      await refreshMaintenanceData();
      return true;
    } catch (err) {
      console.error(err);
      setMessage(assignMessage, 'Network error — try again', true);
      return false;
    }
  };

  const setCurrentUserHeader = () => {
    const user = window.__CURRENT_USER__;
    if (!user) return;
    if (adminAvatar) adminAvatar.textContent = user.initials || getInitials(user.name);
    if (adminUserName) adminUserName.textContent = user.name || 'Administrator';
    if (adminUserRole) adminUserRole.textContent = user.role ? capitalize(user.role) : 'Administrator';
  };

  const getInitials = (name) => {
    if (!name) return 'AD';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
  };

  const capitalize = (value) => {
    if (!value) return '';
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  };

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function (s) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[s];
    });
  }

  const refreshMaintenanceData = async () => {
    await Promise.all([
      fetchSummary(),
      fetchRequests()
    ]);
  };

  document.querySelectorAll('.status-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      setStatusFilter(btn.dataset.filter);
    });
  });

  maintenanceSearchInput?.addEventListener('input', (e) => {
    setSearchText(e.target.value);
  });

  dateFilter?.addEventListener('change', (e) => {
    setDateFilter(e.target.value);
  });

  document.getElementById('refreshMaintenanceData')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await refreshMaintenanceData();
  });

  setCurrentUserHeader();
  await refreshMaintenanceData();
})();
