// TEST 1: Check if the file is loaded at all.
console.log("script.js was loaded!");

// Wait for the HTML document to finish loading
document.addEventListener("DOMContentLoaded", () => {
  // TEST 2: Check if the 'DOMContentLoaded' event fired.
  console.log("DOMContentLoaded event fired. Looking for form...");

  // -----------------------------------------------------------------
  // ⭐️ NEW: LIVE INPUT VALIDATION
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
  // EXISTING: FORM SUBMISSION LOGIC
  // -----------------------------------------------------------------
  
  const enrollmentForm = document.querySelector(".Enrollment");

  if (enrollmentForm) {
    console.log("Enrollment form was found. Adding submit listener...");

    enrollmentForm.addEventListener("submit", (event) => {
      console.log("Submit button clicked!");

      // Prevent the form from trying to reload the page
      event.preventDefault();

      const submitButton = enrollmentForm.querySelector('input[type="submit"]');

      // --- 1. Prepare for Submission ---
      submitButton.value = 'Submitting... Please Wait';
      submitButton.disabled = true;

      // --- 2. Create FormData (Automatically includes ALL fields by their 'name' attribute) ---
      const formData = new FormData(enrollmentForm);

      if (!formData.get('first_name') || !formData.get('grade_level') || !formData.get('email')) {
        alert("Error: Please fill out all required fields.");
        submitButton.value = 'Submit Enrollment Application';
        submitButton.disabled = false;
        return;
      }
      
      console.log("Form is valid. Sending data to server with fetch()...");

      // --- 3. Send the data to the server ---
      fetch("http://localhost:3000/submit-application", {
        method: "POST",
        body: formData, // FormData handles the Content-Type for file uploads
      })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            // Success: Application is now visible in Admin Panel
            alert('✅ Enrollment submitted successfully! Your application is now pending review.');
            
            // Redirect the user back to the main page
            window.location.href = 'index.html'; 

          } else {
            alert("Error: " + (data.message || "Failed to save application on the server."));
            
            // Re-enable button on failure
            submitButton.value = 'Submit Enrollment Application';
            submitButton.disabled = false;
          }
        })
        .catch(error => {
          console.error("Error submitting form:", error);
          alert("A connection error occurred. Is the server running?");
          
          // Re-enable button on network error
          submitButton.value = 'Submit Enrollment Application';
          submitButton.disabled = false;
        });
    });
  } else {
    console.error("Error: Could not find element with class '.Enrollment'");
  }
});