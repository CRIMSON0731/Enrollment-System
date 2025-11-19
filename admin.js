// Global variable to store all fetched applications & inquiries
let allApplications = [];
let allInquiries = []; // NEW: Store inquiries
let currentGradeLevel = 'ALL'; 
let currentSortKey = 'created_at'; 
let currentSortDir = 'desc'; 

// --- SECURITY CONSTANT ---
const SERVER_URL = 'https://enrollment-system-production-6820.up.railway.app'; 

// --- MODAL ELEMENTS ---
const detailsModalEl = document.getElementById('details-modal');
const detailsModal = new bootstrap.Modal(detailsModalEl); 
const modalSendCredentialsBtn = document.getElementById('modal-send-credentials-btn');
const modalApproveBtn = document.getElementById('modal-approve-btn');
const modalRejectBtn = document.getElementById('modal-reject-btn');
const modalDeleteBtn = document.getElementById('modal-delete-btn'); 

// --- NEW: Inquiry Modal Elements ---
const inquiryModalEl = document.getElementById('inquiry-modal');
const inquiryModal = new bootstrap.Modal(inquiryModalEl);
const btnSendReply = document.getElementById('btn-send-reply');

// --- NOTIFICATION FUNCTION ---
function showNotification(message, type) {
  const notification = document.getElementById('notification-bar');
  if (!notification) return;
  
  notification.textContent = message;
  notification.className = `notification-bar ${type}`;
  notification.classList.add('show');
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// =========================================================================
//                             SECURITY ENFORCEMENT
// =========================================================================

function getAdminToken() {
    return localStorage.getItem('adminToken');
}

async function checkAdminAuthentication() {
    const token = getAdminToken();
    if (!token) {
        console.log("No admin token found. Redirecting to login.");
        window.location.href = 'admin-login.html';
        return;
    }
    loadAdminContent(); 
}

function loadAdminContent() {
    addLogoutListener();
    addTabListeners();
    addFilterListeners(); 
    addSortListeners(); 
    addModalListeners(); 
    
    simulateDataLoad(); // Loads Applications
    loadInquiries();    // NEW: Loads Inquiries
    
    setupAnnouncementManagement();
    setupPasswordChange(); 
    
    setTimeout(animateQuickStats, 500); 
}

document.addEventListener('DOMContentLoaded', () => {
    checkAdminAuthentication(); 
});


// =========================================================================
//                             APPLICATION LOGIC
// =========================================================================

function animateQuickStats() {
    const statCards = document.querySelectorAll('.quick-stats .stat-card');
    statCards.forEach((card, index) => {
        setTimeout(() => {
            card.classList.add('animate-in');
        }, 150 * index); 
    });
}

// --- Announcement Management ---
function setupAnnouncementManagement() {
    loadCurrentAnnouncements(); 
    const form = document.getElementById('create-announcement-form');
    if (form) {
      form.addEventListener('submit', handleAnnouncementSubmission);
    }
}

// --- Password Change ---
function setupPasswordChange() {
    const form = document.getElementById('change-password-form');
    if (form) {
        form.addEventListener('submit', handlePasswordChange);
    }
}

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
            showNotification(`Error: ${data.message}`, 'error');
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

// --- Load Announcements ---
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
                    </div>
                    <button class="action-btn-danger delete-ann-btn" data-id="${ann.id}">Delete</button>
                `;
                li.style.display = 'flex';
                li.style.justifyContent = 'space-between';
                li.style.alignItems = 'center';
                listEl.appendChild(li);
            });
            addAnnouncementDeleteListeners(); 
        } else {
            listEl.innerHTML = '<li>No announcements have been published yet.</li>';
        }
    } catch (error) {
        listEl.innerHTML = '<li>Error loading announcements from server.</li>';
    }
}

function addAnnouncementDeleteListeners() {
    document.querySelectorAll('.delete-ann-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const annId = e.target.getAttribute('data-id');
            if (confirm('Are you sure you want to permanently delete this announcement?')) {
                deleteAnnouncement(annId);
            }
        });
    });
}

async function deleteAnnouncement(announcementId) {
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
        showNotification('Network error. Failed to delete announcement.', 'error');
    }
}

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
//                             NEW: INQUIRY LOGIC
// =========================================================================

// 1. Fetch Inquiries from Server
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
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Failed to load inquiries.</td></tr>';
        }
    } catch (error) {
        console.error("Inquiry Load Error:", error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-danger">Network error loading inquiries.</td></tr>';
    }
}

// 2. Render Inquiry Table
function displayInquiries(inquiries) {
    const tbody = document.getElementById('inquiries-tbody');
    tbody.innerHTML = '';
    
    if (inquiries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">No inquiries found.</td></tr>';
        return;
    }

    inquiries.forEach(inquiry => {
        const tr = document.createElement('tr');
        const date = new Date(inquiry.created_at).toLocaleDateString();
        // Simple badge logic
        let badgeClass = inquiry.status === 'Pending' ? 'status-Pending' : 'status-Replied';
        
        tr.innerHTML = `
            <td>${inquiry.sender_name}</td>
            <td>${inquiry.sender_email}</td>
            <td>${inquiry.subject}</td>
            <td>${date}</td>
            <td><span class="status-pill ${badgeClass}">${inquiry.status}</span></td>
            <td>
                <button class="action-btn view-details-btn" onclick="showInquiryDetails(${inquiry.id})">
                   View / Reply
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 3. Filter Logic
function applyInquiryFilters() {
    const search = document.getElementById('inquiry-search').value.toLowerCase();
    const status = document.getElementById('inquiry-status-filter').value;
    
    let filtered = allInquiries;
    
    if (status !== 'All') {
        // Map filter values to status strings if needed, or assume direct match
        // "Pending" vs "Replied"
        filtered = filtered.filter(i => {
            if (status === 'Pending') return i.status === 'Pending';
            if (status === 'Replied') return i.status === 'Replied' || i.status === 'Closed';
            return true;
        });
    }
    
    if (search) {
        filtered = filtered.filter(i => 
            i.sender_name.toLowerCase().includes(search) || 
            i.sender_email.toLowerCase().includes(search) ||
            i.subject.toLowerCase().includes(search)
        );
    }
    
    displayInquiries(filtered);
}

// 4. Show Modal Details
window.showInquiryDetails = function(id) {
    const inquiry = allInquiries.find(i => i.id === id);
    if (!inquiry) return;
    
    // Populate Modal Fields
    document.getElementById('modal-inquiry-name').textContent = inquiry.sender_name;
    document.getElementById('modal-inquiry-email').textContent = inquiry.sender_email;
    document.getElementById('modal-inquiry-subject').textContent = inquiry.subject;
    document.getElementById('modal-inquiry-date').textContent = new Date(inquiry.created_at).toLocaleString();
    document.getElementById('modal-inquiry-message').textContent = inquiry.message;
    
    // Handle Attachment
    const attachDiv = document.getElementById('modal-inquiry-attachment');
    if (inquiry.attachment_path) {
        attachDiv.classList.remove('d-none');
        attachDiv.querySelector('a').href = `${SERVER_URL}/uploads/${inquiry.attachment_path}`;
    } else {
        attachDiv.classList.add('d-none');
    }
    
    // Reset Reply Form
    document.getElementById('reply-message').value = '';
    
    // Store ID on the send button for reference
    btnSendReply.setAttribute('data-id', id);
    
    inquiryModal.show();
};

// 5. Handle Send Reply
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

function updateInquiryStats() {
    const pendingCount = allInquiries.filter(i => i.status === 'Pending').length;
    const statEl = document.getElementById('stat-inquiries');
    if (statEl) statEl.textContent = pendingCount;
}


// =========================================================================
//                             SHARED / EXISTING LOGIC
// =========================================================================

// --- Modal Listeners (UPDATED) ---
function addModalListeners() {
    modalSendCredentialsBtn.addEventListener('click', () => {
        const appId = modalSendCredentialsBtn.getAttribute('data-id');
        sendCredentialsOnly(appId);
    });
    
    modalApproveBtn.addEventListener('click', () => {
        const appId = modalApproveBtn.getAttribute('data-id');
        updateStatus(appId, 'Approved');
    });

    modalRejectBtn.addEventListener('click', () => {
        const appId = modalRejectBtn.getAttribute('data-id');
        updateStatus(appId, 'Rejected');
        detailsModal.hide(); 
    });

    modalDeleteBtn.addEventListener('click', () => {
        const appId = modalDeleteBtn.getAttribute('data-id');
        const app = allApplications.find(a => a.id == appId);
        const appName = app ? `${app.first_name} ${app.last_name}` : `ID: ${appId}`;

        if (confirm(`Are you sure you want to PERMANENTLY delete the applicant: ${appName}? This action cannot be undone.`)) {
            deleteApplicant(appId);
        }
    });
}

// --- Send Credentials Only ---
async function sendCredentialsOnly(applicationId) {
    if (!confirm('Are you sure you want to generate and send credentials? The application status will NOT be changed.')) {
        return;
    }

    modalSendCredentialsBtn.disabled = true;
    modalSendCredentialsBtn.textContent = 'Sending...';

    try {
        const response = await fetch(`${SERVER_URL}/generate-credentials`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ applicationId })
        });
        const data = await response.json();

        if (data.success) {
            showNotification('✅ Provisional credentials sent successfully! Status remains unchanged.', 'info');
            const appIndex = allApplications.findIndex(app => app.id == applicationId);
            if (appIndex !== -1 && data.student_username) {
                allApplications[appIndex].student_username = data.student_username;
                allApplications[appIndex].student_password = data.student_password;
            }
            showApplicationDetails(applicationId); 
        } else {
            showNotification(`Error sending credentials: ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('Network Error sending credentials:', error);
        showNotification('Network error. Failed to send credentials.', 'error');
    } finally {
        modalSendCredentialsBtn.disabled = false;
        modalSendCredentialsBtn.textContent = 'Send Credentials (Provisional)';
    }
}


// --- Delete Applicant ---
async function deleteApplicant(applicationId) {
    try {
        const response = await fetch(`${SERVER_URL}/delete-application`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ applicationId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(data.message, 'success');
            detailsModal.hide(); 
            simulateDataLoad(); 
        } else {
            showNotification(`Deletion Error: ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('Network Error deleting applicant:', error);
        showNotification('Network error. Failed to delete applicant.', 'error');
    }
}

