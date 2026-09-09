(function(){
  const fmtDate = (d)=>{ if(!d) return '-'; const dt=new Date(d); return dt.toLocaleString(); };
  let allSessions = [];
  let currentPage = 1;
  let activeSearchText = '';
  let activeCampusFilter = '';
  let activeLabFilter = '';
  let activeDateFilter = '';
  const rowsPerPage = 4;

  async function fetchSessions(){
    const res = await fetch('/api/attendance-sessions');
    if(!res.ok) return console.error('Failed to fetch sessions');
    const data = await res.json();
    syncCampusFilter(data);
    renderSessions(data);
  }

  function syncCampusFilter(items){
    const campusFilter = document.getElementById('attendanceCampusFilter');
    if(!campusFilter) return;

    const campuses = [...new Set((Array.isArray(items) ? items : [])
      .map((item) => String(item.campus || '').trim())
      .filter(Boolean))];

    if(campuses.length === 1){
      campusFilter.innerHTML = `<option value="${escapeHtml(campuses[0])}">${escapeHtml(campuses[0])}</option>`;
      campusFilter.value = campuses[0];
      campusFilter.disabled = true;
      campusFilter.setAttribute('aria-label', `Attendance campus: ${campuses[0]}`);
    }
  }

  function getFilteredSessions(items){
    const query = activeSearchText.trim().toLowerCase();
    let filtered = Array.isArray(items) ? items : [];
    
    // Search filter
    if(query){
      filtered = filtered.filter((it) => {
        const haystack = [it.subject, it.laboratoryRoom, it.instructor, it.time].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(query);
      });
    }
    
    // Campus filter
    if(activeCampusFilter){
      filtered = filtered.filter((it) => (it.campus || '') === activeCampusFilter);
    }
    
    // Laboratory filter
    if(activeLabFilter){
      filtered = filtered.filter((it) => (it.laboratoryRoom || '') === activeLabFilter);
    }
    
    // Date filter
    if(activeDateFilter){
      filtered = filtered.filter((it) => {
        if(!it.createdAt) return false;
        const sessionDate = new Date(it.createdAt).toISOString().split('T')[0];
        return sessionDate === activeDateFilter;
      });
    }
    
    return filtered;
  }

  function renderPaginationControls(rows){
    const paginationContainer = document.getElementById('attendancePagination');
    const paginationInfo = document.getElementById('attendancePaginationInfo');
    if(!paginationContainer) return;

    const totalPages = Math.max(1, Math.ceil((rows?.length || 0) / rowsPerPage));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);

    if(paginationInfo){
      const startIndex = rows && rows.length ? (currentPage - 1) * rowsPerPage + 1 : 0;
      const endIndex = rows && rows.length ? Math.min(currentPage * rowsPerPage, rows.length) : 0;
      paginationInfo.textContent = rows && rows.length ? `Showing ${startIndex}-${endIndex} of ${rows.length}` : 'Showing 0 of 0';
    }

    paginationContainer.innerHTML = '';
    if(totalPages <= 1) return;

    const createButton = (label, page, isActive, isDisabled, isPageNumber = false) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.disabled = isDisabled;
      button.className = isPageNumber
        ? (isActive 
          ? 'attendance-pagination-btn active'
          : 'attendance-pagination-btn')
        : 'attendance-pagination-btn';
      
      if(isDisabled){ button.classList.add('disabled'); }
      if(!isDisabled){
        button.addEventListener('click', ()=>{
          currentPage = page;
          renderSessions(allSessions);
        });
      }
      return button;
    };

    paginationContainer.appendChild(createButton('Previous', currentPage - 1, false, currentPage <= 1));

    const visiblePages = [];
    for(let i = 1; i <= totalPages; i++){
      visiblePages.push(i);
    }
    visiblePages.forEach((pageNumber) => {
      paginationContainer.appendChild(createButton(String(pageNumber), pageNumber, pageNumber === currentPage, false, true));
    });

    paginationContainer.appendChild(createButton('Next', currentPage + 1, false, currentPage >= totalPages));
  }

  function renderSessions(items){
    const tbody = document.getElementById('attendanceMonitorTableBody');
    const totalEl = document.getElementById('totalSessionsValue');
    const presentEl = document.getElementById('presentTodayValue');
    const absentEl = document.getElementById('absentTodayValue');
    const lateEl = document.getElementById('lateTodayValue');
    if(!tbody) return;

    allSessions = Array.isArray(items) ? items : [];
    const filtered = getFilteredSessions(allSessions);
    const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const pageItems = filtered.slice(startIndex, startIndex + rowsPerPage);

    tbody.innerHTML='';

    let total=0, present=0, absent=0, late=0;
    allSessions.forEach((it)=>{
      total++;
      present += it.present||0;
      absent += it.absent||0;
      late += it.late||0;
    });

    if(!pageItems.length){
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-slate-400">No attendance sessions match your filters.</td></tr>';
    } else {
      pageItems.forEach((it)=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(it.subject||'—')}</td>
          <td>${escapeHtml(it.laboratoryRoom||'—')}</td>
          <td>${escapeHtml(it.instructor||'—')}</td>
          <td>${fmtDate(it.createdAt)}</td>
          <td>${escapeHtml(it.time||'—')}</td>
          <td>${it.totalStudents||0} students<br/>P:${it.present||0} A:${it.absent||0} L:${it.late||0}</td>
          <td><button class="attendance-action-btn view-attendance" data-id="${it.id}">View Attendance</button></td>
        `;
        tbody.appendChild(tr);
      });
    }

    if(totalEl) totalEl.textContent = total;
    if(presentEl) presentEl.textContent = present;
    if(absentEl) absentEl.textContent = absent;
    if(lateEl) lateEl.textContent = late;

    renderPaginationControls(filtered);

    document.querySelectorAll('.view-attendance').forEach((btn)=>{
      btn.addEventListener('click', ()=>{
        const id = btn.dataset.id;
        openAttendanceSessionModal(id);
      });
    });
  }

  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c]); }

  async function openAttendanceSessionModal(id){
    const modal = document.getElementById('attendanceSessionModal');
    const content = document.getElementById('attendanceSessionModalContent');
    const title = document.getElementById('attendanceSessionModalTitle');
    const subtitle = document.getElementById('attendanceSessionModalSubtitle');
    if(!modal || !content) return;
    content.innerHTML = '<div class="text-center py-8">Loading...</div>';
    // prevent background scrolling
    try{ document.body.classList.add('modal-open'); }catch(e){}

    // Adjust content area to account for fixed sidebar width (approx 300px)
    try {
      const contentArea = document.getElementById('attendanceSessionModalContentArea');
      let sidebarWidth = 300;
      const sidebar = document.getElementById('shared-sidebar') || document.querySelector('.sidebar');
      if (sidebar) {
        const rect = sidebar.getBoundingClientRect();
        if (rect && rect.width) sidebarWidth = Math.round(rect.width);
      }
      if (contentArea) {
        contentArea.style.marginLeft = sidebarWidth + 'px';
        contentArea.style.width = `calc(100vw - ${sidebarWidth}px)`;
        contentArea.style.minHeight = 'calc(100vh - 60px)';
        contentArea.style.padding = '30px';
      }
    } catch (e) {
      console.warn('Failed to adjust modal content area for sidebar offset', e);
    }

    modal.classList.remove('hidden');

    try{
      const res = await fetch('/api/attendance-sessions/' + encodeURIComponent(id));
      if(!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      title.textContent = data.schedule.subject || 'Attendance Details';
      subtitle.textContent = data.schedule.laboratoryRoom || '';

      const s = data.summary || { total:0, present:0, absent:0, late:0, attendancePercentage:0 };
      // render header cards separately so they remain visible (sticky header)
      const headerCards = [];
      headerCards.push(cardHtml('Total Students', s.total, 'blue'));
      headerCards.push(cardHtml('Present', s.present, 'green'));
      headerCards.push(cardHtml('Absent', s.absent, 'red'));
      headerCards.push(cardHtml('Late', s.late, 'amber'));
      const headerHtml = `<div class="attendance-summary-grid">${headerCards.join('')}</div>`;

      let html = '';
      // place header cards into the sticky header area
      const headerExtrasEl = document.getElementById('attendanceSessionModalHeaderExtras');
      if (headerExtrasEl) headerExtrasEl.innerHTML = headerHtml;
      html += `<div class="attendance-modal-controls">
        <div class="contents">
          <input id="attendanceDetailSearch" placeholder="Search student id or name" class="px-3 py-2 rounded-xl bg-transparent border border-slate-700 text-slate-200" />
          <button id="exportExcelBtn" class="px-3 py-2 rounded-xl bg-slate-800 text-slate-200">Export Excel</button>
          <button id="exportPdfBtn" class="px-3 py-2 rounded-xl bg-slate-800 text-slate-200">Export PDF</button>
        </div>
      </div>`;

      // Table: Student ID | Full Name | Status | Time In | Time Out
      html += `<div class="attendance-table-wrap"><table class="attendance-detail-table min-w-full text-left divide-y"><thead><tr><th class="px-5 py-3.5 text-sm font-semibold text-emerald-100/80">Student ID</th><th class="px-5 py-3.5 text-sm font-semibold text-emerald-100/80">Full Name</th><th class="px-5 py-3.5 text-sm font-semibold text-emerald-100/80">Status</th><th class="px-5 py-3.5 text-sm font-semibold text-emerald-100/80">Time In</th><th class="px-5 py-3.5 text-sm font-semibold text-emerald-100/80">Time Out</th></tr></thead><tbody id="attendanceDetailTableBody" class="divide-y text-sm">`;
      (data.rows||[]).forEach(r=>{
        const studentId = r.studentId || r.id || '';
        const status = r.status || r.attendanceStatus || 'Absent';
        const statusClass = status === 'Present' ? 'text-green-300' : status === 'Late' ? 'text-amber-300' : 'text-red-300';
        const timeIn = r.timeIn || r.time || r.scannedAt || 'Not recorded';
        const timeOut = r.timeOut || 'Not recorded';
        html += `<tr class="hover:bg-slate-900/60"><td data-label="Student ID" class="px-4 py-3">${escapeHtml(studentId || '—')}</td><td data-label="Full Name" class="px-4 py-3 attendance-student-name">${escapeHtml(r.fullName || r.studentName || '—')}</td><td data-label="Status" class="px-4 py-3 ${statusClass}"><span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold">${escapeHtml(status)}</span></td><td data-label="Time In" class="px-4 py-3">${escapeHtml(timeIn)}</td><td data-label="Time Out" class="px-4 py-3">${escapeHtml(timeOut)}</td></tr>`;
      });
      html += `</tbody></table></div>`;

      content.innerHTML = html;

      document.getElementById('attendanceDetailSearch').addEventListener('input', (e)=>{
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('#attendanceDetailTableBody tr').forEach(tr=>{
          const text = tr.textContent.toLowerCase();
          tr.style.display = text.includes(q)? '' : 'none';
        });
      });

      // Export Excel: request server-generated XLSX and download
      document.getElementById('exportExcelBtn').addEventListener('click', async ()=>{
        try {
          if (!data.rows || !data.rows.length) {
            return alert('No attendance records to export for this session.');
          }
          const resp = await fetch('/api/attendance-sessions/' + encodeURIComponent(id) + '?format=excel', { credentials: 'same-origin' });
          if (!resp.ok) throw new Error('Failed to download Excel');
          const blob = await resp.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'Attendance_Report.xlsx';
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
        } catch (err) {
          console.error(err);
          alert('Failed to export Excel.');
        }
      });

      // Export PDF: generate client-side PDF using jsPDF + autotable (load from CDN if missing)
      document.getElementById('exportPdfBtn').addEventListener('click', async ()=>{
        try {
          if (!data.rows || !data.rows.length) {
            return alert('No attendance records to export for this session.');
          }

          // dynamic loader
          const loadScript = (src) => new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) return resolve();
            const s = document.createElement('script'); s.src = src; s.async = true;
            s.onload = () => resolve(); s.onerror = () => reject(new Error('Failed to load ' + src));
            document.head.appendChild(s);
          });

          // load jspdf and autotable if not present
          if (!window.jspdf) {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
            // jspdf exposes window.jspdf (UMD) with property jsPDF
          }
          if (!window.jspdf || !window.jspdf.jsPDF) {
            // fallback check
            if (!window.jspdf) throw new Error('jsPDF not available');
          }
          if (!window.jspdf.autoTable && !window.jspdfAutoTable) {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js');
          }

          // create PDF
          const { jsPDF } = window.jspdf;
          const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
          const margin = 40;
          const pageWidth = doc.internal.pageSize.getWidth();

          // Header details
          const schoolTitle = 'Mindoro State University - ComLab';
          doc.setFontSize(14); doc.text(schoolTitle, margin, 50);
          doc.setFontSize(12); doc.text('Subject: ' + (data.schedule.subject || ''), margin, 70);
          doc.text('Instructor: ' + (data.schedule.instructor || ''), margin, 88);
          const createdAt = data.schedule.createdAt ? new Date(data.schedule.createdAt).toLocaleString() : '';
          doc.text('Date: ' + createdAt, margin, 106);

          // Summary
          const ssum = data.summary || { total:0, present:0, absent:0, late:0 };
          doc.setFontSize(11);
          doc.text(`Present: ${ssum.present}`, margin, 130);
          doc.text(`Absent: ${ssum.absent}`, margin + 120, 130);
          doc.text(`Late: ${ssum.late}`, margin + 240, 130);

          // Table data
          const columns = [
            { header: 'Student ID', dataKey: 'studentId' },
            { header: 'Full Name', dataKey: 'fullName' },
            { header: 'Status', dataKey: 'status' },
            { header: 'Time In', dataKey: 'timeIn' }
          ];
          const rows = (data.rows || []).map(r => ({ studentId: r.studentId || r.id || '', fullName: r.fullName || r.studentName || '', status: r.status || r.attendanceStatus || 'Absent', timeIn: r.timeIn || r.time || '' }));

          // Start table below header
          doc.autoTable({
            startY: 150,
            head: [columns.map(c=>c.header)],
            body: rows.map(r=>columns.map(c=>r[c.dataKey])),
            styles: { fontSize: 10 },
            headStyles: { fillColor: [30, 64, 60] }
          });

          doc.save('Attendance_Report.pdf');
        } catch (err) {
          console.error(err);
          alert('Failed to export PDF. Ensure browser allows loading external scripts.');
        }
      });

    }catch(err){
      content.innerHTML = '<div class="text-center text-red-400 py-8">Failed to load attendance details</div>';
      console.error(err);
    }
  }

  function cardHtml(title, value, color){
    const colorMap = { blue:'blue', green:'green', red:'red', amber:'amber' };
    return `<div class="attendance-summary-card card"><div class="card-header"><div><p class="card-title">${escapeHtml(title)}</p><h2 class="text-3xl font-bold text-white">${escapeHtml(String(value||0))}</h2></div><div class="card-icon ${colorMap[color]||'blue'}"><i class="fas fa-chart-pie"></i></div></div></div>`;
  }

  function closeAttendanceSessionModal(){
    const modal = document.getElementById('attendanceSessionModal');
    if(modal) modal.classList.add('hidden');
    try{ document.body.classList.remove('modal-open'); }catch(e){}
  }
  window.closeAttendanceSessionModal = closeAttendanceSessionModal;

  function filterAttendanceTable() {
    currentPage = 1;
    renderSessions(allSessions);
  }

  // initial load
  document.addEventListener('DOMContentLoaded', ()=>{
    fetchSessions();
    
    // Search filter
    const searchInput = document.getElementById('attendanceSearch');
    if(searchInput){
      searchInput.addEventListener('input', (e)=>{
        activeSearchText = e.target.value;
        filterAttendanceTable();
      });
    }
    
    // Campus filter
    const campusFilter = document.getElementById('attendanceCampusFilter');
    if(campusFilter){
      campusFilter.addEventListener('change', (e)=>{
        activeCampusFilter = e.target.value;
        filterAttendanceTable();
      });
    }
    
    // Laboratory filter
    const labFilter = document.getElementById('attendanceLabFilter');
    if(labFilter){
      labFilter.addEventListener('change', (e)=>{
        activeLabFilter = e.target.value;
        filterAttendanceTable();
      });
    }
    
    // Date filter
    const dateFilter = document.getElementById('attendanceDateFilter');
    if(dateFilter){
      dateFilter.addEventListener('change', (e)=>{
        activeDateFilter = e.target.value;
        filterAttendanceTable();
      });
    }
  });
})();
