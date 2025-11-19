// File: enrollment.js (Script for Enrollment page.html - WITH FIELD VALIDATION)

document.addEventListener('DOMContentLoaded', () => {
    console.log("Enrollment script loaded."); 
    
    const enrollmentForm = document.getElementById('enrollment-form'); 
    
    // --- Custom Notification Bar Elements ---
    const notificationBarEl = document.getElementById('notification-bar');
    const submitEnrollmentBtn = document.getElementById('submit-enrollment-btn'); 
    
    if (!notificationBarEl) {
        console.error("Custom notification bar with ID 'notification-bar' not found. Cannot display notifications.");
        return; 
    }

    // --- Add File Limit Notices ---
    addFileLimitNotices();
    
    // --- Add Real-time Age Validation ---
    addAgeValidation();
    
    // --- Add Real-time Name Validation ---
    addNameValidation();
    
    // --- Add Real-time Required Field Validation ---
    addRequiredFieldValidation();

    // --- Notification Function ---
    function showNotification(message, type, persistent = false) {
        // Step 1: Hide previous message immediately
        notificationBarEl.classList.remove('show'); 
        
        // Step 2: Ensure styles are reset before applying new ones
        notificationBarEl.className = 'notification-bar';
        
        // Step 3: Set the message content
        notificationBarEl.textContent = message;
        
        // Step 4: Set the style 
        if (type === 'success') {
            notificationBarEl.classList.add('success');
        } else if (type === 'error') {
            notificationBarEl.classList.add('error');
        } else if (type === 'info') {
            notificationBarEl.classList.add('info');
        }
        
        // Step 5: Show the bar
        notificationBarEl.classList.add('show');
        
        // Timer to hide notifications - but not if persistent is true
        if (!persistent && type !== 'info') {
             setTimeout(() => {
                notificationBarEl.classList.remove('show');
            }, 5000); 
        }
    }
    
    // --- Function to Hide Notification ---
    function hideNotification() {
        notificationBarEl.classList.remove('show');
    }

    // --- Function to Add File Limit Notices ---
    function addFileLimitNotices() {
        const fileInputs = enrollmentForm.querySelectorAll('input[type="file"]');
        
        fileInputs.forEach(input => {
            // Create notice element
            const notice = document.createElement('small');
            notice.className = 'text-muted d-block mt-1';
            notice.style.fontSize = '0.85rem';
            notice.textContent = '📎 Max file size: 5MB | Accepted formats: PDF, JPG, PNG';
            
            // Insert after the file input
            if (input.parentElement) {
                input.parentElement.appendChild(notice);
            }
            
            // Add file size validation
            input.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file) {
                    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
                    if (file.size > maxSize) {
                        showNotification(`File "${file.name}" exceeds 5MB limit. Please choose a smaller file.`, 'error');
                        input.value = ''; // Clear the input
                    }
                }
            });
        });
    }
    
    // --- Function to Add Real-time Age Validation ---
    function addAgeValidation() {
        const birthdate = enrollmentForm.querySelector('[name="birthdate"]');
        
        if (birthdate) {
            birthdate.addEventListener('change', function() {
                if (this.value) {
                    const birthDate = new Date(this.value);
                    const today = new Date();
                    let age = today.getFullYear() - birthDate.getFullYear();
                    const monthDiff = today.getMonth() - birthDate.getMonth();
                    
                    // Adjust age if birthday hasn't occurred yet this year
                    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                        age--;
                    }
                    
                    if (age < 11) {
                        showNotification('⚠️ Age is not valid. Applicants must be at least 11 years old to enroll. Current age: ' + age + ' years old.', 'error', true);
                        this.classList.add('is-invalid');
                    } else {
                        this.classList.remove('is-invalid');
                        hideNotification();
                    }
                }
            });
        }
    }
    
    // --- Function to Add Real-time Name Validation ---
    function addNameValidation() {
        const firstName = enrollmentForm.querySelector('[name="first_name"]');
        const middleName = enrollmentForm.querySelector('[name="middle_name"]');
        const lastName = enrollmentForm.querySelector('[name="last_name"]');
        
        const nameFields = [firstName, middleName, lastName];
        
        nameFields.forEach(field => {
            if (field) {
                // Prevent typing symbols in real-time
                field.addEventListener('input', function(e) {
                    const value = this.value;
                    // Allow only letters, spaces, hyphens, apostrophes, and periods (for names like O'Brien, Mary-Jane, Jr.)
                    const namePattern = /^[a-zA-Z\s\-'\.]*$/;
                    
                    if (!namePattern.test(value)) {
                        // Remove invalid characters
                        this.value = value.replace(/[^a-zA-Z\s\-'\.]/g, '');
                        showNotification('⚠️ Name fields can only contain letters, spaces, hyphens, apostrophes, and periods.', 'error', true);
                        this.classList.add('is-invalid');
                    } else if (value.length > 0) {
                        this.classList.remove('is-invalid');
                        hideNotification();
                    }
                });
                
                // Additional validation on blur (when field loses focus)
                field.addEventListener('blur', function() {
                    const value = this.value.trim();
                    
                    // Check for numbers or special symbols
                    if (value && !/^[a-zA-Z\s\-'\.]+$/.test(value)) {
                        showNotification('⚠️ Invalid characters in name field. Please use only letters.', 'error', true);
                        this.classList.add('is-invalid');
                    }
                });
            }
        });
    }
    
    // --- Function to Add Real-time Required Field Validation ---
    function addRequiredFieldValidation() {
        const requiredFields = [
            { selector: '[name="first_name"]', label: 'First Name' },
            { selector: '[name="last_name"]', label: 'Last Name' },
            { selector: '[name="birthdate"]', label: 'Birthdate' },
            { selector: '[name="grade_level"]', label: 'Target Grade Level' },
            { selector: '[name="phone_number"]', label: 'Phone Number' },
            { selector: '[name="email"]', label: 'Email' },
            { selector: '[name="guardian_name"]', label: 'Guardian Name' },
            { selector: '[name="guardian_relation"]', label: 'Guardian Relationship' },
            { selector: '[name="guardian_phone"]', label: 'Guardian Phone' },
            { selector: '[name="address"]', label: 'Street Address' },
            { selector: '[name="city"]', label: 'City' },
            { selector: '[name="province"]', label: 'Province' },
            { selector: '[name="zip_code"]', label: 'Zip Code' }
        ];
        
        requiredFields.forEach(fieldInfo => {
            const field = enrollmentForm.querySelector(fieldInfo.selector);
            
            if (field) {
                // Validate on blur (when field loses focus)
                field.addEventListener('blur', function() {
                    const value = this.value.trim();
                    
                    if (value === '' || (this.tagName === 'SELECT' && value === '')) {
                        showNotification(`⚠️ ${fieldInfo.label} is required. Please fill out this field.`, 'error', true);
                        this.classList.add('is-invalid');
                    } else {
                        this.classList.remove('is-invalid');
                        // Only hide notification if no other fields are invalid
                        if (enrollmentForm.querySelectorAll('.is-invalid').length === 0) {
                            hideNotification();
                        }
                    }
                });
                
                // Remove invalid class when user starts typing
                field.addEventListener('input', function() {
                    if (this.value.trim() !== '') {
                        this.classList.remove('is-invalid');
                        // Only hide notification if no other fields are invalid
                        if (enrollmentForm.querySelectorAll('.is-invalid').length === 0) {
                            hideNotification();
                        }
                    }
                });
            }
        });
        
        // File inputs validation
        const fileFields = [
            { selector: '[name="birth_certificate"]', label: 'Birth Certificate (PSA)' },
            { selector: '[name="report_card"]', label: 'Report Card (Form 138)' },
            { selector: '[name="good_moral"]', label: 'Certificate of Good Moral' }
        ];
        
        fileFields.forEach(fieldInfo => {
            const field = enrollmentForm.querySelector(fieldInfo.selector);
            
            if (field) {
                field.addEventListener('change', function() {
                    if (!this.files || this.files.length === 0) {
                        showNotification(`⚠️ ${fieldInfo.label} is required. Please upload a file.`, 'error', true);
                        this.classList.add('is-invalid');
                    } else {
                        this.classList.remove('is-invalid');
                        // Only hide notification if no other fields are invalid
                        if (enrollmentForm.querySelectorAll('.is-invalid').length === 0) {
                            hideNotification();
                        }
                    }
                });
            }
        });
    }

    // --- Field Validation Function ---
    function validateForm() {
        const requiredFields = [];
        const emptyFields = [];
        
        // Personal Information
        const firstName = enrollmentForm.querySelector('[name="first_name"]');
        const lastName = enrollmentForm.querySelector('[name="last_name"]');
        const birthdate = enrollmentForm.querySelector('[name="birthdate"]');
        
        if (firstName) requiredFields.push({ element: firstName, label: 'First Name' });
        if (lastName) requiredFields.push({ element: lastName, label: 'Last Name' });
        if (birthdate) requiredFields.push({ element: birthdate, label: 'Birthdate' });
        
        // Age validation - Check if applicant is at least 11 years old
        if (birthdate && birthdate.value) {
            const birthDate = new Date(birthdate.value);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            
            // Adjust age if birthday hasn't occurred yet this year
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            
            if (age < 11) {
                showNotification('⚠️ Age is not valid. Applicants must be at least 11 years old to enroll. Current age: ' + age + ' years old.', 'error');
                birthdate.classList.add('is-invalid');
                birthdate.scrollIntoView({ behavior: 'smooth', block: 'center' });
                birthdate.focus();
                return ['Age requirement not met'];
            }
        }
        
        // Target Grade & Contact
        const gradeLevel = enrollmentForm.querySelector('[name="grade_level"]');
        const phoneNumber = enrollmentForm.querySelector('[name="phone_number"]');
        const email = enrollmentForm.querySelector('[name="email"]');
        
        if (gradeLevel) requiredFields.push({ element: gradeLevel, label: 'Target Grade Level' });
        if (phoneNumber) requiredFields.push({ element: phoneNumber, label: 'Phone Number' });
        if (email) requiredFields.push({ element: email, label: 'Email' });
        
        // Guardian Information
        const guardianName = enrollmentForm.querySelector('[name="guardian_name"]');
        const guardianRelation = enrollmentForm.querySelector('[name="guardian_relation"]');
        const guardianPhone = enrollmentForm.querySelector('[name="guardian_phone"]');
        
        if (guardianName) requiredFields.push({ element: guardianName, label: 'Guardian Name' });
        if (guardianRelation) requiredFields.push({ element: guardianRelation, label: 'Guardian Relationship' });
        if (guardianPhone) requiredFields.push({ element: guardianPhone, label: 'Guardian Phone' });
        
        // Address
        const address = enrollmentForm.querySelector('[name="address"]');
        const city = enrollmentForm.querySelector('[name="city"]');
        const province = enrollmentForm.querySelector('[name="province"]');
        const zipCode = enrollmentForm.querySelector('[name="zip_code"]');
        
        if (address) requiredFields.push({ element: address, label: 'Street Address' });
        if (city) requiredFields.push({ element: city, label: 'City' });
        if (province) requiredFields.push({ element: province, label: 'Province' });
        if (zipCode) requiredFields.push({ element: zipCode, label: 'Zip Code' });
        
        // Required Documents (File inputs)
        const birthCertificate = enrollmentForm.querySelector('[name="birth_certificate"]');
        const reportCard = enrollmentForm.querySelector('[name="report_card"]');
        const goodMoral = enrollmentForm.querySelector('[name="good_moral"]');
        
        if (birthCertificate) requiredFields.push({ element: birthCertificate, label: 'Birth Certificate (PSA)' });
        if (reportCard) requiredFields.push({ element: reportCard, label: 'Report Card (Form 138)' });
        if (goodMoral) requiredFields.push({ element: goodMoral, label: 'Certificate of Good Moral' });
        
        // Check which fields are empty
        requiredFields.forEach(field => {
            const value = field.element.value.trim();
            const isFileInput = field.element.type === 'file';
            
            if (isFileInput) {
                if (!field.element.files || field.element.files.length === 0) {
                    emptyFields.push(field.label);
                    field.element.classList.add('is-invalid');
                } else {
                    field.element.classList.remove('is-invalid');
                }
            } else {
                if (value === '' || (field.element.tagName === 'SELECT' && value === '')) {
                    emptyFields.push(field.label);
                    field.element.classList.add('is-invalid');
                } else {
                    field.element.classList.remove('is-invalid');
                }
            }
        });
        
        // Email validation
        if (email && email.value.trim() !== '') {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(email.value.trim())) {
                emptyFields.push('Valid Email Address');
                email.classList.add('is-invalid');
            }
        }
        
        // Phone number validation (basic)
        [phoneNumber, guardianPhone].forEach(phone => {
            if (phone && phone.value.trim() !== '') {
                const phonePattern = /^[0-9\s\-\+\(\)]{10,}$/;
                if (!phonePattern.test(phone.value.trim())) {
                    if (!emptyFields.includes(phone.name === 'phone_number' ? 'Valid Phone Number' : 'Valid Guardian Phone')) {
                        emptyFields.push(phone.name === 'phone_number' ? 'Valid Phone Number' : 'Valid Guardian Phone');
                    }
                    phone.classList.add('is-invalid');
                }
            }
        });
        
        return emptyFields;
    }

    if (enrollmentForm) {
        // Use capture mode to run handler first
        enrollmentForm.addEventListener('submit', handleEnrollmentSubmission, true); 
    } else {
        console.error("Enrollment form with ID 'enrollment-form' not found.");
    }
    
    async function handleEnrollmentSubmission(e) {
        // CRITICAL: Must be the first line to stop the page refresh
        e.preventDefault(); 
        
        // Validate form before submission
        const emptyFields = validateForm();
        
        if (emptyFields.length > 0) {
            const fieldList = emptyFields.join(', ');
            showNotification(`⚠️ Please fill out the following required fields: ${fieldList}`, 'error');
            
            // Scroll to the first invalid field
            const firstInvalid = enrollmentForm.querySelector('.is-invalid');
            if (firstInvalid) {
                firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstInvalid.focus();
            }
            return;
        }
        
        const submitBtn = submitEnrollmentBtn || enrollmentForm.querySelector('button[type="submit"]');
        const originalButtonHtml = 'Submit Enrollment Application'; 

        // Disable button and show loading status immediately 
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Submitting...';
        }
        // Show the 'info' notification
        showNotification('Submitting your application...', 'info'); 

        try {
            const formData = new FormData(enrollmentForm);

            // API Call: Application submission
            const response = await fetch('https://enrollment-system-production-6820.up.railway.app/submit-application', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (!response.ok || !data.success) {
                const errorMessage = data.message || 'Application failed to submit due to a server error. Please check file formats/sizes.';
                // Show final error notification (will hide after 5s)
                showNotification(errorMessage, 'error');
            } else {
                
                // --- CUSTOMIZED SUCCESS MESSAGE ---
                const customMessage = `✅ Application submitted successfully! Please check your **personal email** (including spam/junk) for login credentials once the admin has processed your documents.`;
                
                // --- CRUCIAL CHANGE: Store custom message and redirect ---
                sessionStorage.setItem('submissionSuccess', customMessage);
                
                // **REVERTED REDIRECTION TO SIMPLE RELATIVE PATH**
                window.location.href = 'index.html'; 

            }

        } catch (err) {
            console.error("Enrollment Network Error:", err);
            // Show critical error notification (will hide after 5s)
            showNotification('CRITICAL ERROR: Cannot connect to server. Please ensure the server is running on port 3000.', 'error');
        } finally {
            console.log(`Cleanup initiated. Resetting button.`);

            // Cleanup: Reset button immediately (Only runs if error occurred)
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalButtonHtml; 
            }
        }
    }
    
    // Remove invalid class when user starts typing/selecting
    const allInputs = enrollmentForm.querySelectorAll('input, select, textarea');
    allInputs.forEach(input => {
        input.addEventListener('input', function() {
            this.classList.remove('is-invalid');
        });
        input.addEventListener('change', function() {
            this.classList.remove('is-invalid');
        });
    });
});