// --- Logout ---
function addLogoutListener() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            showNotification('Logging out of Admin Panel...', 'success');
            
            setTimeout(() => {
                window.location.href = 'admin-login.html'; 
            }, 1500);
        });
    }
}

// --- Tabs ---
function addTabListeners() {
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

    document.querySelectorAll('.grade-tabs .tab-button').forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll('.grade-tabs .tab-button').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            currentGradeLevel = e.target.getAttribute('data-grade');
            applyFiltersAndDisplay(); 
        });
    });
}

// --- Search Filters ---
function addFilterListeners() {
    // Application Filters
    document.getElementById('name-search').addEventListener('input', applyFiltersAndDisplay);
    document.getElementById('status-filter').addEventListener('change', applyFiltersAndDisplay);
    
    // NEW: Inquiry Filters
    const inqSearch = document.getElementById('inquiry-search');
    if(inqSearch) inqSearch.addEventListener('input', applyInquiryFilters);
    
    const inqFilter = document.getElementById('inquiry-status-filter');
    if(inqFilter) inqFilter.addEventListener('change', applyInquiryFilters);
}

// --- Sorting ---
function addSortListeners() {
    document.querySelectorAll('#applications-table .sortable').forEach(header => {
        header.addEventListener('click', () => {
            const newKey = header.getAttribute('data-sort');

            if (newKey === currentSortKey) {
                currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortKey = newKey;
                currentSortDir = 'asc';
            }

            document.querySelectorAll('#applications-table th').forEach(th => {
                th.classList.remove('sorted-asc', 'sorted-desc');
            });
            header.classList.add(`sorted-${currentSortDir}`);

            applyFiltersAndDisplay(); 
        });
    });
}

