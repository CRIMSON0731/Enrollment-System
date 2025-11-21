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
        card.innerHTML = `<strong>${ann.title}</strong><p>${ann.content}</p>`;
        containerElement.appendChild(card);
      });
    } else {
      containerElement.innerHTML = "<p>No announcements at this time.</p>";
    }
  } catch (error) {
    console.error("Error fetching announcements:", error);
  }
}

// --- 2. Function to handle sidebar navigation ---
function setupNavigation(isFirstLogin = false) {
  const links = document.querySelectorAll(".sidebar-links a");
  // If isFirstLogin is true, force them to the password tab, otherwise go to home
  const initialTargetId = isFirstLogin ? "content-password" : "content-home";
  const initialNavLinkId = isFirstLogin ? "nav-password" : "nav-home";

  const target = document.getElementById(initialTargetId);
  const link = document.getElementById(initialNavLinkId);
  
  // Clear all active states first to prevent overlap
  document.querySelectorAll(".content-section").forEach(s => s.classList.remove("active-section"));
  document.querySelectorAll(".sidebar-links a").forEach(l => l.classList.remove("active"));

  if(target) target.classList.add("active-section");
  if(link) link.classList.add("active");

  links.forEach(linkItem => {
    linkItem.addEventListener("click", (e) => {
      e.preventDefault(); 
      // Security Guard: Prevent leaving password tab if they haven't changed default password
      if (isFirstLogin && linkItem.id !== 'nav-password') {
          showNotification("SECURITY ALERT: You must change your temporary password first.", 'error');
          return;
      }
      links.forEach(l => l.classList.remove("active"));
      linkItem.classList.add("active");
      
      document.querySelectorAll(".content-section").forEach(s => s.classList.remove("active-section"));
      const contentId = "content-" + linkItem.id.split("-")[1];
      const contentEl = document.getElementById(contentId);
      if(contentEl) contentEl.classList.add("active-section");
    });
  });
}

