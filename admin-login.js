document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('admin-login-form');
  const errorMessage = document.getElementById('error-message');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Stop the form from reloading
    
    // Clear old errors
    errorMessage.textContent = '';

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
        // --- LOGIN SUCCESSFUL! ---
        // Redirect to the admin dashboard
        alert('Admin login successful!');
        window.location.href = 'admin.html';
      } else {
        // --- LOGIN FAILED ---
        errorMessage.textContent = data.message;
      }

    } catch (err) {
      errorMessage.textContent = 'Cannot connect to server. Please try again later.';
    }
  });
});