function compare(a, b, key, dir) {
    let valA = a[key];
    let valB = b[key];

    if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
    }
    
    if (key === 'grade_level') {
        valA = parseInt(valA, 10);
        valB = parseInt(valB, 10);
    }

    let comparison = 0;
    if (valA > valB) {
        comparison = 1;
    } else if (valA < valB) {
        comparison = -1;
    }

    return dir === 'desc' ? comparison * -1 : comparison;
}

// --- Stats ---
function updateQuickStats() {
    if (allApplications.length === 0) {
        document.getElementById('stat-total').textContent = 0;
        document.getElementById('stat-pending').textContent = 0;
        document.getElementById('stat-approved').textContent = 0;
        // stat-rejected is now used for inquiries pending count (logic in updateInquiryStats)
        return;
    }

    const total = allApplications.length;
    const pending = allApplications.filter(app => app.status === 'Pending Review').length;
    const approved = allApplications.filter(app => app.status === 'Approved').length;
    
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-approved').textContent = approved;
}

// --- Application Filtering ---
function applyFiltersAndDisplay() {
    const searchName = document.getElementById('name-search').value.toLowerCase();
    const statusFilter = document.getElementById('status-filter').value;
    
    let filteredApps = currentGradeLevel === 'ALL' 
        ? allApplications 
        : allApplications.filter(app => app.grade_level == currentGradeLevel);

    if (statusFilter !== 'All') {
        filteredApps = filteredApps.filter(app => app.status === statusFilter);
    }
    
    if (searchName) {
        filteredApps = filteredApps.filter(app => 
            app.first_name.toLowerCase().includes(searchName) || 
            app.last_name.toLowerCase().includes(searchName) ||
            app.email.toLowerCase().includes(searchName)
        );
    }
    
    filteredApps.sort((a, b) => compare(a, b, currentSortKey, currentSortDir));
    
    displayTableContent(filteredApps, currentGradeLevel);
}

