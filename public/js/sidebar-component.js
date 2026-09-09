const defaultSidebarItems = [
  { label: 'Dashboard', href: '/admin-dashboard', icon: 'fas fa-chart-line' },
  { label: 'Maintenance Monitoring', href: '/maintenance-monitoring', icon: 'fas fa-screwdriver-wrench' },
  { label: 'Attendance Monitoring', href: '/page/attendance-monitoring', icon: 'fas fa-clipboard-check' },
  { label: 'Equipment Inventory', href: '/equipment-inventory', icon: 'fas fa-microchip' },
  { label: 'Equipment Availability', href: '/admin-dashboard#equipment-availability', icon: 'fas fa-chart-simple' },
  { label: 'Borrow Equipment', href: '/borrow-equipment', icon: 'fas fa-people-carry' },
  { label: 'Laboratory Schedules', href: '/page/laboratory-schedules', icon: 'fas fa-calendar-alt' },
  { label: 'Reports', href: '/page/reports', icon: 'fas fa-file-pdf' },
  { label: 'Audit Logs', href: '/page/audit-logs', icon: 'fas fa-shield-halved' },
  { label: 'Logout', href: '/logout', icon: 'fas fa-right-from-bracket' }
];

const defaultSidebarHeader = {
  iconClass: 'fas fa-server',
  logoText: 'ComLab',
  tagline: 'Laboratory Management'
};

function getSidebarConfig() {
  return window.sidebarConfig || {};
}

function getSidebarItems() {
  const config = getSidebarConfig();
  if (Array.isArray(config.items) && config.items.length > 0) {
    return config.items;
  }

  // Fallback: if page indicates student portal, show student-specific items
  const isStudent = config.role === 'student' || document.body.classList.contains('student-portal');
  if (isStudent) {
    return [
      { label: 'Dashboard', href: '#dashboard', icon: 'fas fa-house' },
      { label: 'My Schedule', href: '#schedule', icon: 'fas fa-calendar-days' },
      { label: 'QR Check-in', href: '#qr-checkin', icon: 'fas fa-qrcode' },
      { label: 'Announcements', href: '#announcements', icon: 'fas fa-bullhorn' },
      { label: 'My Profile', href: '#profile', icon: 'fas fa-user' },
      { label: 'Logout', href: '/logout', icon: 'fas fa-right-from-bracket' }
    ];
  }

  return defaultSidebarItems;
}

function getSidebarHeader() {
  const config = getSidebarConfig();
  return {
    ...defaultSidebarHeader,
    ...config,
  };
}

function normalizeRoute(path) {
  if (!path) return '/';
  const trimmed = String(path).trim().toLowerCase();
  if (!trimmed) return '/';
  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');
  return withoutTrailingSlash || '/';
}

function getRouteAliases() {
  return {
    '/student-dashboard': '/student/dashboard',
    '/student-profile': '/student/profile',
    '/student-report-issue': '/student/report-issue',
    '/student-my-requests': '/student/my-requests',
    '/student/dashboard': '/student/dashboard',
    '/student/profile': '/student/profile',
    '/student/report-issue': '/student/report-issue',
    '/student/my-requests': '/student/my-requests'
  };
}

function getActivePath() {
  const config = getSidebarConfig();
  const pathname = normalizeRoute(window.location.pathname);
  const hash = window.location.hash ? window.location.hash.toLowerCase() : '';
  const aliases = getRouteAliases();
  const aliasedPath = aliases[pathname] || pathname;

  if (hash) {
    return `${aliasedPath}${hash}`;
  }

  if (config.defaultActive) {
    return normalizeRoute(config.defaultActive);
  }

  if (pathname === '/' || pathname === '/dashboard') {
    return '/admin-dashboard';
  }

  return aliasedPath;
}

function updateSidebarNewReportsNotification(count) {
  const badgeCount = Number(count) || 0;
  const bells = document.querySelectorAll('[data-sidebar-bell]');
  const badges = document.querySelectorAll('[data-new-reports-badge]');

  bells.forEach((bell) => {
    bell.style.display = badgeCount > 0 ? 'inline-block' : 'none';
    bell.setAttribute('aria-hidden', badgeCount > 0 ? 'false' : 'true');
  });

  badges.forEach((badge) => {
    badge.textContent = String(badgeCount);
    badge.style.display = badgeCount > 0 ? 'inline-flex' : 'none';
  });
}

