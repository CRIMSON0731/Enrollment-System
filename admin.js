// Global variable to store all fetched applications
let allApplications = [];
let currentGradeLevel = '7'; 

// --- MODAL ELEMENTS ---
const detailsModal = document.getElementById('details-modal');
const closeModalBtn = document.querySelector('.close-btn');
const modalApproveBtn = document.getElementById('modal-approve-btn');
const modalRejectBtn = document.getElementById('modal-reject-btn');
const modalDeleteBtn = document.getElementById('modal-delete-btn'); 

// Run this code when the page loads
document.addEventListener('DOMContentLoaded', () => {
    addLogoutListener();
    addTabListeners();
    addFilterListeners(); 
    addModalListeners(); 
    simulateDataLoad(); 
});

// --- Modal Listeners (Fixed) ---
function addModalListeners() {
    closeModalBtn.onclick = function() { detailsModal.style.display = 'none'; }
    window.onclick = function(event) {
        if (event.target == detailsModal) {
            detailsModal.style.display = 'none';
        }
    }
    
    modalApproveBtn.addEventListener('click', () => {
        const appId = modalApproveBtn.getAttribute('data-id');
        updateStatus(appId, 'Approved');
    });

    modalRejectBtn.addEventListener('click', () => {
        const appId = modalRejectBtn.getAttribute('data-id');
        updateStatus(appId, 'Rejected');
        detailsModal.style.display = 'none';
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

// --- Delete Applicant Function ---
async function deleteApplicant(applicationId) {
    try {
        const response = await fetch('http://localhost:3000/delete-application', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ applicationId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(data.message);
            detailsModal.style.display = 'none';
            simulateDataLoad(); // Reload data
        } else {
            alert(`Deletion Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Network Error deleting applicant:', error);
        alert('Network error. Failed to delete applicant.');
    }
}

// --- Logout Functionality ---
function addLogoutListener() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            alert('You have been logged out.');
            window.location.href = 'admin-login.html'; 
        });
    }
}

// --- Tab Functionality ---
function addTabListeners() {
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            currentGradeLevel = e.target.getAttribute('data-grade');
            applyFiltersAndDisplay(); 
        });
    });
}

// --- Search and Filter Listeners ---
function addFilterListeners() {
    document.getElementById('name-search').addEventListener('input', applyFiltersAndDisplay);
    document.getElementById('status-filter').addEventListener('change', applyFiltersAndDisplay);
}

// --- Calculate and Update Quick Stats ---
function updateQuickStats() {
    if (allApplications.length === 0) {
        document.getElementById('stat-total').textContent = 0;
        document.getElementById('stat-pending').textContent = 0;
        document.getElementById('stat-approved').textContent = 0;
        document.getElementById('stat-rejected').textContent = 0;
        return;
    }

    const total = allApplications.length;
    const pending = allApplications.filter(app => app.status === 'Pending Review').length;
    const approved = allApplications.filter(app => app.status === 'Approved').length;
    const rejected = allApplications.filter(app => app.status === 'Rejected').length; 

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-approved').textContent = approved;
    document.getElementById('stat-rejected').textContent = rejected;
}

// --- Filtering Logic ---
function applyFiltersAndDisplay() {
    const searchName = document.getElementById('name-search').value.toLowerCase();
    const statusFilter = document.getElementById('status-filter').value;
    
    let filteredApps = allApplications.filter(app => app.grade_level == currentGradeLevel);

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
    
    displayTableContent(filteredApps, currentGradeLevel);
}

// --- Main function to display table data ---
function displayTableContent(applicationsToDisplay, gradeLevel) {
    const tableBody = document.getElementById('applications-tbody');
    
    if (applicationsToDisplay.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6">No matching applications found for Grade ${gradeLevel}.</td></tr>`;
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
        <td classs="actions">
          <button class="action-btn view-details-btn" data-id="${app.id}">View Details</button>
        </td>
      `;
      tableBody.appendChild(row);
    });

    addEventListenersToButtons(); // Renamed to avoid confusion
}

// --- Function to add click handlers to View Details buttons ---
function addEventListenersToButtons() {
    document.querySelectorAll('.view-details-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            showApplicationDetails(id);
        });
    });
}

// --- Function to display details in the modal (UPDATED for credentials) ---
async function showApplicationDetails(appId) {
    const detailsDiv = document.getElementById('application-details');
    detailsDiv.innerHTML = '<p>Loading details...</p>'; // Show loading message

    // Set data-id on modal buttons
    modalApproveBtn.setAttribute('data-id', appId);
    modalRejectBtn.setAttribute('data-id', appId);
    modalDeleteBtn.setAttribute('data-id', appId);

    try {
        const response = await fetch(`http://localhost:3000/get-application-details/${appId}`);
        const data = await response.json();

        if (!data.success) {
            detailsDiv.innerHTML = `<p>Error: ${data.message}</p>`;
            return;
        }

        const fullApp = data.application;
        // Use 'birthdate' from your SQL schema, fallback to 'bday' just in case
        const birthdate = new Date(fullApp.birthdate || fullApp.bday || '2000-01-01').toLocaleDateString();
        const serverUrl = 'http://localhost:3000'; // Base URL for file links

        // Dynamically show/hide decision buttons
        const isPending = fullApp.status === 'Pending Review';
        modalApproveBtn.style.display = isPending ? 'inline-block' : 'none';
        modalRejectBtn.style.display = isPending ? 'inline-block' : 'none';

        // --- NEW: Login Info Display Block ---
        let loginDetailsHtml = '';
        if (fullApp.status === 'Approved' && fullApp.student_username) {
            loginDetailsHtml = `
                <div class="user-credentials">
                    <p><strong>Student Login Details:</strong></p>
                    <div><strong>Username (Email):</strong> <code>${fullApp.student_username}</code></div>
                    <div><strong>Password:</strong> <code>${fullApp.student_password}</code></div>
                    <p class="note">Please provide these credentials to the student. Advise them to change their password upon first login.</p>
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

        detailsModal.style.display = 'block';

    } catch (error) {
        console.error('Error fetching details:', error);
        detailsDiv.innerHTML = '<p>Error loading details. Please check server connection and try again.</p>';
        detailsModal.style.display = 'block';
    }
}


// --- Approve/Reject Handlers (Update local data and server) ---
async function updateStatus(applicationId, newStatus) {
    const appIndex = allApplications.findIndex(app => app.id == applicationId);
    const originalStatus = allApplications[appIndex].status;

    try {
        const response = await fetch('http://localhost:3000/update-application-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ applicationId, newStatus })
        });
        const data = await response.json();

        if (data.success) {
            if (appIndex !== -1) {
                allApplications[appIndex].status = newStatus;
                if (newStatus === 'Approved') {
                    // Update local data with credentials from server response
                    allApplications[appIndex].student_username = data.student_username;
                    allApplications[appIndex].student_password = data.student_password;
                    alert(`✅ Application Approved!\nStudent Username (Email): ${data.student_username}\nTemporary Password: ${data.student_password}`);
                    // Re-show the modal to display the new credentials
                    showApplicationDetails(applicationId);
                } else {
                    alert(`Status updated to ${newStatus}.`);
                    detailsModal.style.display = 'none';
                }
            }
            updateQuickStats();
            applyFiltersAndDisplay(); 
        } else {
            alert(`Error updating status: ${data.message}`);
            if (appIndex !== -1) allApplications[appIndex].status = originalStatus;
        }

    } catch (error) {
        console.error('Network Error updating status:', error);
        alert('Network error. Status may not have been saved.');
        if (appIndex !== -1) allApplications[appIndex].status = originalStatus;
    }
}

// --- SIMULATED DATA FETCH (Renamed to loadApplications for clarity) ---
async function simulateDataLoad() {
    const tableBody = document.getElementById('applications-tbody');
    tableBody.innerHTML = '<tr><td colspan="6">Loading applications...</td></tr>';

    try {
        const response = await fetch('http://localhost:3000/get-applications');
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