// --- Imports ---
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mysql = require('mysql2');

// --- Server Setup ---
const app = express();
app.use(cors());
app.use(express.json()); 
const PORT = 3000;

// --- MySQL Database Connection ---
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '#PROFELECGROUP1', // Your password
  database: 'enrollment_system'
});

// Try to connect to the database
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL database:', err);
    return;
  }
  console.log('Successfully connected to MySQL database!');
});


// --- Create 'uploads' folder if it doesn't exist ---
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

// --- Multer Storage Configuration ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); 
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage }).fields([
    { name: 'card', maxCount: 1 },
    { name: 'psa', maxCount: 1 },
    { name: 'f137', maxCount: 1 },
    { name: 'barangay', maxCount: 1 }
]);

// --- Endpoints ---
app.get('/', (req, res) => {
  res.send('Hello! Your server is running and connected to the database!');
});

// --- SUBMIT APPLICATION ENDPOINT ---
app.post('/submit-application', (req, res) => {
    
    upload(req, res, function (err) {
        if (err) {
            console.error('Multer error:', err);
            return res.json({ success: false, message: 'File upload error' });
        }

        const { firstName, middleName, lastName, bday, email, phone } = req.body;
        const cardPath = req.files.card ? req.files.card[0].path : null;
        const psaPath = req.files.psa ? req.files.psa[0].path : null;
        const f137Path = req.files.f137 ? req.files.f137[0].path : null;
        const barangayPath = req.files.barangay ? req.files.barangay[0].path : null;

        const sql = `
          INSERT INTO applications 
            (first_name, middle_name, last_name, birthdate, email, phone, 
             card_filepath, psa_filepath, f137_filepath, barangay_filepath) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
          firstName, middleName, lastName, bday, email, phone,
          cardPath, psaPath, f137Path, barangayPath
        ];

        db.query(sql, values, (err, result) => {
          if (err) {
            console.error('Database query error:', err);
            return res.json({ success: false, message: 'Database error. Could not save application.' });
          }
          
          console.log('--- Application Saved to Database! ---');
          res.json({ success: true, message: 'Application Submitted Successfully! Your application is under review.' });
        });
    });
});

// --- STUDENT LOGIN ENDPOINT ---
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    console.log(`Login attempt with username: ${username}`);
    const userSql = "SELECT * FROM users WHERE username = ? AND password = ?";
    
    db.query(userSql, [username, password], (err, users) => {
        if (err) {
            console.error('Database query error:', err);
            return res.json({ success: false, message: 'Server error' });
        }
        if (users.length > 0) {
            const user = users[0];
            const appId = user.application_id;
            console.log(`User found! Application ID: ${appId}`);

            const appSql = "SELECT * FROM applications WHERE id = ?";
            db.query(appSql, [appId], (err, applications) => {
                if (err) {
                    return res.json({ success: false, message: 'Server error' });
                }
                if (applications.length > 0) {
                    const application = applications[0];
                    res.json({
                        success: true,
                        message: 'Login successful!',
                        application: application 
                    });
                } else {
                    res.json({ success: false, message: 'Application not found' });
                }
            });
        } else {
            console.log('Login failed: Invalid credentials');
            res.json({ success: false, message: 'Invalid username or password' });
        }
    });
});

// --- STUDENT ANNOUNCEMENTS ENDPOINT ---
app.get('/get-announcements', (req, res) => {
  console.log('Request received for /get-announcements');
  const sql = "SELECT * FROM announcements ORDER BY created_at DESC";
  db.query(sql, (err, announcements) => {
    if (err) {
      console.error('Database query error:', err);
      return res.json({ success: false, message: 'Server error' });
    }
    res.json({ success: true, announcements: announcements });
  });
});

// --- ------------------------------- ---
// --- NEW ADMIN ENDPOINTS START HERE ---
// --- ------------------------------- ---

// --- ADMIN ENDPOINT: GET ALL APPLICATIONS ---
app.get('/get-applications', (req, res) => {
  console.log('Request received for /get-applications');
  // Get all applications, with the newest ones first
  const sql = "SELECT * FROM applications ORDER BY created_at DESC";
  
  db.query(sql, (err, applications) => {
    if (err) {
      console.error('Database query error:', err);
      return res.json({ success: false, message: 'Server error' });
    }
    // Send back all the applications
    res.json({ success: true, applications: applications });
  });
});


// --- ADMIN ENDPOINT: APPROVE/REJECT APPLICATION ---
app.post('/update-application-status', (req, res) => {
  const { applicationId, newStatus } = req.body;

  console.log(`Updating application ${applicationId} to status: ${newStatus}`);

  // 1. Update the application's status in the 'applications' table
  const updateSql = "UPDATE applications SET status = ? WHERE id = ?";
  
  db.query(updateSql, [newStatus, applicationId], (err, result) => {
    if (err) {
      console.error('Database query error:', err);
      return res.json({ success: false, message: 'Database error' });
    }
    
    // 2. Check if the new status is "Approved"
    if (newStatus === 'Approved') {
      // --- This is the key step from your flowchart ---
      // 3. Get the applicant's info to create a user account
      const getAppSql = "SELECT * FROM applications WHERE id = ?";
      db.query(getAppSql, [applicationId], (err, applications) => {
        if (err || applications.length === 0) {
          return res.json({ success: false, message: 'Could not find application to create user' });
        }
        
        const app = applications[0];
        
        // 4. Create the username and a temporary password
        const username = `${app.first_name.toLowerCase()}.${app.last_name.toLowerCase()}`;
        const tempPassword = 'password123'; // In a real app, this would be random
        
        console.log(`Creating user: ${username}, Pass: ${tempPassword}`);

        // 5. Insert the new user into the 'users' table
        const insertUserSql = "INSERT INTO users (username, password, application_id) VALUES (?, ?, ?)";
        db.query(insertUserSql, [username, tempPassword, applicationId], (err, result) => {
          if (err) {
            // This might fail if the username (e.g., john.doe) already exists
            console.error('Error creating user:', err);
            return res.json({ success: false, message: 'Error creating user account.' });
          }
          console.log(`User ${username} created successfully.`);
          res.json({ success: true, message: `Application ${applicationId} Approved and user ${username} created!` });
        });
      });
      
    } else {
      // If "Rejected", we're done. Just send a success response.
      res.json({ success: true, message: `Application ${applicationId} Rejected.` });
    }
  });
});


// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});