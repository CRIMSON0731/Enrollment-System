// File: index.js

document.addEventListener('DOMContentLoaded', () => {
    
    // --- CONFIGURATION ---
    const API_BASE_URL = 'https://enrollment-system-production-6820.up.railway.app';

    // --- HEADER SCROLL BEHAVIOR ---
    let lastScrollTop = 0;
    const navbar = document.querySelector('.navbar');
    const scrollThreshold = 100; 
    
    if (navbar) {
        navbar.classList.add('show-header');
    }
    
    window.addEventListener('scroll', () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > scrollThreshold) {
            if (scrollTop > lastScrollTop) {
                navbar.classList.add('hide-header');
                navbar.classList.remove('show-header');
            } else {
                navbar.classList.remove('hide-header');
                navbar.classList.add('show-header');
            }
        } else {
            navbar.classList.remove('hide-header');
            navbar.classList.add('show-header');
        }
        lastScrollTop = scrollTop;
    });
    
    document.addEventListener('mousemove', (e) => {
        if (e.clientY < 80) {
            navbar.classList.remove('hide-header');
            navbar.classList.add('show-header');
        }
    });

    // --- NOTIFICATION SYSTEM (Top Bar) ---
    const notificationBarEl = document.getElementById('notification-bar'); 
    
    function showNotification(message, type) {
        if (!notificationBarEl) return;
        notificationBarEl.classList.remove('show'); 
        notificationBarEl.className = 'notification-bar';
        notificationBarEl.textContent = message;
        
        if (type === 'success') notificationBarEl.classList.add('success');
        else if (type === 'error') notificationBarEl.classList.add('error');
        else if (type === 'info') notificationBarEl.classList.add('info');
        
        notificationBarEl.style.transition = 'none';
        notificationBarEl.style.top = '-100px'; 

        setTimeout(() => {
            notificationBarEl.style.transition = 'top 0.5s ease-out';
            notificationBarEl.classList.add('show');
        }, 10); 
    }
    
    const successMessage = sessionStorage.getItem('submissionSuccess');
    if (successMessage) {
        showNotification(successMessage, 'success');
        sessionStorage.removeItem('submissionSuccess');
    }

    // --- SOCKET.IO (REAL-TIME NOTIFICATIONS) ---
    const socket = io(API_BASE_URL); 

    // Global listener (in case the user is already watching from a previous session)
    socket.on('inquiryReplied', (data) => {
        // We use SweetAlert here for high visibility when a reply comes in
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'info',
                title: 'New Message',
                text: data.message,
                confirmButtonText: 'Check Email'
            });
        } else {
            showNotification('🔔 ' + data.message, 'info'); 
        }
    });

    // ============================================================
    // 1. STUDENT LOGIN LOGIC
    // ============================================================
    const loginForm = document.getElementById('student-login-form'); 
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            
            const usernameInput = document.getElementById('student-username');
            const passwordInput = document.getElementById('student-password');
            const submitBtn = loginForm.querySelector('button[type="submit"]');

            showNotification('Verifying credentials...', 'info');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Loading...';
            }

            try {
                // Using API_BASE_URL variable
                const response = await fetch(`${API_BASE_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: usernameInput.value, password: passwordInput.value })
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
        });
    }

    // ============================================================
    // 2. INQUIRY FORM SUBMISSION LOGIC (UPDATED WITH SWEETALERT)
    // ============================================================
    const inquiryForm = document.getElementById('inquiry-form');
    
    if (inquiryForm) {
        inquiryForm.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            
            // Check if SweetAlert is loaded, otherwise fallback
            if (typeof Swal === 'undefined') {
                alert("SweetAlert2 script is missing from HTML. Please add it.");
                return;
            }

            // 1. Show Loading Popup
            Swal.fire({
                title: 'Sending inquiry...',
                text: 'Please wait while we upload your message.',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

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
                // Using API_BASE_URL variable
                const response = await fetch(`${API_BASE_URL}/submit-inquiry`, {
                    method: 'POST',
                    body: formData 
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // 2. Show Success Popup
                    Swal.fire({
                        icon: 'success',
                        title: 'Inquiry Sent!',
                        text: 'We have received your message. If the admin replies while you are here, you will be notified.',
                        timer: 3000,
                        showConfirmButton: false
                    });

                    inquiryForm.reset();
                    
                    // 3. REAL-TIME WATCH LOGIC
                    // If the server returned an inquiryId, we tell Socket.io to "watch" this specific ID
                    if (data.inquiryId) {
                        socket.emit('watchInquiry', data.inquiryId);
                        console.log("Socket is watching inquiry #" + data.inquiryId);
                        
                        // We are now listening for the 'inquiryReplied' event (handled by the global listener above)
                    }

                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Failed',
                        text: data.message
                    });
                }
            } catch (error) {
                console.error("Inquiry Error:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Network Error',
                    text: 'Could not connect to the server. Please check your internet.'
                });
            }
        });
    }

    // ============================================================
    // 3. FORGOT PASSWORD LOGIC
    // ============================================================
    const forgotPasswordForm = document.getElementById('forgot-password-form');

    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const emailInput = document.getElementById('reset-email');
            const submitBtn = forgotPasswordForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;

            // UI Feedback
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';

            try {
                // Using API_BASE_URL variable
                const response = await fetch(`${API_BASE_URL}/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailInput.value })
                });

                const data = await response.json();

                if (data.success) {
                    // Close the modal
                    const modalEl = document.getElementById('forgotPasswordModal');
                    // We assume 'bootstrap' global is available since bootstrap.bundle.min.js is included
                    if (typeof bootstrap !== 'undefined') {
                        const modalInstance = bootstrap.Modal.getInstance(modalEl);
                        if (modalInstance) modalInstance.hide();
                    }

                    // Show success message
                    showNotification('Password reset link sent! Check your email.', 'success');
                    forgotPasswordForm.reset();
                } else {
                    showNotification(data.message || 'Email not found.', 'error');
                }

            } catch (error) {
                console.error("Reset Password Error:", error);
                showNotification('Network error. Please try again later.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        });
    }

    // ============================================================
    // 4. TOGGLE PASSWORD VISIBILITY
    // ============================================================
    const togglePassword = document.querySelector('#togglePassword');
    const passwordInput = document.querySelector('#student-password');

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function () {
            // 1. Toggle the type attribute
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            // 2. Toggle the eye icon class
            const icon = this.querySelector('i');
            if (type === 'text') {
                icon.classList.remove('bi-eye-fill');
                icon.classList.add('bi-eye-slash-fill'); // Show "Slash" eye
            } else {
                icon.classList.remove('bi-eye-slash-fill');
                icon.classList.add('bi-eye-fill'); // Show normal eye
            }
        });
    }
});
