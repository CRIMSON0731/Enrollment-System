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

// --- 1. Function to load announcements ---
async function loadAnnouncements() {
  try {
    const response = await fetch("https://enrollment-system-production-6820.up.railway.app/get-announcements");
    const data = await response.json();
    const containerElement = document.getElementById("announcements-list");
    
    if (!containerElement || containerElement.tagName !== 'DIV') return;
    
    if (data.success) {
      if (data.announcements.length === 0) {
        containerElement.innerHTML = "<p>No announcements at this time.</p>";
        return;
      }
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
      containerElement.innerHTML = "<p>Error loading announcements.</p>";
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

  document.getElementById(initialTargetId).classList.add("active-section");
  document.getElementById(initialNavLinkId).classList.add("active");

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

// --- 3. Function to handle the "Change Password" form (ENHANCED) ---
function setupPasswordForm(appData) {
  const form = document.getElementById('change-password-form');
  const messageEl = document.getElementById('password-message');
  
  const currentPasswordInput = document.getElementById('current-password');
  const newPasswordInput = document.getElementById('new-password');
  const confirmPasswordInput = document.getElementById('confirm-password');
  const generateBtn = document.getElementById('generate-password-btn');

  // Elements for Strength Meter
  const strengthBar = document.getElementById('password-strength-bar');
  const strengthText = document.getElementById('password-strength-text');

  const errorElements = {
      current: document.getElementById('current-password-error'),
      new: document.getElementById('new-password-error'),
      confirm: document.getElementById('confirm-password-error')
  };

  const clearErrors = () => {
    Object.values(errorElements).forEach(el => el.textContent = '');
    messageEl.textContent = '';
  };
  
  [currentPasswordInput, newPasswordInput, confirmPasswordInput].forEach(input => {
      input.addEventListener('focus', clearErrors);
  });

  // --- Password Strength Logic ---
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
          strengthBar.style.width = '0%';
          strengthBar.className = 'progress-bar';
          strengthText.textContent = 'Strength: None';
          return;
      }

      let width = '0%';
      let colorClass = 'bg-danger';
      let text = 'Weak';

      if (strength <= 2) {
          width = '30%';
          colorClass = 'bg-danger';
          text = 'Weak';
      } else if (strength === 3 || strength === 4) {
          width = '60%';
          colorClass = 'bg-warning';
          text = 'Medium';
      } else if (strength >= 5) {
          width = '100%';
          colorClass = 'bg-success';
          text = 'Strong';
      }

      strengthBar.style.width = width;
      strengthBar.className = `progress-bar ${colorClass}`;
      strengthText.textContent = `Strength: ${text}`;
  };

  // --- Random Password Generator ---
  const generateStrongPassword = () => {
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$@#&!";
      let password = "";
      for (let i = 0; i < 12; i++) {
          password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
  };

  // Event Listeners for Strength & Generation
  newPasswordInput.addEventListener('input', updateStrengthMeter);

  generateBtn.addEventListener('click', () => {
      const strongPass = generateStrongPassword();
      newPasswordInput.value = strongPass;
      confirmPasswordInput.value = strongPass;
      
      // Show password momentarily
      newPasswordInput.type = 'text';
      confirmPasswordInput.type = 'text';
      
      // Trigger validation UI update
      updateStrengthMeter();
      clearErrors();
      
      showNotification("Strong password generated! Please save it.", "info");
  });


  const validateForm = () => {
      clearErrors();
      const currentPass = currentPasswordInput.value;
      const newPass = newPasswordInput.value;
      const confirmPass = confirmPasswordInput.value;
      let isValid = true;

      if (currentPass.length === 0) {
          errorElements.current.textContent = 'Current password is required.';
          isValid = false;
      }

      // 1. FORCED CHECK: Cannot be 'password123'
      if (newPass === 'password123') {
          errorElements.new.textContent = 'You cannot use the default temporary password. Please choose a new one.';
          isValid = false;
      }
      
      // 2. STRENGTH CHECK: Must be at least Medium strength
      if (calculateStrength(newPass) < 3) {
          errorElements.new.textContent = 'Password is too weak. Include uppercase, numbers, or symbols.';
          isValid = false;
      }

      if (newPass.length < 8) {
        errorElements.new.textContent = 'Password must be at least 8 characters.';
        isValid = false;
      }

      if (newPass !== confirmPass) {
          errorElements.confirm.textContent = 'New passwords do not match.';
          isValid = false;
      }

      if (!isValid) {
          messageEl.textContent = 'Please fix the errors above.';
          messageEl.style.color = '#dc3545';
      }

      return isValid;
  };

  // Real-time validation listeners
  confirmPasswordInput.addEventListener('keyup', () => {
      if(newPasswordInput.value === confirmPasswordInput.value) errorElements.confirm.textContent = '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(); 

    if (!validateForm()) {
        return; 
    }
    
    messageEl.textContent = 'Updating...';
    messageEl.style.color = '#666'; 
    
    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;

    try {
      const response = await fetch('https://enrollment-system-production-6820.up.railway.app/change-password', {
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
        appData.password = newPassword; 
        localStorage.setItem("applicationData", JSON.stringify(appData));
        
        showNotification(data.message, 'success');
        messageEl.textContent = '';
        form.reset();
        
        // Reset inputs to password type if generator left them as text
        newPasswordInput.type = 'password';
        confirmPasswordInput.type = 'password';
        
        if (currentPassword === 'password123') { 
            window.location.reload(); 
        }
        
      } else {
        messageEl.textContent = `Error: ${data.message}`;
        messageEl.style.color = '#dc3545';
        
        if (data.message.includes('current password')) {
            errorElements.current.textContent = data.message;
        }
      }

    } catch (err) {
      messageEl.textContent = 'A connection error occurred.';
      messageEl.style.color = '#dc3545';
    }
  });
}

// --- 4. Function to handle logging out ---
function setupLogout() {
  const logoutBtn = document.getElementById('header-logout-btn');
  logoutBtn.addEventListener('click', () => {
    if (!confirm("Are you sure you want to log out?")) {
        return;
    }
    localStorage.removeItem("applicationData"); 
    
    showNotification("Logging out...", "success");
    
    setTimeout(() => {
        window.location.href = "index.html";
    }, 1500);
  });
}

// --- Function to render dynamic checklist ---
function renderEnrollmentChecklist(status) {
    const checklistEl = document.getElementById('enrollment-checklist');
    let html = '';
    
    const checkIcon = '<span class="fa-solid fa-check"></span>'; 
    const pendingIcon = '<span class="fa-solid fa-circle-notch fa-spin"></span>'; 
    const rejectIcon = '<span class="fa-solid fa-xmark"></span>'; 

    const isApproved = status === 'Approved';
    const isPending = status === 'Pending Review';
    const isRejected = status === 'Rejected';

    html += `<div class="checklist-item done">
                ${checkIcon} Application Submitted (Documents Uploaded)
             </div>`;
    
    if (isApproved) {
        html += `<div class="checklist-item done">
                    ${checkIcon} Documents Reviewed by Admin
                 </div>`;
    } else if (isPending) {
         html += `<div class="checklist-item pending">
                    ${pendingIcon} Documents Under Review by Admin
                 </div>`;
    } else if (isRejected) {
        html += `<div class="checklist-item rejected">
                    ${rejectIcon} Documents Rejected (See Admin Note)
                 </div>`;
    }

    if (isApproved) {
        html += `<div class="checklist-item done">
                    ${checkIcon} Enrollment Finalized & Portal Access Granted
                 </div>`;
        html += `<div class="alert alert-success mt-3" style="font-size: 0.9em;">
                    You are all set! View your information tab to see your generated username.
                 </div>`;
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

// --- Function to load student's submitted file links ---
async function loadFullApplicationDetails(appData) {
    const serverUrl = 'https://enrollment-system-production-6820.up.railway.app'; 
    const documentLinksContainer = document.getElementById('document-links-container');
    documentLinksContainer.innerHTML = '<p>Fetching document links...</p>';

    try {
        const response = await fetch(`${serverUrl}/get-application-details/${appData.id}`);
        const data = await response.json();

        if (!data.success) {
            documentLinksContainer.innerHTML = `<p style="color:red;">Error loading documents: ${data.message}</p>`;
            return;
        }

        const fullApp = data.application;
        let linksHtml = '';
        
        const getMockStatus = (docName) => {
            if (appData.status === 'Approved') return 'Verified';
            if (appData.status === 'Rejected') {
                return docName.includes('Card') ? 'Rejected' : 'Pending';
            }
            return 'Pending';
        };

        const docs = [
            { path: fullApp.doc_card_path, name: "School Card (Previous Grade)" },
            { path: fullApp.doc_psa_path, name: "PSA (Birth Certificate)" },
            { path: fullApp.doc_f137_path, name: "FORM 137/SF10 (Academic Records)" },
            { path: fullApp.doc_brgy_cert_path, name: "Barangay Certificate" }
        ];

        docs.forEach(doc => {
            if (doc.path) {
                const status = getMockStatus(doc.name);
                const statusClass = `doc-status-${status.toLowerCase()}`;
                
                linksHtml += `
                    <div class="file-link-wrapper">
                        <a href="${serverUrl}/uploads/${doc.path}" target="_blank" class="file-link">
                            <span class="fa-solid fa-file-pdf"></span> 
                            <span>${doc.name}</span>
                        </a>
                        <span class="doc-status-tag ${statusClass}">${status}</span>
                    </div>`;
            }
        });

        documentLinksContainer.innerHTML = linksHtml || "<p>No documents found or links failed to load.</p>";

    } catch (error) {
        console.error('Error fetching application details for student:', error);
        document.getElementById('document-links-container').innerHTML = '<p style="color:red;">Network error. Failed to load document links.</p>';
    }
}

// --- Function to update the progress bar visuals ---
function updateEnrollmentProgress(status) {
    const progressBar = document.getElementById('enrollment-progress-bar');
    const progressText = document.getElementById('progress-text');
    let percentage = 0;
    let className = 'bg-warning';
    
    if (!progressBar || !progressText) return;

    if (status === 'Pending Review') {
        percentage = 60;
        className = 'bg-warning progress-bar-animated';
    } else if (status === 'Approved') {
        percentage = 100;
        className = 'bg-success';
    } else if (status === 'Rejected') {
        percentage = 10; 
        className = 'bg-danger';
    } else {
        percentage = 0;
        className = 'bg-secondary';
    }

    progressBar.style.width = `${percentage}%`;
    progressBar.setAttribute('aria-valuenow', percentage);
    progressBar.className = `progress-bar progress-bar-striped ${className}`;
    progressText.textContent = `${percentage}% Complete`;
    
    if (percentage === 100) {
        progressBar.classList.remove('progress-bar-animated', 'progress-bar-striped');
    }
}

// --- Function to handle Mobile Sidebar Toggle ---
function setupMobileToggle() {
    const toggleBtn = document.getElementById('mobile-sidebar-toggle');
    const sidebar = document.querySelector(".sidebar");
    
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('sidebar-open');
        });
    }
}

// --- NEW: Re-enrollment Logic (UPDATED: CHECKS SERVER STATUS + FILE UPLOAD) ---
async function setupReEnrollment(appData) {
    const btn = document.getElementById('btn-re-enroll');
    const select = document.getElementById('next-grade-select');
    const actionCenter = document.getElementById('action-center-widget'); 
    const fileInput = document.getElementById('re-enroll-card'); // FILE INPUT

    if (!btn || !select || !actionCenter || !fileInput) return;

    // 1. Check if Enrollment is CLOSED globally
    try {
        const statusRes = await fetch('https://enrollment-system-production-6820.up.railway.app/get-enrollment-status');
        const statusData = await statusRes.json();
        
        if (statusData.success && !statusData.isOpen) {
            btn.disabled = true;
            btn.textContent = "Enrollment Closed";
            btn.classList.remove('btn-success');
            btn.classList.add('btn-secondary');
            select.disabled = true;
            fileInput.disabled = true; // Disable file input too
            
            const notice = document.createElement('p');
            notice.className = 'text-danger small fw-bold mt-2 mb-0';
            notice.innerHTML = '<i class="fa-solid fa-lock"></i> Enrollment period is currently closed by the admin.';
            actionCenter.querySelector('.d-flex.flex-column').appendChild(notice);
            return; 
        }
    } catch(e) {
        console.error("Failed to check status", e);
    }

    // 2. Existing Logic (Grade Check)
    const currentGrade = parseInt(appData.grade_level.replace(/\D/g, '')); 
    if (currentGrade >= 10) {
        actionCenter.style.display = 'none'; 
        return;
    }

    const nextGradeLevel = currentGrade + 1;
    const allOptions = select.querySelectorAll('option');
    
    allOptions.forEach(opt => {
        if (opt.disabled) return; 
        const optGrade = parseInt(opt.value.replace(/\D/g, ''));
        
        if (optGrade === nextGradeLevel) {
            opt.style.display = 'block'; 
        } else {
            opt.style.display = 'none'; 
        }
    });

    if (appData.status === 'Pending Review') {
        btn.disabled = true;
        btn.textContent = 'Application Under Review';
        btn.className = 'btn btn-secondary fw-bold'; 
        select.disabled = true;
        fileInput.disabled = true;
        return;
    }

    btn.addEventListener('click', async () => {
        const nextGrade = select.value;

        if (nextGrade === "Select Next Grade Level") {
            alert("Please select the grade level you are enrolling for.");
            return;
        }

        // File Validation
        if (fileInput.files.length === 0) {
            alert("Please upload your previous Report Card to proceed.");
            return;
        }

        if (!confirm(`Are you sure you want to enroll for ${nextGrade}?`)) {
            return;
        }

        btn.disabled = true;
        btn.textContent = "Uploading...";

        // Create FormData for file upload
        const formData = new FormData();
        formData.append('applicationId', appData.id);
        formData.append('nextGradeLevel', nextGrade);
        formData.append('school_card', fileInput.files[0]);

        try {
            const response = await fetch('https://enrollment-system-production-6820.up.railway.app/student-re-enroll', {
                method: 'POST',
                body: formData // Use formData instead of JSON
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


// --- 5. Main function ---
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

  loadAnnouncements();
  setupPasswordToggle(); 
  setupPasswordForm(appData);
  setupLogout();
  loadFullApplicationDetails(appData); 
  setupReEnrollment(appData);

  document.getElementById("student-name").textContent = appData.first_name;
  document.getElementById("student-name-full").textContent = `${appData.first_name} ${appData.last_name}`;
  
  const formattedGrade = appData.grade_level.includes('Grade') ? appData.grade_level : `Grade ${appData.grade_level}`;
  document.getElementById("status-summary-text").textContent = `${appData.status} (${formattedGrade})`;

  const statusMessageEl = document.getElementById("status-message");
  statusMessageEl.textContent = appData.status;
  statusMessageEl.className = `status-${appData.status.replace(/ /g, '')} mb-4`; 

  renderEnrollmentChecklist(appData.status);
  updateEnrollmentProgress(appData.status);
  
  document.getElementById("detail-name").textContent = `${appData.first_name} ${appData.middle_name || ''} ${appData.last_name}`;
  document.getElementById("detail-grade").textContent = formattedGrade;
  document.getElementById("detail-bday").textContent = appData.birthdate ? new Date(appData.birthdate).toLocaleDateString() : 'N/A';
  document.getElementById("detail-email").textContent = appData.email;
  document.getElementById("detail-phone").textContent = appData.phone;
  document.getElementById("detail-username").textContent = appData.username;
  
  if (window.VanillaTilt) {
      VanillaTilt.init(document.querySelectorAll("[data-tilt]"), {
      });
  }
});
