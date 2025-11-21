/**
 * File: admin.js
 * Description: Complete Admin Panel Logic for Enrollment System
 * Features: Application Review, Rejection Emails, Inquiry Management, Announcements, Security, Real-Time Notifications
 */

// =========================================================================
// 1. GLOBAL VARIABLES & CONSTANTS
// =========================================================================

// Data Stores
let allApplications = [];
let allInquiries = [];

// State Filters
let currentGradeLevel = 'ALL'; 
let currentStudentType = 'ALL'; // Values: 'ALL', 'NEW', 'OLD'
let currentSortKey = 'created_at'; 
let currentSortDir = 'desc'; 

// Real-Time Monitoring State
let lastKnownApplicationCount = 0;
let isFirstLoad = true;
const POLLING_INTERVAL = 5000; // Check for updates every 5 seconds

// Server Configuration
const SERVER_URL = 'https://enrollment-system-production-6820.up.railway.app'; 

// --- DOM ELEMENTS ---

// Modals
const detailsModalEl = document.getElementById('details-modal');
const detailsModal = new bootstrap.Modal(detailsModalEl); 
const inquiryModalEl = document.getElementById('inquiry-modal');
const inquiryModal = new bootstrap.Modal(inquiryModalEl);

// Application Action Buttons
const modalSendCredentialsBtn = document.getElementById('modal-send-credentials-btn');
const modalApproveBtn = document.getElementById('modal-approve-btn');
const modalRejectBtn = document.getElementById('modal-reject-btn');
const modalDeleteBtn = document.getElementById('modal-delete-btn'); 

// Inquiry Action Buttons
const btnSendReply = document.getElementById('btn-send-reply');

// =========================================================================
// 2. INITIALIZATION & SECURITY
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log("Admin Panel Initializing...");
    checkAdminAuthentication(); 
});

function getAdminToken() {
    return localStorage.getItem('adminToken');
}

function checkAdminAuthentication() {
    const token = getAdminToken();
    if (!token) {
        console.warn("No admin token found. Redirecting to login.");
        window.location.href = 'admin-login.html';
        return;
    }
    // If authenticated, load the dashboard content
    loadAdminContent(); 
}

function loadAdminContent() {
    // 1. Initialize Event Listeners
    addLogoutListener();
    addTabListeners();
    addFilterListeners(); 
    addSortListeners(); 
    addModalListeners(); 
    
    // 2. Load Data from Server
    simulateDataLoad();         // Fetches Applications
    loadInquiries();            // Fetches Inquiries
    loadCurrentAnnouncements(); // Fetches Announcements
    setupEnrollmentToggle();    // Checks Enrollment Status
    
    // 3. Initialize Forms
    const announcementForm = document.getElementById('create-announcement-form');
    if (announcementForm) {
        announcementForm.addEventListener('submit', handleAnnouncementSubmission);
    }

    const passwordForm = document.getElementById('change-password-form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', handlePasswordChange);
    }
    
    // 4. Trigger Animations
    setTimeout(animateQuickStats, 500); 

    // 5. Start Real-Time Monitoring (Heartbeat)
    startRealTimeMonitoring();
}

// --- UTILITY: Notification System ---
function showNotification(message, type) {
  const notification = document.getElementById('notification-bar');
  if (!notification) return;
  
  notification.textContent = message;
  notification.className = `notification-bar ${type}`;
  notification.classList.add('show');
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 4000); 
}

// --- UTILITY: Stats Animation ---
function animateQuickStats() {
    const statCards = document.querySelectorAll('.quick-stats .stat-card');
    statCards.forEach((card, index) => {
        setTimeout(() => {
            card.classList.add('animate-in');
        }, 150 * index); 
    });
}

// =========================================================================
// 3. DATA FETCHING (APPLICATIONS)
// =========================================================================

async function simulateDataLoad() {
    const tableBody = document.getElementById('applications-tbody');
    // Only show loading spinner on the very first load, not during background updates
    if (isFirstLoad) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4">Loading applications from server...</td></tr>';
    }

    try {
        const response = await fetch(`${SERVER_URL}/get-applications`);
        const data = await response.json();

        if (data.success) {
            allApplications = data.applications;

            // Sync the counter so we don't trigger alerts on the initial page load
            if (isFirstLoad) {
                lastKnownApplicationCount = allApplications.length;
                isFirstLoad = false;
            }

            updateQuickStats();
            applyFiltersAndDisplay(); 
        } else {
            if (isFirstLoad) tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-danger">Failed to load applications.</td></tr>';
        }
        
    } catch (error) {
        console.error('Error connecting to server:', error);
        if (isFirstLoad) tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-danger">Connection error. Is the server running?</td></tr>';
    }
}