function updateBorrowNotificationBadge(count) {
  const badgeCount = Number(count) || 0;
  document.querySelectorAll('[data-borrow-notif-badge]').forEach((badge) => {
    badge.textContent = String(badgeCount);
    badge.style.display = badgeCount > 0 ? 'inline-flex' : 'none';
  });
  document.querySelectorAll('[data-borrow-notif-icon]').forEach((icon) => {
    icon.style.display = badgeCount > 0 ? 'inline-block' : 'none';
  });
}

window.syncSidebarPendingReportBadge = async function syncSidebarPendingReportBadge() {
  try {
    const response = await fetch('/api/maintenance?status=Pending', { cache: 'no-store' });
    if (!response.ok) {
      updateSidebarNewReportsNotification(0);
      return 0;
    }

    const data = await response.json();
    const pendingReports = Array.isArray(data) ? data : [];
    const unreadCount = pendingReports.filter((report) => {
      const status = String(report?.status || 'Pending').trim().toLowerCase();
      return status === 'pending' || status === 'new';
    }).length;

    updateSidebarNewReportsNotification(unreadCount);
    return unreadCount;
  } catch (error) {
    updateSidebarNewReportsNotification(0);
    return 0;
  }
};

window.syncBorrowSidebarBadge = async function syncBorrowSidebarBadge() {
  try {
    const response = await fetch('/api/borrow-records', { cache: 'no-store' });
    if (!response.ok) {
      updateBorrowNotificationBadge(0);
      return 0;
    }

    const records = await response.json();
    const pendingCount = Array.isArray(records)
      ? records.filter((record) => String(record?.status || '').trim().toLowerCase() === 'pending').length
      : 0;

    updateBorrowNotificationBadge(pendingCount);
    return pendingCount;
  } catch (error) {
    updateBorrowNotificationBadge(0);
    return 0;
  }
};

