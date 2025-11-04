// Wait for the HTML document to finish loading
document.addEventListener("DOMContentLoaded", () => {
  // Find the login form (using the 'login-box' class to find its child)
  const loginForm = document.querySelector(".login-box form");

  if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
      // Prevent the form from reloading the page
      event.preventDefault();

      console.log("Login form submitted!");

      // Get the values from the input fields
      // We use querySelector to find them inside the form
      const usernameInput = loginForm.querySelector('input[type="text"]');
      const passwordInput = loginForm.querySelector('input[type="password"]');

      const username = usernameInput.value;
      const password = passwordInput.value;

      // Basic check
      if (!username || !password) {
        alert("Please enter both username and password.");
        return;
      }

      // --- Send the data to the server ---
      fetch("http://localhost:3000/login", {
        method: "POST",
        headers: {
          // Tell the server we're sending JSON data
          "Content-Type": "application/json",
        },
        // Convert the JavaScript object to a JSON string
        body: JSON.stringify({
          username: username,
          password: password,
        }),
      })
        .then(response => response.json())
        .then(data => {
          console.log("Server response:", data);

          if (data.success) {
            // --- LOGIN SUCCESSFUL! ---
            // Store the application data in the browser's storage
            // This lets us use it on the *next* page
            localStorage.setItem("applicationData", JSON.stringify(data.application));
            
            // Redirect the user to their dashboard
            window.location.href = "dashboard.html"; // We will create this file next!
          } else {
            // --- LOGIN FAILED ---
            // Show the error message from the server
            alert(data.message);
          }
        })
        .catch(error => {
          console.error("Login error:", error);
          alert("A connection error occurred. Is the server running?");
        });
    });
  }
});