window.studentSidebarConfig = {
  iconClass: 'fas fa-graduation-cap',
  logoText: 'ComLab',
  tagline: 'Student Portal',
  items: [
    { label: 'Dashboard', href: '/student/dashboard', icon: 'fas fa-house' },
    { label: 'My PC Station', href: '/my-pc-station', icon: 'fas fa-desktop' },
    { label: 'Report Issue', href: '/student/report-issue', icon: 'fas fa-exclamation-triangle' },
    { label: 'My Reports', href: '/student/my-requests', icon: 'fas fa-list-check' },
    { label: 'My Profile', href: '/student/profile', icon: 'fas fa-user' },
    { label: 'Borrow Equipment', href: '/student/borrow-equipment', icon: 'fas fa-people-carry' },
    { label: 'Logout', href: '/logout', icon: 'fas fa-right-from-bracket' }
  ]
};

window.sidebarConfig = window.sidebarConfig || window.studentSidebarConfig;