function renderSidebarComponent() {
  const container = document.getElementById('shared-sidebar');
  if (!container) return;

  const header = getSidebarHeader();
  const currentUser = window.__CURRENT_USER__ || getSidebarConfig().user || null;
  function getInitials(name) {
    const value = (name || '').trim();
    if (!value) return 'ST';
    return value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('') || 'ST';
  }
  const sidebarItems = getSidebarItems();
  const navLinks = sidebarItems.map(item => {
    const isNewReports = String(item.label || '').trim() === 'New Reports';
    const isBorrowLink = /borrow-equipment/i.test(String(item.label || '')) || /borrow-equipment/i.test(String(item.href || ''));
    const isBorrowRequests = /borrow requests/i.test(String(item.label || '')) || /borrow-requests/i.test(String(item.href || ''));
    const href = item.href || '/';
    const clickHandler = `setActive(this); closeSidebarOnMobile();`;
    const notifHtml = isBorrowRequests && (getSidebarConfig().role === 'technician' || document.body.classList.contains('technician-portal'))
      ? `<span style="margin-left:auto;display:flex;align-items:center;gap:6px">
            <i class="fas fa-bell" aria-hidden="true" style="color:#ff4d4f;font-size:0.95rem;line-height:1;opacity:0.95;display:none;" data-borrow-notif-icon></i>
            <span data-borrow-notif-badge style="display:none;min-width:18px;padding:2px 6px;border-radius:999px;background:#ff4d4f;color:#fff;font-size:0.75rem;font-weight:700;text-align:center;line-height:1;">0</span>
         </span>`
      : isNewReports && (getSidebarConfig().role === 'technician' || document.body.classList.contains('technician-portal'))
      ? `<span style="margin-left:auto;display:flex;align-items:center;gap:6px">
            <i class="fas fa-bell" aria-hidden="true" style="color:#ff4d4f;font-size:0.95rem;line-height:1;opacity:0.95;display:none;" data-sidebar-bell></i>
            <span data-new-reports-badge style="display:none;min-width:18px;padding:2px 6px;border-radius:999px;background:#ff4d4f;color:#fff;font-size:0.75rem;font-weight:700;text-align:center;line-height:1;">0</span>
         </span>`
      : isBorrowLink && (getSidebarConfig().role === 'admin' || getSidebarConfig().role === 'administrator' || document.body.classList.contains('admin-shell'))
        ? `<span style="margin-left:auto;display:flex;align-items:center;gap:6px">
              <i class="fas fa-bell" aria-hidden="true" style="color:#ff4d4f;font-size:0.95rem;line-height:1;opacity:0.95;display:none;" data-borrow-notif-icon></i>
              <span data-borrow-notif-badge style="display:none;min-width:18px;padding:2px 6px;border-radius:999px;background:#ff4d4f;color:#fff;font-size:0.75rem;font-weight:700;text-align:center;line-height:1;">0</span>
           </span>`
        : '';

    return `
      <a class="nav-item${isBorrowLink ? ' borrow-link' : ''}" href="${href}" data-open-borrow-modal="false" onclick="${clickHandler}">
        <i class="${item.icon}"></i>
        <span>${item.label}</span>
        ${notifHtml}
      </a>
    `;
  }).join('');
  const backLink = header.backRoute ? `
    <a class="nav-item sidebar-back-link" href="${header.backRoute}">
      <i class="fas fa-arrow-left"></i>
      <span>${header.backLabel || 'Back'}</span>
    </a>
  ` : '';
  const profileHtml = currentUser ? `
    <div class="sidebar-profile">
      <div class="sidebar-profile-left">
        <div class="sidebar-avatar">${currentUser.initials || getInitials(currentUser.name)}</div>
        <div class="sidebar-profile-meta">
          <div class="sidebar-profile-name">${currentUser.name || 'Student'}</div>
          <div class="sidebar-profile-role">${(currentUser.role || 'Student')}</div>
        </div>
      </div>
    </div>
  ` : '';

  container.innerHTML = `
    <div class="sidebar-overlay" id="sidebarOverlay" hidden></div>
    <div class="sidebar mobile-closed" id="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <i class="${header.iconClass}"></i>
          <span class="sidebar-logo-text">${header.logoText}</span>
        </div>
        <p class="sidebar-tagline">${header.tagline}</p>
      </div>
      ${profileHtml}
      <nav class="sidebar-nav">
        ${navLinks}
      </nav>
      ${backLink ? `<div class="sidebar-footer">${backLink}</div>` : ''}
    </div>
  `;

  if (document.body.classList.contains('technician-portal')) {
    window.syncSidebarPendingReportBadge?.();
  }
  if (getSidebarConfig().role === 'admin' || getSidebarConfig().role === 'administrator' || document.body.classList.contains('admin-shell')) {
    window.syncBorrowSidebarBadge?.();
  }
}

function setActive(elementOrHref) {
  const activePath = typeof elementOrHref === 'string'
    ? elementOrHref
    : elementOrHref.getAttribute('href');

  const allItems = document.querySelectorAll('.nav-item');
  allItems.forEach(item => item.classList.remove('active'));

  const matched = Array.from(allItems).find(item => item.getAttribute('href') === activePath);
  if (matched) {
    matched.classList.add('active');
  }
}

function markActiveItem() {
  const currentPath = getActivePath();
  const allItems = document.querySelectorAll('.nav-item');
  allItems.forEach(item => {
    const href = item.getAttribute('href');
    item.classList.toggle('active', href === currentPath);
  });
}

function bindBorrowTrigger() {
  const items = document.querySelectorAll('.nav-item[href*="borrow-equipment"]');
  items.forEach((item) => {
    item.removeEventListener('click', item.__borrowTriggerHandler);
    const handler = (event) => {
      setActive(item);
      closeSidebarOnMobile();
      const href = item.getAttribute('href');
      if (href && href !== '#') {
        if (event) {
          event.preventDefault();
        }
        window.location.assign(href);
        return false;
      }
      return true;
    };
    item.__borrowTriggerHandler = handler;
    item.addEventListener('click', handler);
  });
}

