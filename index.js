// File: index.js

document.addEventListener('DOMContentLoaded', () => {
    
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

    // --- NOTIFICATION SYSTEM ---
    const notificationBarEl = document.getElementById('notification-bar'); 
    
    function showNotification(message, type) {
        if (!notificationBarEl) return;
        notificationBarEl.classList.remove('show'); 
        notificationBarEl.className = 'notification-bar';
        notificationBarEl.textContent = message;
        
        if (type === 'success') notificationBarEl.classList.add('success');
        else if (type === 'error') notificationBarEl.classList.add('error');
        
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
    const socket = io('https://enrollment-system-production-6820.up.railway.app'); 

    socket.on('inquiryReplyReceived', (data) => {
        showNotification('🔔 ' + data.message, 'info'); 
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
                const response = await fetch('https://enrollment-system-production-6820.up.railway.app/login', {
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
    // 2. INQUIRY FORM SUBMISSION LOGIC
    // ============================================================
    const inquiryForm = document.getElementById('inquiry-form');
    
    if (inquiryForm) {
        inquiryForm.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            
            const submitBtn = inquiryForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';
            showNotification('Sending inquiry...', 'info');

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
                const response = await fetch('https://enrollment-system-production-6820.up.railway.app/submit-inquiry', {
                    method: 'POST',
                    body: formData 
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showNotification('Inquiry sent successfully! Please check your email for our reply.', 'success');
                    inquiryForm.reset();
                    
                    // Watch for this specific inquiry ID
                    if (data.inquiryId) {
                        socket.emit('watchInquiry', data.inquiryId);
                        console.log("Watching inquiry #" + data.inquiryId);
                    }
                } else {
                    showNotification(`Error: ${data.message}`, 'error');
                }
            } catch (error) {
                console.error("Inquiry Error:", error);
                showNotification('Network error. Please check your connection.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }
});
