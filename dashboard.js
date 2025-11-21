// --- NOTIFICATION FUNCTION ---
function showNotification(message, type) {
  const notification = document.getElementById('notification-bar');
  if (!notification) return;
  
  notification.textContent = message;
  notification.className = `notification-bar ${type}`;
  notification.classList.add('show');
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 5000); 
}

// --- 1. Function to load announcements ---
async function loadAnnouncements() {
  try {
    const response = await fetch("https://enrollment-system-production-6820.up.railway.app/get-announcements");
    const data = await response.json();
    const containerElement = document.getElementById("announcements-list");
    
    if (!containerElement) return;
    
    if (data.success && data.announcements.length > 0) {
      containerElement.innerHTML = ""; 
      data.announcements.forEach(ann => {
        const card = document.createElement("div");
        card.className = "announcement-card";
        card.innerHTML = `
          <strong>${ann.title}</strong>
          <p>${ann.content}</p>
        `;
        containerElement.appendChild(card);
      });
    } else {
      containerElement.innerHTML = "<p>No announcements at this time.</p>";
    }
  } catch (error) {
    console.error("Error fetching announcements:", error);
    document.getElementById("announcements-list").innerHTML = "<p>Connection error.</p>";
  }
}

// --- 2. Function to handle sidebar navigation ---
function setupNavigation(isFirstLogin = false) {
  const links = document.querySelectorAll(".sidebar-links a");
  const contentSections = document.querySelectorAll(".content-section");
  
  const initialTargetId = isFirstLogin ? "content-password" : "content-home";
  const initialNavLinkId = isFirstLogin ? "nav-password" : "nav-home";

  const target = document.getElementById(initialTargetId);
  const link = document.getElementById(initialNavLinkId);
  
  if(target) target.classList.add("active-section");
  if(link) link.classList.add("active");

  links.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault(); 
      const targetId = "content-" + link.id.split("-")[1]; 

      if (isFirstLogin && link.id !== 'nav-password') {
          showNotification("SECURITY ALERT: You must change your temporary password to access the dashboard.", 'error');
          return;
      }
      
      const sidebar = document.querySelector(".sidebar");
      if (sidebar.classList.contains('sidebar-open')) {
          sidebar.classList.remove('sidebar-open');
      }

      links.forEach(l => l.classList.remove("active"));
      link.classList.add("active");
      
      contentSections.forEach(section => {
        section.classList.remove("active-section");
      });
      
      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        targetSection.classList.add("active-section");
      }
    });
  });
}

// --- Function to toggle password visibility ---
function setupPasswordToggle() {
    document.querySelectorAll('.toggle-password').forEach(icon => {
        icon.addEventListener('click', () => {
            const input = icon.previousElementSibling;
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            }
        });
    });
}

