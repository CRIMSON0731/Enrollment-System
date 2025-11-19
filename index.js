// File: index.js (Using custom #notification-bar for fixed visibility)

document.addEventListener('DOMContentLoaded', () => {
    
    // --- HEADER SCROLL BEHAVIOR ---
    let lastScrollTop = 0;
    const navbar = document.querySelector('.navbar');
    const scrollThreshold = 100; // Pixels to scroll before hiding header
    
    window.addEventListener('scroll', () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > scrollThreshold) {
            if (scrollTop > lastScrollTop) {
                // Scrolling down - hide header
                navbar.classList.add('hide-header');
                navbar.classList.remove('show-header');
            } else {
                // Scrolling up - show header
                navbar.classList.remove('hide-header');
                navbar.classList.add('show-header');
            }
        } else {
            // Near top - always show header
            navbar.classList.remove('hide-header');
            navbar.classList.add('show-header');
        }
        
        lastScrollTop = scrollTop;
    });
    
    // Show header when mouse moves to top of screen
    document.addEventListener('mousemove', (e) => {
        if (e.clientY < 80) {
            navbar.classList.remove('hide-header');
            navbar.classList.add('show-header');
        }
    });
    // --- END HEADER SCROLL BEHAVIOR ---
    
    const loginForm = document.getElementById('student-login-form'); 
    
    // --- CUSTOM Notification Bar Elements ---
    const notificationBarEl = document.getElementById('notification-bar'); // Targeting the existing element
    
    // Inputs
    const usernameInput = document.getElementById('student-username');
    const passwordInput = document.getElementById('student-password');

    let currentUsername = null; 
    
    if (!notificationBarEl) {
        console.error("Custom notification bar with ID 'notification-bar' not found.");
        return; 
    }

    // --- MODIFIED: Custom Notification Function (NO HIDE TIMER - STAYS VISIBLE) ---
    function showNotification(message, type) {
        
        // 1. Reset / Prepare for New Message
        notificationBarEl.classList.remove('show'); 
        notificationBarEl.className = 'notification-bar';
        
        // 2. Set the message content
        notificationBarEl.textContent = message;
        
        // 3. Apply style and color class
        if (type === 'success') {
            notificationBarEl.classList.add('success');
        } else if (type === 'error') {
            notificationBarEl.classList.add('error');
        } else {
            // For 'info' status, we rely on the default notification-bar style (or add a separate 'info' class if defined in index.css)
            // Assuming no separate 'info' class is defined in index.css, only success/error are styled.
        }
        
        // 4. Force Visibility and Position (The final override to ensure it stays)
        // Set transition property temporarily to force a clear state
        notificationBarEl.style.transition = 'none';
        notificationBarEl.style.top = '-100px'; 

        // Use a short timeout to re-enable transition and trigger visibility
        setTimeout(() => {
            notificationBarEl.style.transition = 'top 0.5s ease-out'; // Re-enable CSS transition from index.css
            notificationBarEl.classList.add('show');
        }, 10); // A small delay to ensure the browser registers the top change before transitioning
    }
    
    // --- NEW CHECK: Handle Enrollment Submission Success Message ---
    const successMessage = sessionStorage.getItem('submissionSuccess');
    if (successMessage) {
        showNotification(successMessage, 'success');
        sessionStorage.removeItem('submissionSuccess');
    }
    // --- END NEW CHECK ---


    // --- Step 1: Initial Login (Credential Submission) ---
    loginForm.addEventListener('submit', handleLoginSubmission);
    
    async function handleLoginSubmission(e) {
        e.preventDefault(); 
        
        currentUsername = usernameInput.value;
        const password = passwordInput.value;

        // Find the submit button element
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        showNotification('Verifying credentials...', 'info');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Loading...';
        }

        try {
            // API Call 1: Attempt login. 
            const response = await fetch('https://enrollment-system-production-6820.up.railway.app/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentUsername, password })
            });

            const data = await response.json();
            
            if (!data.success) {
                showNotification(data.message, 'error');
                return;
            }

            if (data.firstLogin) {
                // --- FORCED PASSWORD CHANGE TRIGGER ---
                showNotification('SECURITY ALERT: Please change your temporary password immediately.', 'error');
                
                // Store data and redirect.
                localStorage.setItem("applicationData", JSON.stringify(data.application));
                
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
                
                return;

            } else {
                // --- Standard Login Success ---
                showNotification('Login successful! Redirecting...', 'success');
                localStorage.setItem("applicationData", JSON.stringify(data.application));
                
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            }

        } catch (err) {
            console.error("Login Network Error:", err);
            showNotification('Cannot connect to server. Please try again later.', 'error');
        } finally {
            // Reset button state
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Log In';
            }
        }
    }
});
