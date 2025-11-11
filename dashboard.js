// --- NOTIFICATION FUNCTION (New!) ---
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

// --- 1. Function to load announcements ---
async function loadAnnouncements() {
  try {
    const response = await fetch("http://localhost:3000/get-announcements");
    const data = await response.json();
    const listElement = document.getElementById("announcements-list");
    
    if (data.success) {
      if (data.announcements.length === 0) {
        listElement.innerHTML = "<li>No announcements at this time.</li>";
        return;
      }
      listElement.innerHTML = ""; 
      data.announcements.forEach(ann => {
        const li = document.createElement("li");
        li.innerHTML = `
          <strong>${ann.title}</strong>
          <p>${ann.content}</p>
        `;
        listElement.appendChild(li);
      });
    } else {
      listElement.innerHTML = "<li>Error loading announcements.</li>";
    }
  } catch (error) {
    console.error("Error fetching announcements:", error);
    document.getElementById("announcements-list").innerHTML = "<li>Connection error.</li>";
  }
}

// --- 2. Function to handle sidebar navigation ---
function setupNavigation() {
  const links = document.querySelectorAll(".sidebar-links a");
  const contentSections = document.querySelectorAll(".content-section");
  
  links.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault(); 
      const targetId = "content-" + link.id.split("-")[1]; 

      links.forEach(l => l.classList.remove("active"));
      link.classList.add("active");
      
      contentSections.forEach(section => {
        section.style.display = "none";
      });
      
      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        targetSection.style.display = "block";
      }
    });
  });
  document.getElementById("content-home").style.display = "block";
}

// --- 3. Function to handle the "Change Password" form ---
function setupPasswordForm(appData) {
  const form = document.getElementById('change-password-form');
  const messageEl = document.getElementById('password-message');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    messageEl.textContent = 'Updating...';
    messageEl.style.color = '#666'; // Reset color
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword !== confirmPassword) {
      messageEl.textContent = 'Error: New passwords do not match.';
      messageEl.style.color = '#dc3545'; // Red
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: appData.id,
          currentPassword: currentPassword,
          newPassword: newPassword
        })
      });

      const data = await response.json();

      if (data.success) {
        showNotification(data.message, 'success');
        messageEl.textContent = ''; // Clear the small text since we used the big bar
        form.reset();
      } else {
        messageEl.textContent = `Error: ${data.message}`;
        messageEl.style.color = '#dc3545'; // Red
      }

    } catch (err) {
      messageEl.textContent = 'A connection error occurred.';
      messageEl.style.color = '#dc3545'; // Red
    }
  });
}

// --- 4. Function to handle logging out ---
function setupLogout() {
  const logoutBtn = document.getElementById('header-logout-btn');
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem("applicationData"); 
    
    showNotification("Logging out...", "success");
    
    setTimeout(() => {
        window.location.href = "index.html";
    }, 1500);
  });
}

// --- NEW: Function to render dynamic checklist (Emojis removed) ---
function renderEnrollmentChecklist(status) {
    const checklistEl = document.getElementById('enrollment-checklist');
    let html = '';
    
    // Icon Mappings (Using text symbols and relying on CSS for color)
    const checkIcon = '<span style="font-size: 1.2em; margin-right: 10px; font-weight: 700;">✓</span>'; 
    const pendingIcon = '<span style="font-size: 1.2em; margin-right: 10px; font-weight: 700;">•</span>'; 
    const rejectIcon = '<span style="font-size: 1.2em; margin-right: 10px; font-weight: 700;">X</span>'; 

    const isApproved = status === 'Approved';
    const isPending = status === 'Pending Review';
    const isRejected = status === 'Rejected';

    // Item 1: Application Submitted
    html += `<div class="checklist-item done">
                ${checkIcon} Application Submitted (Documents Uploaded)
             </div>`;
    
    // Item 2: Document Review Status
    if (isApproved || isPending) {
        html += `<div class="checklist-item ${isApproved ? 'done' : 'pending'}">
                    ${isApproved ? checkIcon : pendingIcon} Documents Reviewed by Admin
                 </div>`;
    } else if (isRejected) {
        html += `<div class="checklist-item rejected">
                    ${rejectIcon} Documents Rejected (See Admin Note)
                 </div>`;
    }

    // Item 3: Access to Portal
    if (isApproved) {
        html += `<div class="checklist-item done">
                    ${checkIcon} Enrollment Finalized & Portal Access Granted
                 </div>`;
        html += `<p style="margin-top: 15px; background: #e9f7ec; padding: 10px; border-radius: 5px; font-size: 0.9em;">
                    You are all set! View your information tab to see your generated username.
                 </p>`;
    } else if (isPending) {
         html += `<div class="checklist-item pending">
                    ${pendingIcon} Awaiting Final Enrollment Status
                 </div>`;
    } else if (isRejected) {
         html += `<div class="checklist-item rejected">
                    ${rejectIcon} Enrollment Blocked - Contact Registrar.
                 </div>`;
    }

    checklistEl.innerHTML = html;
}

