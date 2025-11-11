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
        // Use the new notification for success too!
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

// --- 4. Function to handle logging out (UPDATED) ---
function setupLogout() {
  const logoutBtn = document.getElementById('header-logout-btn');
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem("applicationData"); 
    
    // --- REPLACED ALERT WITH NOTIFICATION ---
    showNotification("Logging out...", "success");
    
    // Wait 1.5 seconds before redirecting so they see the message
    setTimeout(() => {
        window.location.href = "index.html";
    }, 1500);
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

  loadAnnouncements();
  setupNavigation();
  setupPasswordForm(appData);
  setupLogout();

  document.getElementById("student-name").textContent = appData.first_name;
  
  const statusMessageEl = document.getElementById("status-message");
  statusMessageEl.textContent = appData.status;
  statusMessageEl.className = `status-${appData.status.replace(/ /g, '')}`;

  document.getElementById("detail-name").textContent = `${appData.first_name} ${appData.middle_name || ''} ${appData.last_name}`;
  document.getElementById("detail-grade").textContent = `Grade ${appData.grade_level}`;
  // Handle potential missing birthdate if it wasn't saved correctly before
  document.getElementById("detail-bday").textContent = appData.birthdate ? new Date(appData.birthdate).toLocaleDateString() : 'N/A';
  document.getElementById("detail-email").textContent = appData.email;
  document.getElementById("detail-phone").textContent = appData.phone;
  document.getElementById("detail-username").textContent = appData.username;
});