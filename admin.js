// Run this code when the page loads
document.addEventListener('DOMContentLoaded', () => {
  loadApplications();
});

// --- Function to fetch all applications from the server ---
async function loadApplications() {
  const tableBody = document.getElementById('applications-tbody');
  
  try {
    const response = await fetch('http://localhost:3000/get-applications');
    const data = await response.json();

    if (!data.success) {
      tableBody.innerHTML = '<tr><td colspan="5">Error loading applications.</td></tr>';
      return;
    }
    
    // Clear the "Loading..." message
    tableBody.innerHTML = '';
    
    // Loop through each application and add it to the table
    data.applications.forEach(app => {
      const row = document.createElement('tr');
      
      // Add a CSS class based on the status
      row.className = `status-${app.status.replace(' ', '')}`;
      
      // Format the date to be more readable
      const formattedDate = new Date(app.created_at).toLocaleDateString();
      
      row.innerHTML = `
        <td>${app.first_name} ${app.last_name}</td>
        <td>${app.email}</td>
        <td>${app.status}</td>
        <td>${formattedDate}</td>
        <td class="actions">
          ${app.status === 'Pending Review' ? 
            `<button class="action-btn approve-btn" data-id="${app.id}">Approve</button>
             <button class="action-btn reject-btn" data-id="${app.id}">Reject</button>` 
            : `Processed` 
          }
        </td>
      `;
      tableBody.appendChild(row);
    });

    // Add event listeners to the new buttons
    addEventListenersToButtons();

  } catch (error) {
    console.error('Error fetching applications:', error);
    tableBody.innerHTML = '<tr><td colspan="5">Error connecting to server.</td></tr>';
  }
}

// --- Function to add click handlers to Approve/Reject buttons ---
function addEventListenersToButtons() {
  // Find all "Approve" buttons
  document.querySelectorAll('.approve-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      updateStatus(id, 'Approved');
    });
  });
  
  // Find all "Reject" buttons
  document.querySelectorAll('.reject-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      updateStatus(id, 'Rejected');
    });
  });
}

// --- Function to send the status update to the server ---
async function updateStatus(applicationId, newStatus) {
  
  // Disable the button to prevent double-clicks
  document.querySelectorAll(`.action-btn[data-id="${applicationId}"]`).forEach(b => b.disabled = true);
  
  try {
    const response = await fetch('http://localhost:3000/update-application-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        applicationId: applicationId,
        newStatus: newStatus
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      alert(`Application ${newStatus}! ${data.message}`);
      // Reload the list to show the change
      loadApplications(); 
    } else {
      alert(`Error: ${data.message}`);
    }

  } catch (error) {
    console.error('Error updating status:', error);
    alert('Error connecting to server.');
  }
}