function updateQuickStats() {
    if (allApplications.length === 0) {
        document.getElementById('stat-total').textContent = 0;
        document.getElementById('stat-pending').textContent = 0;
        document.getElementById('stat-approved').textContent = 0;
        return;
    }

    document.getElementById('stat-total').textContent = allApplications.length;
    document.getElementById('stat-pending').textContent = allApplications.filter(app => app.status === 'Pending Review').length;
    document.getElementById('stat-approved').textContent = allApplications.filter(app => app.status === 'Approved').length;
}

// =========================================================================
// 4. FILTERING, SORTING & RENDERING (APPLICATIONS)
// =========================================================================

function applyFiltersAndDisplay() {
    const searchName = document.getElementById('name-search').value.toLowerCase();
    const statusFilter = document.getElementById('status-filter').value;
    
    // --- FILTER LOGIC ---
    let filteredApps = allApplications.filter(app => {
        // 1. Grade Level Filter
        if (currentGradeLevel !== 'ALL' && app.grade_level != currentGradeLevel) {
            return false;
        }

        // 2. Student Type Filter (NEW vs OLD)
        if (currentStudentType === 'NEW' && app.is_old_student === 1) return false;
        if (currentStudentType === 'OLD' && app.is_old_student === 0) return false;

        // 3. Status Filter
        if (statusFilter !== 'All' && app.status !== statusFilter) {
            return false;
        }

        // 4. Search Bar Filter
        if (searchName) {
            const fullName = `${app.first_name} ${app.last_name}`.toLowerCase();
            const email = app.email.toLowerCase();
            // Check if search matches name OR email
            if (!fullName.includes(searchName) && !email.includes(searchName)) {
                return false;
            }
        }

        return true;
    });
    
    // --- SORT LOGIC ---
    filteredApps.sort((a, b) => compare(a, b, currentSortKey, currentSortDir));
    
    // --- RENDER ---
    displayTableContent(filteredApps);
}

// Helper: Sort Comparator
function compare(a, b, key, dir) {
    let valA = a[key];
    let valB = b[key];

    if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
    }
    
    // Numeric sort for Grade Level
    if (key === 'grade_level') {
        valA = parseInt(valA, 10) || 0;
        valB = parseInt(valB, 10) || 0;
    }

    let comparison = 0;
    if (valA > valB) comparison = 1;
    else if (valA < valB) comparison = -1;

    return dir === 'desc' ? comparison * -1 : comparison;
}