// --- Application Table Display ---
function displayTableContent(applicationsToDisplay, gradeLevel) {
    const tableBody = document.getElementById('applications-tbody');
    const gradeText = gradeLevel === 'ALL' ? 'all grade levels' : `Grade ${gradeLevel}`;
    
    if (applicationsToDisplay.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6">No matching applications found for ${gradeText}.</td></tr>`;
        return;
    }
    
    tableBody.innerHTML = ''; 
    
    applicationsToDisplay.forEach(app => {
      const row = document.createElement('tr');
      const formattedDate = new Date(app.created_at || Date.now()).toLocaleDateString(); 
      
      row.innerHTML = `
        <td>${app.first_name} ${app.last_name}</td>
        <td>${app.email}</td>
        <td>Grade ${app.grade_level}</td>
        <td><span class="status-pill status-${app.status.replace(/ /g, '')}">${app.status}</span></td>
        <td>${formattedDate}</td>
        <td class="actions">
          <button class="action-btn view-details-btn" data-id="${app.id}">View Details</button>
        </td>
      `;
      tableBody.appendChild(row);
    });

    addEventListenersToButtons(); 
}

function addEventListenersToButtons() {
    document.querySelectorAll('#applications-table .view-details-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            showApplicationDetails(id);
        });
    });
}