// --- NEW: Function to load student's submitted file links ---
async function loadFullApplicationDetails(appData) {
    const serverUrl = 'http://localhost:3000'; // Base URL for file links
    const documentLinksContainer = document.getElementById('document-links-container');
    documentLinksContainer.innerHTML = '<p>Fetching document links...</p>';

    try {
        // Fetch the full details, including all file path columns
        const response = await fetch(`${serverUrl}/get-application-details/${appData.id}`);
        const data = await response.json();

        if (!data.success) {
            documentLinksContainer.innerHTML = `<p style="color:red;">Error loading documents: ${data.message}</p>`;
            return;
        }

        const fullApp = data.application;
        let linksHtml = '';

        // Map the document fields to display names and paths
        const docs = [
            { path: fullApp.doc_card_path, name: "School Card (Previous Grade)" },
            { path: fullApp.doc_psa_path, name: "PSA (Birth Certificate)" },
            { path: fullApp.doc_f137_path, name: "FORM 137/SF10 (Academic Records)" },
            { path: fullApp.doc_brgy_cert_path, name: "Barangay Certificate" }
        ];

        docs.forEach(doc => {
            if (doc.path) {
                // Use eye icon and simple text for clean button look
                linksHtml += `
                    <a href="${serverUrl}/uploads/${doc.path}" target="_blank" class="file-link">
                        <span style="font-size: 1.1em;">👁️</span> 
                        <span>${doc.name}</span>
                    </a>`;
            }
        });

        documentLinksContainer.innerHTML = linksHtml || "<p>No documents found or links failed to load.</p>";

    } catch (error) {
        console.error('Error fetching application details for student:', error);
        documentLinksContainer.innerHTML = '<p style="color:red;">Network error. Failed to load document links.</p>';
    }
}


// --- 5. Main function ---
document.addEventListener("DOMContentLoaded", () => {
  const appDataString = localStorage.getItem("applicationData");
  if (!appDataString) {
    alert("You are not logged in. Redirecting to login page.");
    window.location.href = "index.html";
    return;
  }
  
  const appData = JSON.parse(appDataString);

  loadAnnouncements();
  setupNavigation();
  setupPasswordForm(appData);
  setupLogout();
  loadFullApplicationDetails(appData); // Load file links on dashboard load

  // 1. Update NEW Full Name and Status Summary
  document.getElementById("student-name").textContent = appData.first_name;
  document.getElementById("student-name-full").textContent = `${appData.first_name} ${appData.last_name}`;
  document.getElementById("status-summary-text").textContent = appData.status;

  // 2. Update Status Box (Existing Logic)
  const statusMessageEl = document.getElementById("status-message");
  statusMessageEl.textContent = appData.status;
  statusMessageEl.className = `status-${appData.status.replace(/ /g, '')}`;

  // 3. Render the NEW Checklist
  renderEnrollmentChecklist(appData.status);
  
  // Update Information Details
  document.getElementById("detail-name").textContent = `${appData.first_name} ${appData.middle_name || ''} ${appData.last_name}`;
  document.getElementById("detail-grade").textContent = `Grade ${appData.grade_level}`;
  document.getElementById("detail-bday").textContent = appData.birthdate ? new Date(appData.birthdate).toLocaleDateString() : 'N/A';
  document.getElementById("detail-email").textContent = appData.email;
  document.getElementById("detail-phone").textContent = appData.phone;
  document.getElementById("detail-username").textContent = appData.username;
  
  // NEW: Initialize Tilt effect globally after the DOM is fully loaded
  if (window.VanillaTilt) {
      VanillaTilt.init(document.querySelectorAll("[data-tilt]"), {
          // Default options: speed and max tilt are set on the elements themselves
      });
  }
});