// --- 3. Change Password Logic ---
function setupPasswordForm(appData) {
  const form = document.getElementById('change-password-form');
  if (!form) return;

  const messageEl = document.getElementById('password-message');
  const currentPasswordInput = document.getElementById('current-password');
  const newPasswordInput = document.getElementById('new-password');
  const confirmPasswordInput = document.getElementById('confirm-password');
  const generateBtn = document.getElementById('generate-password-btn');
  const strengthBar = document.getElementById('password-strength-bar');
  const strengthText = document.getElementById('password-strength-text');

  const errorElements = {
      current: document.getElementById('current-password-error'),
      new: document.getElementById('new-password-error'),
      confirm: document.getElementById('confirm-password-error')
  };

  const clearErrors = () => {
    if(errorElements.current) errorElements.current.textContent = '';
    if(errorElements.new) errorElements.new.textContent = '';
    if(errorElements.confirm) errorElements.confirm.textContent = '';
    messageEl.textContent = '';
  };
  
  [currentPasswordInput, newPasswordInput, confirmPasswordInput].forEach(input => {
      if(input) input.addEventListener('focus', clearErrors);
  });

  const calculateStrength = (password) => {
      let strength = 0;
      if (password.length >= 8) strength++;
      if (password.match(/[a-z]+/)) strength++;
      if (password.match(/[A-Z]+/)) strength++;
      if (password.match(/[0-9]+/)) strength++;
      if (password.match(/[$@#&!]+/)) strength++;
      return strength;
  };

  const updateStrengthMeter = () => {
      const val = newPasswordInput.value;
      const strength = calculateStrength(val);
      
      if (val.length === 0) {
          if(strengthBar) { strengthBar.style.width = '0%'; strengthBar.className = 'progress-bar'; }
          if(strengthText) strengthText.textContent = 'Strength: None';
          return;
      }

      let width = '0%';
      let colorClass = 'bg-danger';
      let text = 'Weak';

      if (strength <= 2) { width = '30%'; colorClass = 'bg-danger'; text = 'Weak'; }
      else if (strength === 3 || strength === 4) { width = '60%'; colorClass = 'bg-warning'; text = 'Medium'; }
      else if (strength >= 5) { width = '100%'; colorClass = 'bg-success'; text = 'Strong'; }

      if(strengthBar) {
        strengthBar.style.width = width;
        strengthBar.className = `progress-bar ${colorClass}`;
      }
      if(strengthText) strengthText.textContent = `Strength: ${text}`;
  };

  const generateStrongPassword = () => {
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$@#&!";
      let password = "";
      for (let i = 0; i < 12; i++) password += chars.charAt(Math.floor(Math.random() * chars.length));
      return password;
  };

  if(newPasswordInput) newPasswordInput.addEventListener('input', updateStrengthMeter);

  if(generateBtn) {
      generateBtn.addEventListener('click', () => {
          const strongPass = generateStrongPassword();
          newPasswordInput.value = strongPass;
          confirmPasswordInput.value = strongPass;
          newPasswordInput.type = 'text';
          confirmPasswordInput.type = 'text';
          updateStrengthMeter();
          clearErrors();
          showNotification("Strong password generated! Please save it.", "info");
      });
  }

  const validateForm = () => {
      clearErrors();
      const newPass = newPasswordInput.value;
      const confirmPass = confirmPasswordInput.value;
      let isValid = true;

      if (currentPasswordInput.value.length === 0) {
          if(errorElements.current) errorElements.current.textContent = 'Current password is required.';
          isValid = false;
      }
      if (newPass === 'password123') {
          if(errorElements.new) errorElements.new.textContent = 'You cannot use the default temporary password.';
          isValid = false;
      }
      if (calculateStrength(newPass) < 3) {
          if(errorElements.new) errorElements.new.textContent = 'Password is too weak.';
          isValid = false;
      }
      if (newPass.length < 8) {
        if(errorElements.new) errorElements.new.textContent = 'Min 8 characters.';
        isValid = false;
      }
      if (newPass !== confirmPass) {
          if(errorElements.confirm) errorElements.confirm.textContent = 'Passwords do not match.';
          isValid = false;
      }
      if (!isValid) {
          messageEl.textContent = 'Please fix errors.';
          messageEl.style.color = '#dc3545';
      }
      return isValid;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(); 
    if (!validateForm()) return; 
    
    messageEl.textContent = 'Updating...';
    
    try {
      const response = await fetch('https://enrollment-system-production-6820.up.railway.app/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: appData.id,
          currentPassword: currentPasswordInput.value,
          newPassword: newPasswordInput.value
        })
      });
      const data = await response.json();

      if (data.success) {
        appData.password = newPasswordInput.value; 
        localStorage.setItem("applicationData", JSON.stringify(appData));
        showNotification(data.message, 'success');
        messageEl.textContent = '';
        form.reset();
        newPasswordInput.type = 'password';
        confirmPasswordInput.type = 'password';
        if (currentPasswordInput.value === 'password123') window.location.reload(); 
      } else {
        messageEl.textContent = `Error: ${data.message}`;
        messageEl.style.color = '#dc3545';
      }
    } catch (err) {
      messageEl.textContent = 'Connection error.';
      messageEl.style.color = '#dc3545';
    }
  });
}

