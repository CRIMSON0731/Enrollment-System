// TEST 1: Check if the file is loaded at all.
console.log("script.js was loaded!");

// Wait for the HTML document to finish loading
document.addEventListener("DOMContentLoaded", () => {
  // TEST 2: Check if the 'DOMContentLoaded' event fired.
  console.log("DOMContentLoaded event fired. Looking for form...");

  // Find the enrollment form by its class name
  const enrollmentForm = document.querySelector(".Enrollment");

  // Check if the form actually exists on this page
  if (enrollmentForm) {
    // TEST 3: Check if the form was found.
    console.log("Enrollment form was found. Adding submit listener...");

    // Add an event listener for when the user clicks "Submit"
    enrollmentForm.addEventListener("submit", (event) => {
      // TEST 4: Check if the submit click is detected.
      console.log("Submit button clicked!");

      // Prevent the form from trying to reload the page (its default action)
      event.preventDefault();

      // --- Get all the text values ---
      const firstName = document.getElementById("First Name").value;
      const lastName = document.getElementById("Last Name").value;
      const bday = document.getElementById("Bday").value;
      const email = document.getElementById("Email").value;
      const phone = document.getElementById("Phone").value;

      // --- Get all the file inputs ---
      const cardFile = document.getElementById("Card").files;
      const psaFile = document.getElementById("PSA").files;
      const f137File = document.getElementById("F137").files;
      const barangayFile = document.getElementById("Barangay Cer").files;

      // --- Validation Check ---
      if (
        !firstName ||
        !lastName ||
        !bday ||
        !email ||
        !phone ||
        cardFile.length === 0 ||
        psaFile.length === 0 ||
        f137File.length === 0 ||
        barangayFile.length === 0
      ) {
        alert("Error: Please fill out all fields and upload all required documents.");
        return; // Stop the function here
      }
      
      // TEST 5: If validation passes, log it.
      console.log("Form is valid. Creating FormData...");

      // 1. Create a FormData object to package our data
      const formData = new FormData();

      // 2. Add all the text fields
      formData.append("firstName", firstName);
      formData.append("lastName", lastName);
      formData.append("bday", bday);
      formData.append("email", email);
      formData.append("phone", phone);

      // 3. Add all the files
      formData.append("card", cardFile[0]);
      formData.append("psa", psaFile[0]);
      formData.append("f137", f137File[0]);
      formData.append("barangay", barangayFile[0]);

      // TEST 6: Log right before sending to server.
      console.log("Sending data to server with fetch()...");

      // 4. Send the data to the server using fetch()
      fetch("http://localhost:3000/submit-application", {
        method: "POST",
        body: formData,
      })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            alert(data.message);
            enrollmentForm.reset();
          } else {
            alert("Error: " + data.message);
          }
        })
        .catch(error => {
          console.error("Error submitting form:", error);
          alert("A connection error occurred. Is the server running?");
        });
    });
  } else {
    // TEST 3 FAILED:
    console.error("Error: Could not find element with class '.Enrollment'");
  }
});
// The extra '}' that was here is now GONE.