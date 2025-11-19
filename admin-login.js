document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('admin-login-form');
  const passwordInput = document.getElementById('password');
  const togglePasswordBtn = document.getElementById('toggle-password');
  const eyeIcon = document.getElementById('eye-icon');
  const eyeOffIcon = document.getElementById('eye-off-icon');
  
  // --- PASSWORD VISIBILITY TOGGLE ---
  togglePasswordBtn.addEventListener('click', () => {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    
    // Toggle icon visibility
    if (type === 'text') {
      eyeIcon.style.display = 'none';
      eyeOffIcon.style.display = 'block';
    } else {
      eyeIcon.style.display = 'block';
      eyeOffIcon.style.display = 'none';
    }
  });
  
  // --- NOTIFICATION FUNCTION ---
  function showNotification(message, type) {
    const notification = document.getElementById('notification-bar');
    
    // Set the text and style
    notification.textContent = message;
    notification.className = `notification-bar ${type}`;
    
    // Slide it in
    notification.classList.add('show');
    
    // Hide it after 3 seconds
    setTimeout(() => {
      notification.classList.remove('show');
    }, 3000);
  }
  
  // --- FORM SUBMIT HANDLER ---
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
      
      if (data.success) {
        // Set the token flag upon successful login
        localStorage.setItem('adminToken', 'true');
        
        // --- NEW: SAVE USERNAME FOR PASSWORD CHANGE FEATURE ---
        // This is required so admin.js knows which user is logged in
        localStorage.setItem('adminUsername', username); 

        // Check if password needs updating (backend should provide this)
        if (data.passwordNeedsUpdate) {
          showNotification('Login successful! Please update your default password.', 'warning');
          setTimeout(() => {
            window.location.href = 'admin.html';
          }, 2000);
        } else {
          showNotification('Login successful! Redirecting...', 'success');
          setTimeout(() => {
            window.location.href = 'admin.html';
          }, 1000);
        }
      } else {
        showNotification(data.message, 'error');
      }
    } catch (err) {
      showNotification('Cannot connect to server. Please try again later.', 'error');
    }
  });
});
