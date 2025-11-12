// --- 1. NEW: Notification Function ---
function showNotification(message, type) {
  const notification = document.getElementById('notification-bar');
  if (!notification) {
    console.error("Notification bar element not found.");
    return;
  }
  
  notification.textContent = message;
  notification.className = `notification-bar ${type}`;
  notification.classList.add('show');
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 8000); // Show for 8 seconds
}

// --- 2. MODIFIED: DOMContentLoaded Listener ---
document.addEventListener('DOMContentLoaded', () => {
  
  // --- A) Check for Submission Success Message ---
  const successMessage = sessionStorage.getItem('submissionSuccess');
  if (successMessage) {
    showNotification(successMessage, 'success');
    sessionStorage.removeItem('submissionSuccess');
  }
});


// --- 3. Student Login Form Logic ---
const loginForm = document.getElementById('student-login-form');
const errorMessage = document.getElementById('student-error-message');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault(); 
  errorMessage.textContent = ''; 

  const username = document.getElementById('student-username').value;
  const password = document.getElementById('student-password').value;

  try {
    const response = await fetch('http://localhost:3000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (data.success) {
      localStorage.setItem('applicationData', JSON.stringify(data.application));
      
      if (data.firstLogin) {
        sessionStorage.setItem('showWelcomeModal', 'true');
      }
      
      window.location.href = 'dashboard.html';
    } else {
      errorMessage.textContent = data.message;
    }

  } catch (err) {
    errorMessage.textContent = 'Cannot connect to server. Please try again later.';
  }
});