function setSidebarState(isOpen) {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (!sidebar) return;

  const shouldUseMobileLayout = window.innerWidth < 1024;
  const shouldOpen = shouldUseMobileLayout ? isOpen : true;

  sidebar.classList.toggle('mobile-open', shouldOpen);
  sidebar.classList.toggle('mobile-closed', !shouldOpen && shouldUseMobileLayout);

  if (overlay) {
    overlay.classList.toggle('active', shouldOpen && shouldUseMobileLayout);
    overlay.hidden = !(shouldOpen && shouldUseMobileLayout);
  }

  document.body.classList.toggle('sidebar-open', shouldOpen && shouldUseMobileLayout && document.body.classList.contains('student-portal'));
  // update hamburger aria state if present
  try {
    const toggleBtn = document.getElementById('mobileMenuToggle');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', String(Boolean(shouldOpen && shouldUseMobileLayout)));
  } catch (e) { /* ignore */ }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  const isOpen = sidebar.classList.contains('mobile-open');
  setSidebarState(!isOpen);
}

function closeSidebar() {
  setSidebarState(false);
}

function closeSidebarOnMobile() {
  if (window.innerWidth < 1024) {
    closeSidebar();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  renderSidebarComponent();
  markActiveItem();
  bindBorrowTrigger();
  setSidebarState(window.innerWidth >= 1024);
  window.toggleSidebar = toggleSidebar;
  window.setActive = setActive;
  window.closeSidebar = closeSidebar;
  window.closeSidebarOnMobile = closeSidebarOnMobile;
  // inject a mobile menu toggle into the page header if missing
  const ensureMobileToggle = () => {
    const existingToggle = document.getElementById('mobileMenuToggle') || document.querySelector('.menu-toggle');
    if (existingToggle) {
      existingToggle.id = existingToggle.id || 'mobileMenuToggle';
      existingToggle.type = existingToggle.type || 'button';
      existingToggle.setAttribute('aria-label', 'Open navigation');
      existingToggle.setAttribute('aria-expanded', 'false');
      existingToggle.classList.add('menu-toggle');
      existingToggle.classList.add('block');
      existingToggle.classList.add('lg:hidden');
      if (!existingToggle.hasAttribute('onclick')) {
        existingToggle.setAttribute('onclick', 'toggleSidebar()');
      }
      return;
    }

    const header = document.querySelector('.page-header-card') || document.querySelector('header');
    const btn = document.createElement('button');
    btn.id = 'mobileMenuToggle';
    btn.type = 'button';
    btn.className = 'menu-toggle block lg:hidden';
    btn.setAttribute('aria-label', 'Open navigation');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('onclick', 'toggleSidebar()');
    btn.innerHTML = '<i class="fas fa-bars"></i>';
    if (header && header.parentElement) {
      // try to insert into header area
      try { header.insertBefore(btn, header.firstChild); return; } catch (e) { /* fallthrough */ }
    }
    // fallback: append to body so it's always reachable (fixed positioned via CSS)
    document.body.appendChild(btn);
  };
  ensureMobileToggle();
  // ensure overlay click closes sidebar (defensive)
  const overlayEl = document.getElementById('sidebarOverlay');
  if (overlayEl) overlayEl.addEventListener('click', () => { closeSidebar(); const mb=document.getElementById('mobileMenuToggle'); if (mb) mb.setAttribute('aria-expanded', 'false'); });
  // ensure hamburger also toggles aria when clicked (safe hookup if toggle existed prior)
  const mobileToggleEl = document.getElementById('mobileMenuToggle');
  if (mobileToggleEl && !mobileToggleEl.dataset.hook) {
    mobileToggleEl.addEventListener('click', () => {
      const s = document.getElementById('sidebar');
      mobileToggleEl.setAttribute('aria-expanded', String(!!s && s.classList.contains('mobile-open')));
    });
    mobileToggleEl.dataset.hook = '1';
  }
});

window.addEventListener('hashchange', () => {
  markActiveItem();
});

window.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeSidebar();
  }
});

window.addEventListener('resize', () => {
  if (window.innerWidth >= 1024) {
    setSidebarState(true);
  } else {
    setSidebarState(false);
  }
});

window.addEventListener('click', event => {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (!sidebar || window.innerWidth >= 1024) return;
  const toggle = event.target.closest('[onclick="toggleSidebar()"], #mobileMenuToggle, .menu-toggle');
  if (overlay && event.target === overlay) {
    closeSidebar();
    return;
  }
  if (!sidebar.contains(event.target) && !toggle) {
    closeSidebar();
  }
});
