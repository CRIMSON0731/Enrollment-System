// File: enrollment.js (Script for Enrollment page.html - FINAL GUARANTEED STAY)

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

    // --- Notification Function (TEMPORARY: ONLY FOR ERROR/LOADING ON THIS PAGE) ---
    function showNotification(message, type) {
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
        } 
        
        // Step 5: Show the bar
        notificationBarEl.classList.add('show');
        
        // ADDED: Timer to hide notifications on the enrollment page (only errors/loading)
        if (type !== 'info') {
             setTimeout(() => {
                notificationBarEl.classList.remove('show');
            }, 5000); 
        }
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
});