// --- 4. Logout ---
function setupLogout() {
  const logoutBtn = document.getElementById('header-logout-btn');
  if(!logoutBtn) return;
  logoutBtn.addEventListener('click', () => {
    if (!confirm("Are you sure you want to log out?")) return;
    localStorage.removeItem("applicationData"); 
    showNotification("Logging out...", "success");
    setTimeout(() => { window.location.href = "index.html"; }, 1500);
  });
}

// --- Checklist Logic ---
function renderEnrollmentChecklist(status) {
    const checklistEl = document.getElementById('enrollment-checklist');
    if(!checklistEl) return;
    
    const checkIcon = '<span class="fa-solid fa-check"></span>'; 
    const pendingIcon = '<span class="fa-solid fa-circle-notch fa-spin"></span>'; 
    const rejectIcon = '<span class="fa-solid fa-xmark"></span>'; 
    const isApproved = status === 'Approved';
    const isPending = status === 'Pending Review';
    const isRejected = status === 'Rejected';

    let html = `<div class="checklist-item done">${checkIcon} Application Submitted (Documents Uploaded)</div>`;
    
    if (isApproved) {
        html += `<div class="checklist-item done">${checkIcon} Documents Reviewed by Admin</div>`;
        html += `<div class="checklist-item done">${checkIcon} Enrollment Finalized & Portal Access Granted</div>`;
        html += `<div class="alert alert-success mt-3 small">You are all set! View your information tab.</div>`;
    } else if (isPending) {
         html += `<div class="checklist-item pending">${pendingIcon} Documents Under Review by Admin</div>`;
         html += `<div class="checklist-item pending">${pendingIcon} Awaiting Final Enrollment Status</div>`;
    } else if (isRejected) {
        html += `<div class="checklist-item rejected">${rejectIcon} Documents Rejected (See Admin Note)</div>`;
        html += `<div class="checklist-item rejected">${rejectIcon} Enrollment Blocked - Contact Registrar.</div>`;
    }
    checklistEl.innerHTML = html;
}

// --- Load Documents ---
async function loadFullApplicationDetails(appData) {
    const serverUrl = 'https://enrollment-system-production-6820.up.railway.app'; 
    const documentLinksContainer = document.getElementById('document-links-container');
    if(!documentLinksContainer) return;
    
    documentLinksContainer.innerHTML = '<p>Fetching document links...</p>';

    try {
        const response = await fetch(`${serverUrl}/get-application-details/${appData.id}`);
        const data = await response.json();

        if (!data.success) {
            documentLinksContainer.innerHTML = `<p style="color:red;">Error: ${data.message}</p>`;
            return;
        }

        const fullApp = data.application;
        let linksHtml = '';
        const getMockStatus = () => appData.status === 'Approved' ? 'Verified' : (appData.status === 'Rejected' ? 'Rejected' : 'Pending');
        const docs = [
            { path: fullApp.doc_card_path, name: "School Card (Previous Grade)" },
            { path: fullApp.doc_psa_path, name: "PSA (Birth Certificate)" },
            { path: fullApp.doc_f137_path, name: "FORM 137/SF10" },
            { path: fullApp.doc_brgy_cert_path, name: "Barangay Certificate" }
        ];

        docs.forEach(doc => {
            if (doc.path) {
                const status = getMockStatus();
                const statusClass = `doc-status-${status.toLowerCase()}`;
                linksHtml += `
                    <div class="file-link-wrapper">
                        <a href="${serverUrl}/uploads/${doc.path}" target="_blank" class="file-link">
                            <span class="fa-solid fa-file-pdf"></span> <span>${doc.name}</span>
                        </a>
                        <span class="doc-status-tag ${statusClass}">${status}</span>
                    </div>`;
            }
        });
        documentLinksContainer.innerHTML = linksHtml || "<p>No documents found.</p>";
    } catch (error) {
        documentLinksContainer.innerHTML = '<p style="color:red;">Network error.</p>';
    }
}

