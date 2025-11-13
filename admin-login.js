document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('admin-login-form');
  
  // --- 1. Our new Notification Function ---
  // This function controls the new notification bar
  function showNotification(message, type) {
    const notification = document.getElementById('notification-bar');
    
    // Set the text and style
    notification.textContent = message;
    notification.className = `notification-bar ${type}`; // e.g., "notification-bar success"
    
    // Slide it in
    notification.classList.add('show');
    
    // Hide it after 3 seconds
    setTimeout(() => {
      notification.classList.remove('show');
    }, 3000);
  }

  // --- 2. Our Updated Form Listener ---
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Stop the form from reloading
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
      const response = await fetch('https://enrollment-system-production-6820.up.railway.app/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      // Inside the function that handles the /admin-login POST response:
if (data.success) {
    // CRITICAL: Set the token flag upon successful login
    localStorage.setItem('adminToken', 'true'); 
    
    // Then redirect to the admin panel
    window.location.href = 'admin.html';
  
      } else {
        // --- REPLACED! ---
        // Old: errorMessage.textContent = data.message;
        showNotification(data.message, 'error');
      }

    } catch (err) {
      // --- REPLACED! ---
      // Old: errorMessage.textContent = 'Cannot connect...';
      showNotification('Cannot connect to server. Please try again later.', 'error');
    }
  });
});
