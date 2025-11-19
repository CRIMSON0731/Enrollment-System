// File: index.js (Using custom #notification-bar for fixed visibility)

document.addEventListener('DOMContentLoaded', () => {
    
    // --- HEADER SCROLL BEHAVIOR ---
    let lastScrollTop = 0;
    const navbar = document.querySelector('.navbar');
    const scrollThreshold = 100; // Pixels to scroll before hiding header
    
    // Initialize header as visible
    if (navbar) {
        navbar.classList.add('show-header');
    }
    
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
    
    
    // --- CUSTOM Notification Bar Elements ---
    const notificationBarEl = document.getElementById('notification-bar'); 
    
    if (!notificationBarEl) {
        console.error("Custom notification bar with ID 'notification-bar' not found.");
        return; 
    }

    // --- MODIFIED: Custom Notification Function ---
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
        }
        
        // 4. Force Visibility and Position
        notificationBarEl.style.transition = 'none';
        notificationBarEl.style.top = '-100px'; 

        setTimeout(() => {
            notificationBarEl.style.transition = 'top 0.5s ease-out'; 
            notificationBarEl.classList.add('show');
        }, 10); 
    }
    
    // --- NEW CHECK: Handle Enrollment Submission Success Message ---
    const successMessage = sessionStorage.getItem('submissionSuccess');
    if (successMessage) {
        showNotification(successMessage, 'success');
        sessionStorage.removeItem('submissionSuccess');
    }


    // ============================================================
    // 1. STUDENT LOGIN LOGIC
    // ============================================================
    const loginForm = document.getElementById('student-login-form'); 
    const usernameInput = document.getElementById('student-username');
    const passwordInput = document.getElementById('student-password');
    let currentUsername = null; 

    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmission);
    }
    
    async function handleLoginSubmission(e) {
        e.preventDefault(); 
        
        currentUsername = usernameInput.value;
        const password = passwordInput.value;

        const submitBtn = loginForm.querySelector('button[type="submit"]');

        showNotification('Verifying credentials...', 'info');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Loading...';
        }

        try {
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
                showNotification('SECURITY ALERT: Please change your temporary password immediately.', 'error');
                localStorage.setItem("applicationData", JSON.stringify(data.application));
                setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
            } else {
                showNotification('Login successful! Redirecting...', 'success');
                localStorage.setItem("applicationData", JSON.stringify(data.application));
                setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
            }

        } catch (err) {
            console.error("Login Network Error:", err);
            showNotification('Cannot connect to server. Please try again later.', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Log In';
            }
        }
    }

    // ============================================================
    // 2. INQUIRY FORM SUBMISSION LOGIC (NEWLY ADDED)
    // ============================================================
    const inquiryForm = document.getElementById('inquiry-form');
    
    if (inquiryForm) {
        inquiryForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent page reload
            
            const submitBtn = inquiryForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            
            // Disable button to prevent double submission
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';
            showNotification('Sending inquiry...', 'info');

            // Collect data manually
            const formData = new FormData();
            formData.append('name', document.getElementById('inquiry-name').value);
            formData.append('email', document.getElementById('inquiry-email').value);
            formData.append('subject', document.getElementById('inquiry-subject').value);
            formData.append('message', document.getElementById('inquiry-message').value);
            
            const fileInput = document.getElementById('inquiry-file');
            if (fileInput.files[0]) {
                formData.append('attachment', fileInput.files[0]);
            }

            try {
                // Send to server
                const response = await fetch('https://enrollment-system-production-6820.up.railway.app/submit-inquiry', {
                    method: 'POST',
                    body: formData // No headers needed for FormData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showNotification('Inquiry sent successfully! We will review it shortly.', 'success');
                    inquiryForm.reset(); // Clear the form
                } else {
                    showNotification(`Error: ${data.message}`, 'error');
                }
            } catch (error) {
                console.error("Inquiry Error:", error);
                showNotification('Network error. Please check your connection.', 'error');
            } finally {
                // Reset button
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }
});
