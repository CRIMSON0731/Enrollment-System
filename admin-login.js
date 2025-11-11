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
      const response = await fetch('http://localhost:3000/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (data.success) {
        // --- REPLACED! ---
        // Old: alert('Admin login successful!');
        showNotification('Admin login successful!', 'success');
        
        // Redirect AFTER the notification is seen
        setTimeout(() => {
          window.location.href = 'admin.html';
        }, 1000); // Wait 1 second before redirecting

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