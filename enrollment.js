// File: enrollment.js (Script for Enrollment page.html)

document.addEventListener('DOMContentLoaded', () => {
    console.log("Enrollment script loaded."); 
    
    const enrollmentForm = document.getElementById('enrollment-form'); 
    
    // --- Custom Notification Bar Elements ---
    const notificationBarEl = document.getElementById('notification-bar');
    const submitEnrollmentBtn = document.getElementById('submit-enrollment-btn'); 
    
    if (!notificationBarEl) {
        console.error("Custom notification bar with ID 'notification-bar' not found.");
        return; 
    }

    // IMPORTANT: Disable default HTML5 validation to prevent "focus jumps"
    if (enrollmentForm) {
        enrollmentForm.noValidate = true;
    }

    // --- Helper Functions (Validation) ---
    addFileLimitNotices(); // UPDATED for multiple files
    addAgeValidation();
    addNameValidation();
    addRequiredFieldValidation();
    addPhoneValidation(); 

    function showNotification(message, type, persistent = false) {
        notificationBarEl.classList.remove('show'); 
        notificationBarEl.className = 'notification-bar';
        notificationBarEl.textContent = message;
        
        if (type === 'success') notificationBarEl.classList.add('success');
        else if (type === 'error') notificationBarEl.classList.add('error');
        else if (type === 'info') notificationBarEl.classList.add('info');
        
        notificationBarEl.classList.add('show');
        
        if (!persistent) {
             setTimeout(() => { notificationBarEl.classList.remove('show'); }, 4000); 
        }
    }
    
    function hideNotification() {
        notificationBarEl.classList.remove('show');
    }

    // --- STRICT PHONE NUMBER VALIDATION ---
    function addPhoneValidation() {
        const phoneInput = enrollmentForm.querySelector('[name="phone_num"]');
        if (phoneInput) {
            
            // 1. Force type to "text" to allow '+' symbol without browser errors
            phoneInput.type = "text"; 
            phoneInput.removeAttribute('maxlength'); 

            // 2. Set Default Value on Load
            if (!phoneInput.value) {
                phoneInput.value = "+63";
            }

            // 3. Prevent deleting the "+63" prefix
            phoneInput.addEventListener('keydown', function(e) {
                const cursorPosition = this.selectionStart;
                if ((e.key === 'Backspace' || e.key === 'Delete') && cursorPosition <= 3 && this.value.length <= 3) {
                    e.preventDefault();
                }
                if (cursorPosition < 3 && e.key !== 'ArrowRight') {
                   this.setSelectionRange(3, 3);
                }
            });

            // 4. Input Logic
            phoneInput.addEventListener('input', function(e) {
                this.classList.remove('is-invalid'); // Clear error immediately on type

                let val = this.value;
                
                // Ensure it always starts with +63
                if (!val.startsWith("+63")) {
                    val = "+63" + val.replace(/^\+63|^63|^\+/, ""); 
                }

                const prefix = "+63";
                let rest = val.substring(3);
                
                // Remove letters/symbols
                rest = rest.replace(/[^0-9]/g, '');

                // Remove leading '0' (e.g., +6309 -> +639)
                if (rest.startsWith('0')) {
                    rest = rest.substring(1);
                }
                
                // Strict Length Limit: 10 digits (Total 13 characters)
                if (rest.length > 10) {
                    rest = rest.substring(0, 10);
                    showNotification('⚠️ Maximum length reached (13 characters).', 'info', false);
                }

                this.value = prefix + rest;
            });

            // 5. Reset on Focus
            phoneInput.addEventListener('focus', function() {
                if (this.value === '' || this.value === '+') {
                    this.value = "+63";
                }
            });
        }
    }

    // --- UPDATED: Handles Multiple Files Validation ---
    function addFileLimitNotices() {
        const fileInputs = enrollmentForm.querySelectorAll('input[type="file"]');
        fileInputs.forEach(input => {
            const notice = document.createElement('small');
            notice.className = 'text-muted d-block mt-1';
            notice.style.fontSize = '0.85rem';
            notice.textContent = '📎 Max 5MB per file | Accepted formats: PDF, JPG, PNG';
            if (input.parentElement) input.parentElement.appendChild(notice);
            
            input.addEventListener('change', function(e) {
                const files = e.target.files; // Get all selected files
                
                if (files.length > 0) {
                    for (let i = 0; i < files.length; i++) {
                        // Check size for EACH file
                        if (files[i].size > 5 * 1024 * 1024) {
                            showNotification(`File "${files[i].name}" exceeds 5MB limit.`, 'error');
                            input.value = ''; // Clear the input if ANY file is too big
                            return; // Stop checking
                        }
                    }
                }
            });
        });
    }
    
    function addAgeValidation() {
        const birthdate = enrollmentForm.querySelector('[name="birthdate"]');
        if (birthdate) {
            birthdate.addEventListener('change', function() {
                if (this.value) {
                    const birthDate = new Date(this.value);
                    const today = new Date();
                    let age = today.getFullYear() - birthDate.getFullYear();
                    const monthDiff = today.getMonth() - birthDate.getMonth();
                    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
                    
                    if (age < 11) {
                        showNotification('⚠️ Applicants must be at least 11 years old.', 'error', true);
                        this.classList.add('is-invalid');
                    } else {
                        this.classList.remove('is-invalid');
                        hideNotification();
                    }
                }
            });
        }
    }

    function addNameValidation() {
        const names = enrollmentForm.querySelectorAll('[name="first_name"], [name="middle_name"], [name="last_name"]');
        names.forEach(field => {
            field.addEventListener('input', function() {
                const val = this.value;
                if (!/^[a-zA-Z\s\-'\.]*$/.test(val)) {
                    this.value = val.replace(/[^a-zA-Z\s\-'\.]/g, '');
                    showNotification('⚠️ Names can only contain letters and basic punctuation.', 'error', true);
                    this.classList.add('is-invalid');
                } else {
                    this.classList.remove('is-invalid');
                    hideNotification();
                }
            });
        });
    }

    function addRequiredFieldValidation() {
        const required = enrollmentForm.querySelectorAll('[required]');
        required.forEach(field => {
            field.addEventListener('blur', function() {
                if (!this.value || (this.tagName === 'SELECT' && this.value === '')) {
                    this.classList.add('is-invalid');
                } else {
                    this.classList.remove('is-invalid');
                }
            });
        });
    }

    // --- Main Submission Logic ---
    if (enrollmentForm) {
        enrollmentForm.addEventListener('submit', handleEnrollmentSubmission, true); 
    }
    
    async function handleEnrollmentSubmission(e) {
        e.preventDefault(); 
        
        // 1. Manual Validation Check: Required Fields
        let hasError = false;
        const requiredInputs = enrollmentForm.querySelectorAll('[required]');
        requiredInputs.forEach(input => {
            if (!input.value) {
                input.classList.add('is-invalid');
                hasError = true;
            }
        });

        // 2. Manual Validation Check: Phone Number Length
        const phoneInput = enrollmentForm.querySelector('[name="phone_num"]');
        if (phoneInput && phoneInput.value.length < 13) {
            phoneInput.classList.add('is-invalid');
            showNotification('⚠️ Phone number is incomplete. It must be 13 characters (e.g., +639...)', 'error');
            hasError = true;
        }

        if (hasError || enrollmentForm.querySelectorAll('.is-invalid').length > 0) {
            showNotification('⚠️ Please fix the highlighted errors before submitting.', 'error');
            return;
        }
        
        const submitBtn = submitEnrollmentBtn || enrollmentForm.querySelector('button[type="submit"]');
        const originalButtonHtml = 'Submit Enrollment Application'; 

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Submitting...';
        }
        showNotification('Submitting your application...', 'info', true); 

        try {
            const formData = new FormData(enrollmentForm);

            const response = await fetch('https://enrollment-system-production-6820.up.railway.app/submit-application', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (!data.success) {
                showNotification(data.message || 'Submission failed.', 'error');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalButtonHtml;
                }
            } else {
                // --- SUCCESS ---
                showNotification('✅ Application submitted! Please wait for Admin approval.', 'success', true);
                
                enrollmentForm.style.display = 'none';
                
                const successDiv = document.createElement('div');
                successDiv.className = 'text-center p-5';
                successDiv.innerHTML = `
                    <h2 class="text-success fw-bold">Application Sent!</h2>
                    <p class="lead">Your application ID is <strong>#${data.message.split('ID: ')[1] || '...'}</strong></p>
                    <p>We have received your documents. Please stay on this page or check your email for updates.</p>
                    <div class="spinner-border text-success mt-3" role="status">
                        <span class="visually-hidden">Waiting...</span>
                    </div>
                    <p class="text-muted mt-2 small">Waiting for admin approval...</p>
                    <a href="index.html" class="btn btn-outline-secondary mt-4">Return to Home</a>
                `;
                enrollmentForm.parentElement.appendChild(successDiv);

                // --- SOCKET CONNECTION ---
                const appIdMatch = data.message.match(/ID: (\d+)/);
                const appId = appIdMatch ? appIdMatch[1] : null;

                if (appId) {
                    const socket = io('https://enrollment-system-production-6820.up.railway.app');
                    socket.emit('registerUser', appId);

                    console.log("Listening for updates on App ID:", appId);

                    socket.on('statusUpdated', (notification) => {
                        console.log("Real-time update received:", notification);

                        if (notification.newStatus === 'Approved') {
                            // APPROVED LOGIC
                            showNotification('🎉 APPROVED! Please check your email.', 'success', true);
                            successDiv.innerHTML = `
                                <div class="animate__animated animate__bounceIn">
                                    <h2 class="text-success fw-bold"><i class="fa-solid fa-check-circle"></i> Application Approved!</h2>
                                    <p class="lead">Congratulations! You have been officially enrolled.</p>
                                    <div class="alert alert-success">
                                        <strong>Action Required:</strong> Your student portal credentials have been sent to your email.
                                    </div>
                                    <a href="index.html" class="btn btn-primary btn-lg mt-3 shadow">Go to Login</a>
                                </div>
                            `;
                        } else if (notification.newStatus === 'Rejected') {
                            // REJECTED LOGIC
                            showNotification('⚠️ Application Rejected. Check your email.', 'error', true);
                            successDiv.innerHTML = `
                                <div class="animate__animated animate__shakeX">
                                    <h2 class="text-danger fw-bold"><i class="fa-solid fa-circle-exclamation"></i> Application Rejected</h2>
                                    <p class="lead">We could not process your enrollment at this time.</p>
                                    
                                    <div class="alert alert-danger text-start d-inline-block">
                                        <strong>Next Steps:</strong><br>
                                        1. Check your email inbox (and spam folder) immediately.<br>
                                        2. Read the rejection reason provided by the Admin.<br>
                                        3. You may need to re-submit with correct documents.
                                    </div>
                                    <br>
                                    <a href="enrollment.html" class="btn btn-outline-danger mt-4">Try Again</a>
                                    <a href="index.html" class="btn btn-outline-secondary mt-4 ms-2">Return Home</a>
                                </div>
                            `;
                        }
                    });
                }
            }

        } catch (err) {
            console.error("Network Error:", err);
            showNotification('CRITICAL ERROR: Cannot connect to server.', 'error');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalButtonHtml;
            }
        }
    }
    
    // Clear invalid classes on interaction
    const allInputs = enrollmentForm.querySelectorAll('input, select, textarea');
    allInputs.forEach(input => {
        input.addEventListener('input', () => input.classList.remove('is-invalid'));
    });
});
