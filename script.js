// TEST 1: Check if the file is loaded at all.
console.log("script.js was loaded!");

// --- NEW: NOTIFICATION FUNCTION (Copied for consistency) ---
function showNotification(message, type) {
  const notification = document.getElementById('notification-bar');
  if (!notification) {
    console.error("Notification bar element not found. Falling back to console.");
    console.log(message);
    return;
  }
  
  notification.textContent = message;
  notification.className = `notification-bar ${type}`;
  notification.classList.add('show');
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// Wait for the HTML document to finish loading
document.addEventListener("DOMContentLoaded", () => {
  // TEST 2: Check if the 'DOMContentLoaded' event fired.
  console.log("DOMContentLoaded event fired. Looking for form...");

  // -----------------------------------------------------------------
  // ⭐️ LIVE INPUT VALIDATION (Character Cleaning)
  // -----------------------------------------------------------------

  // --- 1. Validation for Name Fields (Allow letters, dot, space, ', -) ---
  const validateNameInput = (event) => {
    // This regex finds any character that is NOT (^) a letter, space, dot, apostrophe, or hyphen
    const invalidChars = /[^a-zA-Z .'-]/g;
    event.target.value = event.target.value.replace(invalidChars, '');
  };

  document.getElementById('first-name').addEventListener('input', validateNameInput);
  document.getElementById('middle-name').addEventListener('input', validateNameInput);
  document.getElementById('last-name').addEventListener('input', validateNameInput);

  // --- 2. Validation for Phone Number (Allow only numbers) ---
  document.getElementById('phone').addEventListener('input', (event) => {
    // This regex finds any character that is NOT (^) a number (0-9)
    const invalidChars = /[^0-9]/g;
    event.target.value = event.target.value.replace(invalidChars, '');
  });

  // -----------------------------------------------------------------
  // ⭐️ FILE UPLOAD FEEDBACK
  // -----------------------------------------------------------------
  const fileInputs = document.querySelectorAll('.input-group input[type="file"]');

  fileInputs.forEach(input => {
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      const label = e.target.previousElementSibling; // Get the original <label> element
      
      const defaultText = label.getAttribute('data-default-text') || 'Document File:';
      
      if (file) {
        // 1. Update Label Text to Filename
        label.textContent = `✅ File Selected: ${file.name}`;
        
        // 2. Add visual confirmation class to the input
        e.target.classList.add('file-selected');
      } else {
        // If the user cancels the selection
        label.textContent = defaultText;
        e.target.classList.remove('file-selected');
      }
    });
    
    // Save the original label text for resetting later, and for the initial state
    const originalLabel = input.previousElementSibling;
    if (originalLabel && originalLabel.tagName === 'LABEL') {
      originalLabel.setAttribute('data-default-text', originalLabel.textContent);
    }
  });


  // -----------------------------------------------------------------
  // 🚀 FORM SUBMISSION LOGIC (ROBUST FETCH IMPLEMENTATION)
  // -----------------------------------------------------------------
  
  const enrollmentForm = document.querySelector(".Enrollment");
  // Find the submit button element using the stable input[type="submit"] selector
  const submitButton = enrollmentForm ? enrollmentForm.querySelector('input[type="submit"]') : null; 

  if (enrollmentForm && submitButton) {
    console.log("Enrollment form found. Adding SUBMIT listener...");

    enrollmentForm.addEventListener("submit", (event) => {
      console.log("Submit button clicked!");

      // 1. CRITICAL: Prevent the form from trying to reload the page
      event.preventDefault();

      // Check if browser validation passed 
      if (!enrollmentForm.reportValidity()) {
          return;
      }

      // --- 2. Prepare for Submission ---
      // Use .value for input[type="submit"]
      submitButton.value = 'Submitting... Please Wait';
      submitButton.disabled = true;

      // --- 3. Create FormData ---
      const formData = new FormData(enrollmentForm);
      
      console.log("Form is valid. Sending data to server with fetch()...");

      // --- 4. Send the data to the server (Resilient Fetch) ---
      fetch("http://localhost:3000/submit-application", {
        method: "POST",
        body: formData, // FormData handles the Content-Type for file uploads
      })
        .then(response => {
            if (!response.ok) {
                // Throw error for 400 or 500 status codes
                throw new Error(`Server returned status: ${response.status}`);
            }
            // Read the response as text first 
            return response.text();
        })
        .then(responseText => {
            let data;
            try {
                // Safely parse the text as JSON
                data = JSON.parse(responseText);
            } catch (e) {
                // If parsing fails, the server sent non-JSON
                console.error("Failed to parse JSON response:", responseText);
                throw new Error("Invalid response format from server. Check server console for errors.");
            }

            if (data.success) {
                // Success path
                const successMsg = `✅ Application Submitted Successfully! We will review your documents soon. Please check your email (and spam folder) for a notification regarding your status.`;
                
                // CRITICAL FIX: Store the message before redirection
                sessionStorage.setItem('submissionSuccess', successMsg);
                
                // Now redirect immediately
                window.location.href = 'index.html'; 

            } else {
                // Server returned success: false
                showNotification("Error: " + (data.message || "Failed to save application on the server."), 'error');
                submitButton.value = 'Submit Enrollment Application';
                submitButton.disabled = false;
            }
        })
        .catch(error => {
          // Catch any errors from network, status, or JSON parsing
          console.error("Error submitting form:", error);
          showNotification(error.message || "A connection error occurred. Is the server running?", 'error');
          
          submitButton.value = 'Submit Enrollment Application';
          submitButton.disabled = false;
        });
    });
    
  } else {
    // This error only appears if the structural elements are missing
    console.error("Error: Could not find form or submit button."); 
  }
});