// Helper: Render Table
function displayTableContent(applicationsToDisplay) {
    const tableBody = document.getElementById('applications-tbody');
    
    if (applicationsToDisplay.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No matching applications found.</td></tr>`;
        return;
    }
    
    tableBody.innerHTML = ''; 
    
    applicationsToDisplay.forEach(app => {
      const row = document.createElement('tr');
      // Use ID for row highlighting later
      row.setAttribute('data-row-id', app.id);

      const formattedDate = new Date(app.created_at || Date.now()).toLocaleDateString(); 
      
      // Badge logic for New vs Old
      const typeBadge = app.is_old_student 
          ? '<span class="badge bg-primary">Old Student</span>' 
          : '<span class="badge bg-info text-dark">New Student</span>';

      // --- SMART GRADE DISPLAY LOGIC ---
      const gradeNum = parseInt(app.grade_level.toString().replace(/\D/g, ''), 10);
      let gradeDisplay = `Grade ${gradeNum}`; // Default

      // If Old Student and Grade > 7, append text
      if (!isNaN(gradeNum) && app.is_old_student && gradeNum > 7) {
          gradeDisplay = `
            <div style="line-height: 1.2;">
                <strong>Grade ${gradeNum}</strong>
                <div class="text-muted small" style="font-size: 0.75rem; font-style: italic; margin-top: 2px;">
                    (enrolled up from Grade ${gradeNum - 1})
                </div>
            </div>
          `;
      }

      row.innerHTML = `
        <td><span class="fw-bold">${app.first_name} ${app.last_name}</span></td>
        <td>${app.email}</td>
        <td>${typeBadge}</td>
        <td>${gradeDisplay}</td>
        <td><span class="status-pill status-${app.status.replace(/ /g, '')}">${app.status}</span></td>
        <td>${formattedDate}</td>
        <td class="actions">
          <button class="action-btn view-details-btn" data-id="${app.id}">View Details</button>
        </td>
      `;
      tableBody.appendChild(row);
    });

    // Attach Event Listeners to "View Details" buttons
    document.querySelectorAll('#applications-table .view-details-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            showApplicationDetails(id);
        });
    });
}

// =========================================================================
// 5. APPLICATION MODAL LOGIC (SMART DISPLAY)
// =========================================================================

async function showApplicationDetails(appId) {
    const detailsDiv = document.getElementById('application-details');
    detailsDiv.innerHTML = '<p class="text-center">Loading details from server...</p>'; 

    // Assign ID to all action buttons in the modal footer
    modalApproveBtn.setAttribute('data-id', appId);
    modalRejectBtn.setAttribute('data-id', appId);
    modalDeleteBtn.setAttribute('data-id', appId);
    modalSendCredentialsBtn.setAttribute('data-id', appId); 

    try {
        const response = await fetch(`${SERVER_URL}/get-application-details/${appId}`);
        const data = await response.json();

        if (!data.success) {
            detailsDiv.innerHTML = `<p class="text-danger">Error: ${data.message}</p>`;
            return;
        }

        const fullApp = data.application;
        const isOldStudent = fullApp.is_old_student === 1; 
        const birthdate = new Date(fullApp.birthdate || fullApp.bday || '2000-01-01').toLocaleDateString();
        
        const gradeNum = parseInt(fullApp.grade_level.toString().replace(/\D/g, ''), 10);

        const isApproved = fullApp.status === 'Approved';
        const hasCredentials = !!fullApp.student_username; 

        // --- BUTTON VISIBILITY LOGIC ---
        modalApproveBtn.style.display = isApproved ? 'none' : 'inline-block';
        modalRejectBtn.style.display = isApproved ? 'none' : 'inline-block';
        
        if (isOldStudent) {
            modalSendCredentialsBtn.style.display = 'none';
        } else {
            modalSendCredentialsBtn.style.display = (!isApproved && !hasCredentials) ? 'inline-block' : 'none';
        }

        // --- CREDENTIALS DISPLAY SECTION ---
        let loginDetailsHtml = '';
        if (hasCredentials) {
            loginDetailsHtml = `
                <div class="user-credentials">
                    <p><strong>Student Login Details:</strong></p>
                    <div><strong>Username:</strong> <code>${fullApp.student_username}</code></div>
                    <div><strong>Password:</strong> <code>${fullApp.student_password}</code></div>
                    <p class="note">Note: These credentials have been sent to the student.</p>
                </div>
                <hr>`;
        }

        // --- DOCUMENT DISPLAY LOGIC (NEW vs OLD) ---
        let documentsHtml = '';
        
        if (isOldStudent) {
            documentsHtml = `
                <h5 class="mt-3 text-primary border-bottom pb-2">Current Re-Enrollment Requirement:</h5>
                <div class="mb-3 p-3 border rounded bg-light shadow-sm">
                    <a href="${SERVER_URL}/uploads/${fullApp.doc_card_path}" target="_blank" class="text-decoration-none fw-bold text-dark d-flex align-items-center">
                        <i class="fa-solid fa-file-pdf text-danger fs-4 me-2"></i> 
                        <span>View Latest Report Card (Grade ${gradeNum - 1})</span>
                    </a>
                </div>
                
                <h6 class="text-muted mt-4 mb-2">Original Admission Documents (Archive):</h6>
                <div class="list-group list-group-flush small">
                    <a href="${SERVER_URL}/uploads/${fullApp.doc_psa_path}" target="_blank" class="list-group-item list-group-item-action text-muted">
                        <i class="fa-solid fa-file me-2"></i> Original PSA Birth Certificate
                    </a>
                    <a href="${SERVER_URL}/uploads/${fullApp.doc_f137_path}" target="_blank" class="list-group-item list-group-item-action text-muted">
                        <i class="fa-solid fa-file me-2"></i> Original Form 137
                    </a>
                    <a href="${SERVER_URL}/uploads/${fullApp.doc_brgy_cert_path}" target="_blank" class="list-group-item list-group-item-action text-muted">
                        <i class="fa-solid fa-file me-2"></i> Original Barangay Certificate
                    </a>
                </div>
            `;
        } else {
            documentsHtml = `
                <h5 class="mt-3 text-success">New Student Requirements:</h5>
                <div class="list-group">
                    <a href="${SERVER_URL}/uploads/${fullApp.doc_card_path}" target="_blank" class="list-group-item list-group-item-action">
                        <i class="fa-solid fa-id-card me-2"></i> View School Card
                    </a>
                    <a href="${SERVER_URL}/uploads/${fullApp.doc_psa_path}" target="_blank" class="list-group-item list-group-item-action">
                        <i class="fa-solid fa-file-lines me-2"></i> View PSA Birth Certificate
                    </a>
                    <a href="${SERVER_URL}/uploads/${fullApp.doc_f137_path}" target="_blank" class="list-group-item list-group-item-action">
                        <i class="fa-solid fa-book me-2"></i> View Form 137
                    </a>
                    <a href="${SERVER_URL}/uploads/${fullApp.doc_brgy_cert_path}" target="_blank" class="list-group-item list-group-item-action">
                        <i class="fa-solid fa-building me-2"></i> View Brgy Certificate
                    </a>
                </div>
            `;
        }

        // --- RENDER FINAL HTML ---
        detailsDiv.innerHTML = `
            <h3 class="${isOldStudent ? 'text-primary' : 'text-success'} mb-3">
                ${isOldStudent ? '<i class="fa-solid fa-user-clock"></i> Re-Enrollment Application' : '<i class="fa-solid fa-user-plus"></i> New Student Application'}
            </h3>
            
            <div class="row mb-2">
                <div class="col-md-6"><strong>Applicant:</strong> ${fullApp.first_name} ${fullApp.last_name}</div>
                <div class="col-md-6"><strong>Status:</strong> <span class="status-pill status-${fullApp.status.replace(/ /g, '')}">${fullApp.status}</span></div>
            </div>
            <hr>

            <div class="row gy-2">
                <div class="col-md-6"><strong>Target Grade:</strong> Grade ${gradeNum}</div>
                <div class="col-md-6"><strong>Birthdate:</strong> ${birthdate}</div>
                <div class="col-md-6"><strong>Email:</strong> ${fullApp.email}</div>
                <div class="col-md-6"><strong>Phone:</strong> ${fullApp.phone || 'N/A'}</div>
                <div class="col-md-12"><strong>ID:</strong> ${fullApp.id}</div>
            </div>
            
            <div class="mt-3">
                ${documentsHtml}
            </div>
            <div class="mt-3">
                ${loginDetailsHtml}
            </div>
        `;

        detailsModal.show(); 

    } catch (error) {
        console.error('Error fetching details:', error);
        detailsDiv.innerHTML = '<p class="text-danger">Error loading details. Please check your internet connection.</p>';
        detailsModal.show(); 
    }
}

// =========================================================================
// 6. ACTIONS & TOGGLES
// =========================================================================

async function updateStatus(newStatus) {
    const appId = modalApproveBtn.getAttribute('data-id');
    let rejectionReason = "";

    // 1. If Rejecting, ask for a reason (to send in the email)
    if (newStatus === 'Rejected') {
        rejectionReason = prompt("Please enter the reason for rejection (this will be emailed to the student):", "Incomplete documents");
        
        // If admin clicks 'Cancel' on the prompt, stop the process
        if (rejectionReason === null) return; 
    }

    modalApproveBtn.disabled = true;
    modalRejectBtn.disabled = true;
    
    try {
        // 2. Send Status + Reason to Server
        const response = await fetch(`${SERVER_URL}/update-application-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                applicationId: appId, 
                newStatus: newStatus,
                rejectionReason: rejectionReason // NEW: Sending reason to backend
            })
        });
        const data = await response.json();

        if (data.success) {
            // 3. Success Notification
            if (newStatus === 'Rejected') {
                showNotification(`Application Rejected. Email sent with reason: "${rejectionReason}"`, 'info');
            } else {
                showNotification(data.message, 'success');
            }
            
            detailsModal.hide(); 
            simulateDataLoad(); 
        } else {
            showNotification(`Error: ${data.message}`, 'error');
        }

    } catch (error) {
        console.error('Update Error:', error);
        showNotification('Network error. Status not saved.', 'error');
    } finally {
        modalApproveBtn.disabled = false;
        modalRejectBtn.disabled = false;
    }
}

