// --- Function to load announcements ---
async function loadAnnouncements() {
  try {
    const response = await fetch("http://localhost:3000/get-announcements");
    const data = await response.json();
    const listElement = document.getElementById("announcements-list");
    
    if (data.success) {
      if (data.announcements.length === 0) {
        listElement.innerHTML = "<li>No announcements at this time.</li>";
        return;
      }
      listElement.innerHTML = ""; 
      data.announcements.forEach(ann => {
        const li = document.createElement("li");
        li.innerHTML = `
          <strong>${ann.title}</strong>
          <p>${ann.content}</p>
        `;
        listElement.appendChild(li);
      });
    } else {
      listElement.innerHTML = "<li>Error loading announcements.</li>";
    }
  } catch (error) {
    console.error("Error fetching announcements:", error);
    document.getElementById("announcements-list").innerHTML = "<li>Connection error.</li>";
  }
}

// --- Function to handle navigation ---
function setupNavigation() {
  const links = document.querySelectorAll(".sidebar-links a");
  const contentSections = document.querySelectorAll(".content-section");
  
  links.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault(); // Stop the link from jumping
      
      // Get the target content ID from the link ID
      // e.g., "nav-home" -> "content-home"
      const targetId = "content-" + link.id.split("-")[1];
      
      // Handle logout separately
      if (link.id === "nav-logout") {
        localStorage.removeItem("applicationData");
        alert("You have been logged out.");
        window.location.href = "index.html";
        return;
      }

      // --- Handle normal navigation ---
      // 1. Remove 'active' class from all links
      links.forEach(l => l.classList.remove("active"));
      
      // 2. Add 'active' class to clicked link
      link.classList.add("active");
      
      // 3. Hide all content sections
      contentSections.forEach(section => {
        section.style.display = "none";
      });
      
      // 4. Show the target content section
      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        targetSection.style.display = "block";
      }
    });
  });
  
  // Show the home content by default
  document.getElementById("content-home").style.display = "block";
}

// --- Main function runs on page load ---
document.addEventListener("DOMContentLoaded", () => {
  
  // 1. Check if user is logged in
  const appDataString = localStorage.getItem("applicationData");
  if (!appDataString) {
    alert("You are not logged in. Redirecting to login page.");
    window.location.href = "index.html";
    return;
  }
  
  // 2. Parse the data
  const appData = JSON.parse(appDataString);

  // 3. Load announcements
  loadAnnouncements();
  
  // 4. Setup navigation
  setupNavigation();

  // 5. Fill in all the data fields
  document.getElementById("student-name").textContent = appData.first_name;
  
  // Status Page
  const statusMessageEl = document.getElementById("status-message");
  statusMessageEl.textContent = appData.status;
  if (appData.status === "Approved") statusMessageEl.className = "status-approved";
  else if (appData.status === "Rejected") statusMessageEl.className = "status-rejected";
  else statusMessageEl.className = "status-pending";

  // Info Page
  document.getElementById("detail-name").textContent = `${appData.first_name} ${appData.middle_name || ''} ${appData.last_name}`;
  document.getElementById("detail-email").textContent = appData.email;
  document.getElementById("detail-phone").textContent = appData.phone;
  document.getElementById("detail-bday").textContent = appData.birthdate;
});