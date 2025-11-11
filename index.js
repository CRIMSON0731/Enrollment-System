document.addEventListener('DOMContentLoaded', () => {
  // IDs updated to be unique
  const loginForm = document.getElementById('admin-login-form');
  const errorMessage = document.getElementById('admin-error-message');

  // CRITICAL FIX: Only attach listener if the form exists on the page
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault(); // Stop the form from reloading
      
      errorMessage.textContent = '';

      // IDs updated to be unique
      const username = document.getElementById('admin-username').value;
      const password = document.getElementById('admin-password').value;

      try {
        const response = await fetch('http://localhost:3000/admin-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
          // NOTE: This uses alert(); should be updated to showNotification() for consistency
          alert('Admin login successful!');
          window.location.href = 'admin.html';
        } else {
          errorMessage.textContent = data.message;
        }

      } catch (err) {
        errorMessage.textContent = 'Cannot connect to server. Please try again later.';
      }
    });
  }
});