function setupPasswordToggle() {
    document.querySelectorAll('.toggle-password').forEach(icon => {
        icon.addEventListener('click', () => {
            const input = icon.previousElementSibling;
            input.type = input.type === 'password' ? 'text' : 'password';
            icon.classList.toggle('fa-eye');
            icon.classList.toggle('fa-eye-slash');
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
        // Update the local object immediately
        appData.password = newPasswordInput.value; 
        localStorage.setItem("applicationData", JSON.stringify(appData));
        
        showNotification(data.message, 'success');
        messageEl.textContent = '';
        form.reset();
        newPasswordInput.type = 'password';
        confirmPasswordInput.type = 'password';
        
        // Reload to clear the "First Login" state
        window.location.reload(); 
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

    let html = `<div class="checklist-item done">${checkIcon} Application Submitted</div>`;
    
    if (isApproved) {
        html += `<div class="checklist-item done">${checkIcon} Documents Reviewed</div>`;
        html += `<div class="checklist-item done">${checkIcon} Enrollment Finalized</div>`;
        html += `<div class="alert alert-success mt-3 small">You are all set! View your information tab.</div>`;
    } else if (isPending) {
         html += `<div class="checklist-item pending">${pendingIcon} Under Review</div>`;
         html += `<div class="checklist-item pending">${pendingIcon} Awaiting Status</div>`;
    } else if (isRejected) {
        html += `<div class="checklist-item rejected">${rejectIcon} Documents Rejected</div>`;
        html += `<div class="checklist-item rejected">${rejectIcon} Enrollment Blocked</div>`;
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
            { path: fullApp.doc_card_path, name: "School Card" },
            { path: fullApp.doc_psa_path, name: "PSA" },
            { path: fullApp.doc_f137_path, name: "FORM 137" },
            { path: fullApp.doc_brgy_cert_path, name: "Brgy Cert" }
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

// --- PROGRESS BAR ---
function updateEnrollmentProgress(status) {
    const progressBar = document.getElementById('enrollment-progress-bar');
    
    if (!progressBar) return;

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
    progressBar.textContent = `${percentage}% Complete`;
    
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
            btn.className = 'btn btn-secondary fw-bold w-100'; 
            select.disabled = true;
            fileInput.disabled = true;
            
            // Add visual notice
            const existingNotice = actionCenter.querySelector('.enrollment-notice');
            if (!existingNotice) {
                const notice = document.createElement('p');
                notice.className = 'text-danger small fw-bold mt-2 mb-0 enrollment-notice';
                notice.innerHTML = '<i class="fa-solid fa-lock"></i> Enrollment period is currently closed by the admin.';
                actionCenter.querySelector('.d-flex.flex-column').appendChild(notice);
            }
            return; 
        }
    } catch(e) { console.error(e); }

    // 2. Grade Logic
    const currentGrade = parseInt(appData.grade_level.replace(/\D/g, '')); 
    if (currentGrade >= 10) { actionCenter.style.display = 'none'; return; }

    const nextGradeLevel = currentGrade + 1;
    const allOptions = select.querySelectorAll('option');
    allOptions.forEach(opt => {
        if (opt.disabled) return; 
        const optGrade = parseInt(opt.value.replace(/\D/g, ''));
        if (optGrade === nextGradeLevel) opt.style.display = 'block'; 
        else opt.style.display = 'none'; 
    });

    // 3. Status Check
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
        if (nextGrade === "Select Next Grade Level") return alert("Select a grade.");
        if (fileInput.files.length === 0) return alert("Upload report card.");
        if (!confirm(`Enroll for ${nextGrade}?`)) return;

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
            alert("Network error.");
            btn.disabled = false;
            btn.textContent = "Enroll for Next Year";
        }
    });
}

// --- UPDATE UI ---
function updateDashboardUI(appData) {
    document.getElementById("student-name").textContent = appData.first_name || "Student";
    document.getElementById("student-name-full").textContent = `${appData.first_name} ${appData.last_name}`;
    
    const formattedGrade = appData.grade_level.includes('Grade') ? appData.grade_level : `Grade ${appData.grade_level}`;
    document.getElementById("status-summary-text").textContent = `${appData.status} (${formattedGrade})`;
    
    const statusEl = document.getElementById("status-message");
    if(statusEl) {
        statusEl.textContent = appData.status;
        statusEl.className = `status-${appData.status.replace(/ /g, '')} mb-4`;
    }

    renderEnrollmentChecklist(appData.status);
    updateEnrollmentProgress(appData.status);

    document.getElementById("detail-name").textContent = `${appData.first_name} ${appData.last_name}`;
    document.getElementById("detail-grade").textContent = formattedGrade;
    document.getElementById("detail-bday").textContent = appData.birthdate ? new Date(appData.birthdate).toLocaleDateString() : 'N/A';
    document.getElementById("detail-email").textContent = appData.email;
    document.getElementById("detail-phone").textContent = appData.phone || "N/A";
    document.getElementById("detail-username").textContent = appData.username || "N/A";
    
    setupReEnrollment(appData);
}

// =========================================================================
// 5. MAIN INITIALIZATION
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
  const appDataString = localStorage.getItem("applicationData");
  if (!appDataString) {
    window.location.href = "index.html";
    return;
  }
  
  let appData = JSON.parse(appDataString);

  // FIX: Ensure strict check. Only 'password123' triggers the first login state.
  const isFirstLogin = appData.password === 'password123';
  
  setupNavigation(isFirstLogin); 
  if (isFirstLogin) showNotification("SECURITY ALERT: Please change your password.", 'error');

  // Render Initial Data
  updateDashboardUI(appData);

  // Init Features
  loadAnnouncements();
  setupPasswordToggle(); 
  setupPasswordForm(appData);
  setupLogout();
  loadFullApplicationDetails(appData); 
  
  if (window.VanillaTilt) VanillaTilt.init(document.querySelectorAll("[data-tilt]"));

  // --- FETCH FRESH DATA AND FIX RE-ENROLLMENT PASSWORD BUG ---
  fetch(`https://enrollment-system-production-6820.up.railway.app/get-application-details/${appData.id}`)
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            // IMPORTANT FIX: 
            // The server might return the default 'password123' for re-enrollees even if they changed it.
            // If we already have a custom password locally, DO NOT let the server overwrite it with 'password123'.
            const serverApp = data.application;

            if (appData.password !== 'password123' && serverApp.student_password === 'password123') {
                // Remove the password from the incoming data so spread operator doesn't overwrite local
                delete serverApp.student_password;
                delete serverApp.password;
            }
            
            // Note: We use 'student_password' or 'password' depending on what your server sends.
            // This line handles both cases safely.
            if (appData.password !== 'password123' && serverApp.password === 'password123') {
                delete serverApp.password;
            }

            const newData = { ...appData, ...serverApp };
            localStorage.setItem("applicationData", JSON.stringify(newData));
            updateDashboardUI(newData);
            appData = newData;
        }
    })
    .catch(err => console.error(err));

  // --- SOCKET LISTENER ---
  try {
      const socket = io('https://enrollment-system-production-6820.up.railway.app'); 
      socket.emit('registerUser', appData.id);
      
      // 1. Status Updates
      socket.on('statusUpdated', (data) => {
          appData.status = data.newStatus;
          localStorage.setItem("applicationData", JSON.stringify(appData));
          showNotification("🔔 Status Update: " + data.newStatus, data.newStatus === 'Approved' ? 'success' : 'info');
          updateDashboardUI(appData);
      });

      // 2. Enrollment Toggle (Real-Time)
      socket.on('enrollmentStatusChanged', (data) => {
          window.location.reload();
      });
  } catch(e) {
      console.warn("Socket connection failed or not supported.");
  }
});
