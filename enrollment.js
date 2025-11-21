// File: enrollment.js (Script for Enrollment page.html - WITH REAL-TIME NOTIFICATIONS)

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

    // --- Helper Functions (Validation) ---
    addFileLimitNotices();
    addAgeValidation();
    addNameValidation();
    addRequiredFieldValidation();
    
    // CALL THE PHONE VALIDATION FUNCTION
    addPhoneValidation(); 

    function showNotification(message, type, persistent = false) {
        notificationBarEl.classList.remove('show'); 
        notificationBarEl.className = 'notification-bar';
        notificationBarEl.textContent = message;
        
        if (type === 'success') notificationBarEl.classList.add('success');
        else if (type === 'error') notificationBarEl.classList.add('error');
        else if (type === 'info') notificationBarEl.classList.add('info');
        
        notificationBarEl.classList.add('show');
        
        // FIX: Allow 'info' messages to auto-hide unless explicitly persistent
        if (!persistent) {
             setTimeout(() => { notificationBarEl.classList.remove('show'); }, 4000); 
        }
    }
    
    function hideNotification() {
        notificationBarEl.classList.remove('show');
    }

    // --- STRICT PHONE NUMBER VALIDATION (+63 + 10 digits) ---
    function addPhoneValidation() {
        const phoneInput = enrollmentForm.querySelector('[name="phone_num"]');
        if (phoneInput) {
            
            // 0. Remove HTML attribute limits so JS can handle the logic perfectly
            phoneInput.removeAttribute('maxlength'); 

            // 1. Set Default Value on Load
            if (!phoneInput.value) {
                phoneInput.value = "+63";
            }

            // 2. Prevent deleting the "+63" prefix
            phoneInput.addEventListener('keydown', function(e) {
                const cursorPosition = this.selectionStart;
                // If trying to backspace the prefix (first 3 chars), stop it
                if ((e.key === 'Backspace' || e.key === 'Delete') && cursorPosition <= 3 && this.value.length <= 3) {
                    e.preventDefault();
                }
                // Prevent moving cursor before the prefix
                if (cursorPosition < 3 && e.key !== 'ArrowRight') {
                   this.setSelectionRange(3, 3);
                }
            });

            // 3. Input Logic: Numbers Only, No Leading 0, Max 13 Chars
            phoneInput.addEventListener('input', function(e) {
                let val = this.value;
                
                // Ensure it always starts with +63
                if (!val.startsWith("+63")) {
                    val = "+63" + val.replace(/^\+63|^63|^\+/, ""); 
                }

                // Separate prefix and the rest
                const prefix = "+63";
                let rest = val.substring(3);
                
                // Remove letters/symbols from the rest (Keep only numbers)
                rest = rest.replace(/[^0-9]/g, '');

                // AUTO-CORRECT: If user types '0' at the start (e.g., +6309...), remove the 0
                if (rest.startsWith('0')) {
                    rest = rest.substring(1);
                }
                
                // Strict Length Limit: 10 digits (Total 13 characters)
                if (rest.length > 10) {
                    rest = rest.substring(0, 10);
                    // Show warning but make it temporary
                    showNotification('⚠️ Maximum length reached (13 characters).', 'info', false);
                }

                this.value = prefix + rest;
            });

            // 4. Reset on Focus (if empty or messed up)
            phoneInput.addEventListener('focus', function() {
                if (this.value === '' || this.value === '+') {
                    this.value = "+63";
                }
            });
        }
    }

    function addFileLimitNotices() {
        const fileInputs = enrollmentForm.querySelectorAll('input[type="file"]');
        fileInputs.forEach(input => {
            const notice = document.createElement('small');
            notice.className = 'text-muted d-block mt-1';
            notice.style.fontSize = '0.85rem';
            notice.textContent = '📎 Max file size: 5MB | Accepted formats: PDF, JPG, PNG';
            if (input.parentElement) input.parentElement.appendChild(notice);
            
            input.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file && file.size > 5 * 1024 * 1024) {
                    showNotification(`File "${file.name}" exceeds 5MB limit.`, 'error');
                    input.value = ''; 
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
        
        // Basic check for invalid fields
        if (enrollmentForm.querySelectorAll('.is-invalid').length > 0) {
            showNotification('⚠️ Please fix the highlighted errors before submitting.', 'error');
            return;
        }
        
        const submitBtn = submitEnrollmentBtn || enrollmentForm.querySelector('button[type="submit"]');
        const originalButtonHtml = 'Submit Enrollment Application'; 

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Submitting...';
        }
        // FIX: Make "Submitting" message persistent so it doesn't disappear during upload
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
                
                // Hide the form to prevent resubmission
                enrollmentForm.style.display = 'none';
                
                // Show a waiting message
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

                // --- REAL-TIME SOCKET CONNECTION ---
                const appIdMatch = data.message.match(/ID: (\d+)/);
                const appId = appIdMatch ? appIdMatch[1] : null;

                if (appId) {
                    const socket = io('https://enrollment-system-production-6820.up.railway.app');
                    
                    console.log(`Listening for updates on Application #${appId}`);
                    socket.emit('registerUser', appId);

                    socket.on('statusUpdated', (notification) => {
                        if (notification.newStatus === 'Approved') {
                            showNotification('APPROVED! Please check your email (inbox/spam) for login credentials.', 'success', true);
                            successDiv.innerHTML = `
                                <h2 class="text-success fw-bold">🎉 Application Approved!</h2>
                                <p class="lead">Congratulations! You have been accepted.</p>
                                <div class="alert alert-success">
                                    <strong>Action Required:</strong> Login credentials have been sent to your email.
                                </div>
                                <a href="index.html" class="btn btn-primary btn-lg mt-3">Go to Login</a>
                            `;
                        } else if (notification.newStatus === 'Rejected') {
                            showNotification('⚠️ Application Update: ' + notification.newStatus, 'error', true);
                            successDiv.innerHTML = `
                                <h2 class="text-danger fw-bold">Application Status Update</h2>
                                <p>Your application status has been changed to: <strong>${notification.newStatus}</strong>.</p>
                                <p>Please check your email or contact the school for details.</p>
                                <a href="index.html" class="btn btn-outline-secondary mt-3">Return Home</a>
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
