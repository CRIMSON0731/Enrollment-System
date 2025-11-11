// Wait for the HTML document to finish loading
document.addEventListener("DOMContentLoaded", () => {
  // IDs updated to be unique
  const loginForm = document.getElementById('student-login-form');
  const errorMessage = document.getElementById('student-error-message');

  if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();

      errorMessage.textContent = ''; // Clear previous errors

      // IDs updated to be unique
      const username = document.getElementById('student-username').value;
      const password = document.getElementById('student-password').value;

      if (!username || !password) {
        errorMessage.textContent = "Please enter both username and password.";
        return;
      }

      // --- Send the data to the server (to POST /login) ---
      fetch("http://localhost:3000/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username,
          password: password,
        }),
      })
        .then(response => {
            if (!response.ok) {
                // Get error message from server for 401, 400, etc.
                return response.json().then(err => { throw err; });
            }
            return response.json();
        })
        .then(data => {
          if (data.success) {
            // --- LOGIN SUCCESSFUL! ---
            // Store the application data in the browser's storage
            localStorage.setItem("applicationData", JSON.stringify(data.application));
            
            // Redirect the user to their dashboard
            window.location.href = "dashboard.html"; 
          } else {
             // This 'else' might not be reached if errors are thrown, but good as a fallback.
             errorMessage.textContent = data.message || "Login failed. Check your credentials.";
          }
        })
        .catch(error => {
          console.error("Login error:", error);
          // Use the message from the server if available
          errorMessage.textContent = error.message || "A connection error occurred. Is the server running?";
        });
    });
  }
});