// --- Show Application Details ---
async function showApplicationDetails(appId) {
    const detailsDiv = document.getElementById('application-details');
    detailsDiv.innerHTML = '<p>Loading details...</p>'; 

    modalApproveBtn.setAttribute('data-id', appId);
    modalRejectBtn.setAttribute('data-id', appId);
    modalDeleteBtn.setAttribute('data-id', appId);
    modalSendCredentialsBtn.setAttribute('data-id', appId); 

    try {
        const response = await fetch(`${SERVER_URL}/get-application-details/${appId}`);
        const data = await response.json();

        if (!data.success) {
            detailsDiv.innerHTML = `<p>Error: ${data.message}</p>`;
            return;
        }

        const fullApp = data.application;
        const birthdate = new Date(fullApp.birthdate || fullApp.bday || '2000-01-01').toLocaleDateString();
        const serverUrl = SERVER_URL; 

        const isApproved = fullApp.status === 'Approved';
        const hasCredentials = !!fullApp.student_username; 

        modalApproveBtn.style.display = isApproved ? 'none' : 'inline-block';
        modalRejectBtn.style.display = isApproved ? 'none' : 'inline-block';
        modalSendCredentialsBtn.style.display = (!isApproved && !hasCredentials) ? 'inline-block' : 'none';

        let loginDetailsHtml = '';
        if (hasCredentials) {
            loginDetailsHtml = `
                <div class="user-credentials">
                    <p><strong>Student Login Details:</strong></p>
                    <div><strong>Username (Email):</strong> <code>${fullApp.student_username}</code></div>
                    <div><strong>Password:</strong> <code>${fullApp.student_password}</code></div>
                    <p class="note">These credentials have been sent to the student. Advise them to change their password upon first login.</p>
                </div>
                <hr style="margin: 20px 0; border-color: #eee;">
            `;
        }

        detailsDiv.innerHTML = `
            <h3>Applicant: ${fullApp.first_name} ${fullApp.middle_name ? fullApp.middle_name + ' ' : ''}${fullApp.last_name} (ID: ${fullApp.id})</h3>
            <p><strong>Status:</strong> <span class="status-pill status-${fullApp.status.replace(/ /g, '')}">${fullApp.status}</span></p>
            <hr style="margin: 20px 0; border-color: #eee;">

            <div><strong>Grade Level:</strong> Grade ${fullApp.grade_level}</div>
            <div><strong>Full Name:</strong> ${fullApp.first_name} ${fullApp.middle_name ? '(' + fullApp.middle_name + ') ' : ''}${fullApp.last_name}</div>
            <div><strong>Birthdate:</strong> ${birthdate}</div>
            <div><strong>Email:</strong> ${fullApp.email}</div>
            <div><strong>Phone Num#:</strong> ${fullApp.phone || 'N/A'}</div>
            
            <h4 style="margin-top: 25px; margin-bottom: 15px; color: var(--theme-green);">Required Documents:</h4>
            
            <div>
                <a href="${serverUrl}/uploads/${fullApp.doc_card_path}" target="_blank" class="file-link">View File (School Card)</a>
            </div>
            <div>
                <a href="${serverUrl}/uploads/${fullApp.doc_psa_path}" target="_blank" class="file-link">View File (PSA)</a>
            </div>
            <div>
                <a href="${serverUrl}/uploads/${fullApp.doc_f137_path}" target="_blank" class="file-link">View File (FORM 137)</a>
            </div>
            <div>
                <a href="${serverUrl}/uploads/${fullApp.doc_brgy_cert_path}" target="_blank" class="file-link">View File (BRGY CERT)</a>
            </div>

            ${loginDetailsHtml}
        `;

        detailsModal.show(); 

    } catch (error) {
        console.error('Error fetching details:', error);
        detailsDiv.innerHTML = '<p>Error loading details. Please check server connection and try again.</p>';
        detailsModal.show(); 
    }
}

// --- Update App Status ---
async function updateStatus(applicationId, newStatus) {
    const appIndex = allApplications.findIndex(app => app.id == applicationId);
    const originalStatus = allApplications[appIndex].status;

    try {
        const response = await fetch(`${SERVER_URL}/update-application-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ applicationId, newStatus })
        });
        const data = await response.json();

        if (data.success) {
            if (appIndex !== -1) {
                allApplications[appIndex].status = newStatus;
                if (newStatus === 'Approved') {
                    if (data.student_username) { 
                        allApplications[appIndex].student_username = data.student_username;
                        allApplications[appIndex].student_password = data.student_password;
                    }
                    showNotification('✅ Application Approved! Credentials have been sent/reconfirmed.', 'success');
                    showApplicationDetails(applicationId); 
                } else {
                    showNotification(`Status updated to ${newStatus}.`, 'success');
                    detailsModal.hide(); 
                }
            }
            updateQuickStats();
            applyFiltersAndDisplay(); 
        } else {
            showNotification(`Error updating status: ${data.message}`, 'error');
            if (appIndex !== -1) allApplications[appIndex].status = originalStatus;
        }

    } catch (error) {
        console.error('Network Error updating status:', error);
        showNotification('Network error. Status may not have been saved.', 'error');
        if (appIndex !== -1) allApplications[appIndex].status = originalStatus;
    }
}

// --- Load Applications ---
async function simulateDataLoad() {
    const tableBody = document.getElementById('applications-tbody');
    tableBody.innerHTML = '<tr><td colspan="6">Loading applications...</td></tr>';

    try {
        const response = await fetch(`${SERVER_URL}/get-applications`);
        const data = await response.json();

        if (data.success) {
            allApplications = data.applications;
        } else {
            tableBody.innerHTML = '<tr><td colspan="6">Error loading applications from server.</td></tr>';
            return;
        }
        
        updateQuickStats();
        applyFiltersAndDisplay(); 
        
    } catch (error) {
        console.error('Error connecting to server:', error);
        tableBody.innerHTML = '<tr><td colspan="6">Connection error. Please ensure Node.js server is running.</td></tr>';
    }
}