// --- Enrollment Toggle Logic ---
async function setupEnrollmentToggle() {
    const toggle = document.getElementById('enrollment-toggle');
    const label = document.getElementById('enrollment-toggle-label');

    if (!toggle || !label) return;

    // Check initial status
    try {
        const response = await fetch(`${SERVER_URL}/get-enrollment-status`);
        const data = await response.json();
        if (data.success) {
            toggle.checked = data.isOpen;
            updateToggleUI(data.isOpen);
        }
    } catch (err) { console.error(err); }

    // Listen for change
    toggle.addEventListener('change', async () => {
        const isOpen = toggle.checked;
        updateToggleUI(isOpen);

        try {
            const response = await fetch(`${SERVER_URL}/toggle-enrollment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isOpen })
            });
            const data = await response.json();
            if (data.success) {
                showNotification(data.message, isOpen ? 'success' : 'info');
            }
        } catch (err) {
            showNotification("Network Error.", 'error');
            // Revert UI on error
            toggle.checked = !isOpen;
            updateToggleUI(!isOpen);
        }
    });

    function updateToggleUI(isOpen) {
        if (isOpen) {
            label.textContent = "Enrollment Action Center: OPEN";
            label.style.color = "var(--approved-color)";
        } else {
            label.textContent = "Enrollment Action Center: CLOSED";
            label.style.color = "var(--rejected-color)";
        }
    }
}

// =========================================================================
// 7. INQUIRY MANAGEMENT
// =========================================================================

async function loadInquiries() {
    const tbody = document.getElementById('inquiries-tbody');
    
    try {
        const response = await fetch(`${SERVER_URL}/get-inquiries`);
        const data = await response.json();
        
        if (data.success) {
            allInquiries = data.inquiries;
            displayInquiries(allInquiries);
            updateInquiryStats();
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Failed to load.</td></tr>';
        }
    } catch (error) {
        console.error("Inquiry Error:", error);
    }
}

function displayInquiries(inquiries) {
    const tbody = document.getElementById('inquiries-tbody');
    tbody.innerHTML = '';
    
    if (inquiries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No inquiries found.</td></tr>';
        return;
    }

    inquiries.forEach(inquiry => {
        const tr = document.createElement('tr');
        const date = new Date(inquiry.created_at).toLocaleDateString();
        const badgeClass = inquiry.status === 'Pending' ? 'status-Pending' : 'status-Replied';
        
        tr.innerHTML = `
            <td>${inquiry.sender_name}</td>
            <td>${inquiry.sender_email}</td>
            <td>${inquiry.subject}</td>
            <td>${date}</td>
            <td><span class="status-pill ${badgeClass}">${inquiry.status}</span></td>
            <td>
                <button class="action-btn view-details-btn" onclick="showInquiryDetails(${inquiry.id})">
                   Reply
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updateInquiryStats() {
    const pending = allInquiries.filter(i => i.status === 'Pending').length;
    document.getElementById('stat-inquiries').textContent = pending;
}

function applyInquiryFilters() {
    const search = document.getElementById('inquiry-search').value.toLowerCase();
    const status = document.getElementById('inquiry-status-filter').value;
    
    let filtered = allInquiries.filter(i => {
        if (status !== 'All' && status === 'Pending' && i.status !== 'Pending') return false;
        if (status !== 'All' && status === 'Replied' && (i.status === 'Pending')) return false;
        
        if (search && 
            !i.sender_name.toLowerCase().includes(search) && 
            !i.subject.toLowerCase().includes(search)) return false;
            
        return true;
    });
    displayInquiries(filtered);
}

// --- Inquiry Modal Logic ---
window.showInquiryDetails = function(id) {
    const inquiry = allInquiries.find(i => i.id === id);
    if (!inquiry) return;
    
    document.getElementById('modal-inquiry-name').textContent = inquiry.sender_name;
    document.getElementById('modal-inquiry-email').textContent = inquiry.sender_email;
    document.getElementById('modal-inquiry-subject').textContent = inquiry.subject;
    document.getElementById('modal-inquiry-date').textContent = new Date(inquiry.created_at).toLocaleString();
    document.getElementById('modal-inquiry-message').textContent = inquiry.message;
    
    const attachDiv = document.getElementById('modal-inquiry-attachment');
    if (inquiry.attachment_path) {
        attachDiv.classList.remove('d-none');
        attachDiv.querySelector('a').href = `${SERVER_URL}/uploads/${inquiry.attachment_path}`;
    } else {
        attachDiv.classList.add('d-none');
    }
    
    document.getElementById('reply-message').value = '';
    btnSendReply.setAttribute('data-id', id);
    inquiryModal.show();
};

// Send Reply
btnSendReply.addEventListener('click', async () => {
    const id = btnSendReply.getAttribute('data-id');
    const message = document.getElementById('reply-message').value;
    const markResolved = document.getElementById('mark-resolved').checked;
    
    if (!message.trim()) {
        alert("Please type a reply message.");
        return;
    }
    
    btnSendReply.textContent = "Sending...";
    btnSendReply.disabled = true;
    
    try {
        const response = await fetch(`${SERVER_URL}/reply-inquiry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                inquiryId: id, 
                replyMessage: message, 
                status: markResolved ? 'Replied' : 'Pending' 
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification("Reply sent successfully!", "success");
            inquiryModal.hide();
            loadInquiries(); // Refresh list
        } else {
            alert("Error: " + data.message);
        }
    } catch (e) {
        console.error(e);
        alert("Failed to send reply.");
    } finally {
        btnSendReply.textContent = "Send Reply";
        btnSendReply.disabled = false;
    }
});

// =========================================================================
// 8. ANNOUNCEMENT MANAGEMENT
// =========================================================================

async function loadCurrentAnnouncements() {
    const listEl = document.getElementById('current-announcements-list');
    listEl.innerHTML = '<li>Fetching announcements...</li>';

    try {
        const response = await fetch(`${SERVER_URL}/get-announcements`);
        const data = await response.json();

        if (data.success && data.announcements.length > 0) {
            listEl.innerHTML = '';
            data.announcements.forEach(ann => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <div style="flex-grow: 1;">
                        <strong>${ann.title}</strong>
                        <p class="mb-0 text-muted small">${new Date(ann.created_at).toLocaleDateString()}</p>
                    </div>
                    <button class="action-btn-danger delete-ann-btn" onclick="deleteAnnouncement(${ann.id})">Delete</button>
                `;
                li.style.display = 'flex';
                li.style.justifyContent = 'space-between';
                li.style.alignItems = 'center';
                li.style.padding = '10px';
                li.style.borderBottom = '1px solid #eee';
                listEl.appendChild(li);
            });
        } else {
            listEl.innerHTML = '<li>No announcements have been published yet.</li>';
        }
    } catch (error) {
        listEl.innerHTML = '<li>Error loading announcements.</li>';
    }
}

// Expose function globally for onclick attribute
window.deleteAnnouncement = async function(announcementId) {
    if (!confirm('Are you sure you want to permanently delete this announcement?')) return;

    try {
        const response = await fetch(`${SERVER_URL}/delete-announcement`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ announcementId })
        });
        const data = await response.json();
        
        if (data.success) {
            showNotification(data.message, 'success');
            loadCurrentAnnouncements(); 
        } else {
            showNotification(`Deletion Error: ${data.message}`, 'error');
        }
    } catch (error) {
        showNotification('Network error.', 'error');
    }
};

async function handleAnnouncementSubmission(e) {
    e.preventDefault();
    const form = e.target;
    const title = document.getElementById('announcement-title').value;
    const content = document.getElementById('announcement-content').value;
    const submitBtn = form.querySelector('button[type="submit"]');

    submitBtn.textContent = 'Publishing...';
    submitBtn.disabled = true;

    try {
        const response = await fetch(`${SERVER_URL}/create-announcement`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(data.message, 'success');
            form.reset();
            loadCurrentAnnouncements(); 
        } else {
            showNotification(`Error: ${data.message}`, 'error');
        }
    } catch (error) {
        showNotification('Network error. Failed to publish announcement.', 'error');
    } finally {
        submitBtn.textContent = 'Publish Announcement';
        submitBtn.disabled = false;
    }
}

// =========================================================================
// 9. PASSWORD CHANGE & AUTHENTICATION HELPERS
// =========================================================================

async function handlePasswordChange(e) {
    e.preventDefault();
    const form = e.target;
    const username = localStorage.getItem('adminUsername');

    if (!username) {
        showNotification('Session error. Please logout and login again.', 'error');
        return;
    }

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const submitBtn = form.querySelector('button[type="submit"]');
    const messageEl = document.getElementById('password-message');

    if (newPassword !== confirmPassword) {
        messageEl.textContent = 'New passwords do not match!';
        messageEl.style.color = 'red';
        return;
    }
    if (newPassword.length < 6) {
        messageEl.textContent = 'New password must be at least 6 characters long.';
        messageEl.style.color = 'red';
        return;
    }

    submitBtn.textContent = 'Changing Password...';
    submitBtn.disabled = true;
    messageEl.textContent = '';

    try {
        const response = await fetch(`${SERVER_URL}/admin-change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, currentPassword, newPassword }) 
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(data.message, 'success');
            messageEl.textContent = '✅ Password changed successfully!';
            messageEl.style.color = 'green';
            form.reset();
        } else {
            messageEl.textContent = `❌ ${data.message}`;
            messageEl.style.color = 'red';
        }
    } catch (error) {
        showNotification('Network error. Failed to change password.', 'error');
        messageEl.textContent = '❌ Network error occurred.';
        messageEl.style.color = 'red';
    } finally {
        submitBtn.textContent = 'Change Password';
        submitBtn.disabled = false;
    }
}

function addLogoutListener() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if(confirm("Are you sure you want to logout?")) {
                localStorage.removeItem('adminToken');
                showNotification('Logging out...', 'success');
                setTimeout(() => {
                    window.location.href = 'admin-login.html'; 
                }, 1500);
            }
        });
    }
}

// =========================================================================
// 10. EVENT LISTENER MANAGERS (FILTERS, TABS, SORTS)
// =========================================================================

function addTabListeners() {
    // Main Navigation Tabs
    document.querySelectorAll('.main-tab-button').forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll('.main-tab-button').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            
            const targetContentId = `content-${e.target.getAttribute('data-content')}`;
            document.querySelectorAll('.main-content-section').forEach(section => {
                section.style.display = 'none';
            });
            document.getElementById(targetContentId).style.display = 'block';
        });
    });

    // Grade Tabs
    document.querySelectorAll('.grade-tabs .tab-button').forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll('.grade-tabs .tab-button').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            currentGradeLevel = e.target.getAttribute('data-grade');
            applyFiltersAndDisplay(); 
        });
    });

    // Student Type Tabs
    document.querySelectorAll('.type-tabs .tab-button').forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll('.type-tabs .tab-button').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            currentStudentType = e.target.getAttribute('data-type');
            applyFiltersAndDisplay(); 
        });
    });
}

function addFilterListeners() {
    // Application Filters
    document.getElementById('name-search').addEventListener('input', applyFiltersAndDisplay);
    document.getElementById('status-filter').addEventListener('change', applyFiltersAndDisplay);
    
    // Inquiry Filters
    const inqSearch = document.getElementById('inquiry-search');
    if(inqSearch) inqSearch.addEventListener('input', applyInquiryFilters);
    
    const inqFilter = document.getElementById('inquiry-status-filter');
    if(inqFilter) inqFilter.addEventListener('change', applyInquiryFilters);
}

function addSortListeners() {
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => {
            const newKey = header.getAttribute('data-sort');
            if (newKey === currentSortKey) {
                currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortKey = newKey;
                currentSortDir = 'asc';
            }
            applyFiltersAndDisplay(); 
        });
    });
}

// =========================================================================
// 11. GLOBAL MODAL ACTION LISTENERS
// =========================================================================

function addModalListeners() {
    // 1. Delete Button Listener
    if (modalDeleteBtn) {
        modalDeleteBtn.addEventListener('click', async () => {
            const appId = modalDeleteBtn.getAttribute('data-id');
            if (!appId) return;

            if (!confirm("Are you sure you want to PERMANENTLY delete this applicant? This cannot be undone.")) return;
            
            try {
                const response = await fetch(`${SERVER_URL}/delete-application`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ applicationId: appId })
                });
                const data = await response.json();
                
                if (data.success) {
                    showNotification(data.message, 'success');
                    detailsModal.hide();
                    simulateDataLoad();
                } else {
                    showNotification(data.message, 'error');
                }
            } catch (e) {
                showNotification("Deletion failed.", 'error');
            }
        });
    }

    // 2. Approve Button Listener
    if (modalApproveBtn) {
        modalApproveBtn.addEventListener('click', () => {
            const appId = modalApproveBtn.getAttribute('data-id');
            if (appId) updateStatus('Approved');
        });
    }

    // 3. Reject Button Listener
    if (modalRejectBtn) {
        modalRejectBtn.addEventListener('click', () => {
            const appId = modalRejectBtn.getAttribute('data-id');
            if (appId) updateStatus('Rejected');
        });
    }

    // 4. Send Credentials Button Listener
    if (modalSendCredentialsBtn) {
        modalSendCredentialsBtn.addEventListener('click', async () => {
            const appId = modalSendCredentialsBtn.getAttribute('data-id');
            if (!appId) return;
            
            if (!confirm("Send credentials now?")) return;
            
            modalSendCredentialsBtn.disabled = true;
            modalSendCredentialsBtn.textContent = "Sending...";
            
            try {
                const res = await fetch(`${SERVER_URL}/generate-credentials`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ applicationId: appId })
                });
                const data = await res.json();
                if (data.success) {
                    showNotification("Credentials Sent!", "success");
                    // Refresh modal to ensure UI state updates (e.g., hide button if needed)
                    showApplicationDetails(appId); 
                } else {
                    showNotification(data.message, "error");
                }
            } catch(e) {
                showNotification("Failed to send credentials.", "error");
            } finally {
                modalSendCredentialsBtn.disabled = false;
                modalSendCredentialsBtn.textContent = "Send Credentials";
            }
        });
    }
}

// =========================================================================
// 12. REAL-TIME NOTIFICATION SYSTEM
// =========================================================================

function startRealTimeMonitoring() {
    // Poll the server every 5 seconds (POLLING_INTERVAL)
    setInterval(async () => {
        try {
            // 1. Silent Fetch (does not show loading spinners)
            const response = await fetch(`${SERVER_URL}/get-applications`);
            const data = await response.json();

            if (data.success) {
                checkForNewApplications(data.applications);
            }
        } catch (error) {
            // Silent fail: we don't want to annoy admin with connection errors every 5 seconds
            console.warn("Real-time sync skipped due to connection issue.");
        }
    }, POLLING_INTERVAL);
}

function checkForNewApplications(newServerData) {
    // If this is the very first load or a manual refresh just happened, just sync count
    if (isFirstLoad) {
        lastKnownApplicationCount = newServerData.length;
        isFirstLoad = false;
        return;
    }

    // Check if we have MORE applications than before
    if (newServerData.length > lastKnownApplicationCount) {
        
        // Identify exactly which applications are new
        const currentIds = new Set(allApplications.map(app => app.id));
        const newEntries = newServerData.filter(app => !currentIds.has(app.id));

        if (newEntries.length > 0) {
            // Update the Global Data Source
            allApplications = newServerData;
            lastKnownApplicationCount = newServerData.length;

            // Refresh the Table and Stats immediately
            updateQuickStats();
            applyFiltersAndDisplay();

            // Trigger Notifications for each new entry
            newEntries.forEach(app => {
                triggerNewApplicantAlert(app);
            });
        }
    } 
    // Handle edge case: If admin deleted someone, sync the count downwards so logic doesn't break next time
    else if (newServerData.length < lastKnownApplicationCount) {
        lastKnownApplicationCount = newServerData.length;
        allApplications = newServerData; // Sync silently
        updateQuickStats();
        applyFiltersAndDisplay();
    }
}

function triggerNewApplicantAlert(app) {
    // Determine text based on student type
    const typeText = app.is_old_student ? "Old Student Re-Enrollment" : "New Student Application";
    const name = `${app.first_name} ${app.last_name}`;
    
    // 1. Show Toast Notification
    showNotification(`🔔 New ${typeText}: ${name}`, 'success');

    // 2. Play a Notification Sound
    playNotificationSound();
    
    // 3. Highlight the new row
    highlightNewRow(app.id);
}

function playNotificationSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(500, audioCtx.currentTime); // Frequency
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); // Volume
        
        oscillator.start();
        setTimeout(() => oscillator.stop(), 200); // Duration
    } catch(e) {
        console.warn("Audio Context blocked or not supported.");
    }
}

function highlightNewRow(id) {
    // Wait for table to re-render then flash the row
    setTimeout(() => {
        // We rely on the data-row-id attribute we added in displayTableContent
        const row = document.querySelector(`tr[data-row-id="${id}"]`);
        
        if(row) {
             row.style.backgroundColor = "#d4edda"; // Light green flash
             row.style.transition = "background-color 1s";
             // Scroll into view if needed
             row.scrollIntoView({ behavior: 'smooth', block: 'center' });
             
             setTimeout(() => {
                 row.style.backgroundColor = "transparent";
             }, 3000);
        }
    }, 200); // Small delay to allow DOM to update
}