// --- PROGRESS BAR (Updated for 100% Success) ---
function updateEnrollmentProgress(status) {
    const progressBar = document.getElementById('enrollment-progress-bar');
    const progressText = document.getElementById('progress-text');
    
    if (!progressBar || !progressText) return;

    let percentage = 0;
    let className = 'bg-secondary';

    if (status === 'Approved') {
        percentage = 100;
        className = 'bg-success';
    } else if (status === 'Pending Review') {
        percentage = 60;
        className = 'bg-warning progress-bar-animated';
    } else if (status === 'Rejected') {
        percentage = 10; 
        className = 'bg-danger';
    }

    progressBar.style.width = `${percentage}%`;
    progressBar.setAttribute('aria-valuenow', percentage);
    progressBar.className = `progress-bar progress-bar-striped ${className}`;
    progressText.textContent = `${percentage}% Complete`;
    
    if (percentage === 100) {
        progressBar.classList.remove('progress-bar-animated', 'progress-bar-striped');
    }
}

// --- Re-enrollment Logic ---
async function setupReEnrollment(appData) {
    const btn = document.getElementById('btn-re-enroll');
    const select = document.getElementById('next-grade-select');
    const actionCenter = document.getElementById('action-center-widget'); 
    const fileInput = document.getElementById('re-enroll-card');

    if (!btn || !select || !actionCenter || !fileInput) return;

    // 1. Check Server Status (Toggle)
    try {
        const statusRes = await fetch('https://enrollment-system-production-6820.up.railway.app/get-enrollment-status');
        const statusData = await statusRes.json();
        
        if (statusData.success && !statusData.isOpen) {
            btn.disabled = true;
            btn.textContent = "Enrollment Closed";
            btn.className = 'btn btn-secondary fw-bold w-100'; // Grey out
            select.disabled = true;
            fileInput.disabled = true;
            
            // Add visual notice
            const notice = document.createElement('p');
            notice.className = 'text-danger small fw-bold mt-2 mb-0';
            notice.innerHTML = '<i class="fa-solid fa-lock"></i> Enrollment period is currently closed by the admin.';
            actionCenter.querySelector('.d-flex.flex-column').appendChild(notice);
            return; 
        }
    } catch(e) { console.error(e); }

    // 2. Grade Logic (Show only next grade)
    const currentGrade = parseInt(appData.grade_level.replace(/\D/g, '')); 
    
    // Hide Action Center if student is already Grade 10 (Graduated)
    if (currentGrade >= 10) { 
        actionCenter.style.display = 'none'; 
        return; 
    }

    const nextGradeLevel = currentGrade + 1;
    const allOptions = select.querySelectorAll('option');
    allOptions.forEach(opt => {
        if (opt.disabled) return; 
        const optGrade = parseInt(opt.value.replace(/\D/g, ''));
        
        // Show ONLY the next grade level
        if (optGrade === nextGradeLevel) {
            opt.style.display = 'block'; 
        } else {
            opt.style.display = 'none'; 
        }
    });

    // 3. Status Check (Disable if already pending)
    if (appData.status === 'Pending Review') {
        btn.disabled = true;
        btn.textContent = 'Application Under Review';
        btn.className = 'btn btn-secondary fw-bold'; 
        select.disabled = true;
        fileInput.disabled = true;
        return;
    }

    // 4. Submit Logic
    btn.addEventListener('click', async () => {
        const nextGrade = select.value;

        if (nextGrade === "Select Next Grade Level") {
            alert("Please select the grade level you are enrolling for.");
            return;
        }

        if (fileInput.files.length === 0) {
            alert("Please upload your previous Report Card to proceed.");
            return;
        }

        if (!confirm(`Are you sure you want to enroll for ${nextGrade}?`)) {
            return;
        }

        btn.disabled = true;
        btn.textContent = "Uploading...";

        const formData = new FormData();
        formData.append('applicationId', appData.id);
        formData.append('nextGradeLevel', nextGrade);
        formData.append('school_card', fileInput.files[0]);

        try {
            const response = await fetch('https://enrollment-system-production-6820.up.railway.app/student-re-enroll', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();

            if (data.success) {
                alert(data.message);
                appData.grade_level = nextGrade;
                appData.status = "Pending Review";
                localStorage.setItem("applicationData", JSON.stringify(appData));
                window.location.reload();
            } else {
                alert("Error: " + data.message);
                btn.disabled = false;
                btn.textContent = "Enroll for Next Year";
            }

        } catch (error) {
            console.error("Re-enrollment error:", error);
            alert("Network error. Please try again later.");
            btn.disabled = false;
            btn.textContent = "Enroll for Next Year";
        }
    });
}


// =========================================================================
// 5. MAIN INITIALIZATION
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
  const appDataString = localStorage.getItem("applicationData");
  if (!appDataString) {
    alert("You are not logged in. Redirecting to login page.");
    window.location.href = "index.html";
    return;
  }
  
  const appData = JSON.parse(appDataString);
  
  const isFirstLogin = appData.password === 'password123';
  
  setupNavigation(isFirstLogin); 

  if (isFirstLogin) {
      showNotification("SECURITY ALERT: Please change your temporary password immediately.", 'error');
  }

  // Initialize Modules
  loadAnnouncements();
  setupPasswordToggle(); 
  setupPasswordForm(appData);
  setupLogout();
  loadFullApplicationDetails(appData); 
  setupReEnrollment(appData);

  // Render Static Info
  document.getElementById("student-name").textContent = appData.first_name;
  document.getElementById("student-name-full").textContent = `${appData.first_name} ${appData.last_name}`;
  
  const formattedGrade = appData.grade_level.includes('Grade') ? appData.grade_level : `Grade ${appData.grade_level}`;
  document.getElementById("status-summary-text").textContent = `${appData.status} (${formattedGrade})`;

  const statusMessageEl = document.getElementById("status-message");
  statusMessageEl.textContent = appData.status;
  statusMessageEl.className = `status-${appData.status.replace(/ /g, '')} mb-4`; 

  // Initial Render
  renderEnrollmentChecklist(appData.status);
  updateEnrollmentProgress(appData.status);
  
  document.getElementById("detail-name").textContent = `${appData.first_name} ${appData.middle_name || ''} ${appData.last_name}`;
  document.getElementById("detail-grade").textContent = formattedGrade;
  document.getElementById("detail-bday").textContent = appData.birthdate ? new Date(appData.birthdate).toLocaleDateString() : 'N/A';
  document.getElementById("detail-email").textContent = appData.email;
  document.getElementById("detail-phone").textContent = appData.phone;
  document.getElementById("detail-username").textContent = appData.username;
  
  // --- NEW: REAL-TIME SOCKET LISTENER ---
  const socket = io('https://enrollment-system-production-6820.up.railway.app'); 
  socket.emit('registerUser', appData.id);
  
  socket.on('statusUpdated', (data) => {
      // 1. Update Local Data
      appData.status = data.newStatus;
      localStorage.setItem("applicationData", JSON.stringify(appData));
      
      // 2. Show Notification
      showNotification("🔔 " + data.message, data.newStatus === 'Approved' ? 'success' : 'error');
      
      // 3. Update UI Elements Live
      if(statusMessageEl) {
          statusMessageEl.textContent = data.newStatus;
          statusMessageEl.className = `status-${data.newStatus.replace(/ /g, '')} mb-4`;
      }
      const summaryEl = document.getElementById("status-summary-text");
      if(summaryEl) {
        summaryEl.textContent = `${data.newStatus} (${formattedGrade})`;
      }

      // 4. Update Progress & Checklist
      updateEnrollmentProgress(data.newStatus);
      renderEnrollmentChecklist(data.newStatus);
  });

  if (window.VanillaTilt) {
      VanillaTilt.init(document.querySelectorAll("[data-tilt]"), {
      });
  }
});
