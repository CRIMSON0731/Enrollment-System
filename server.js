// --- Imports ---
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

// MODIFIED: Use 'pg' for PostgreSQL
const { Pool } = require('pg'); 

const nodemailer = require('nodemailer'); 
const bcrypt = require('bcryptjs'); 

// --- CONFIG ---
const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app); 
const io = new Server(server, { 
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// =========================================================================
//                             MIDDLEWARE (FINAL FIXES)
// =========================================================================

// CRITICAL FIX 1: Add manual CORS headers for security and browser compatibility
app.use((req, res, next) => {
    // Allows your GitHub Pages domain to access the API
    res.setHeader('Access-Control-Allow-Origin', 'https://crimson0731.github.io'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle pre-flight requests
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// CRITICAL FIX 2: Increase payload limits for Express to handle file uploads
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' })); 

app.use(cors()); // Keep the basic cors call

app.use('/uploads', express.static('uploads')); 
app.use(express.static(__dirname)); 

// --- Nodemailer Transport Configuration ---
const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
        user: 'dalonzohighschool@gmail.com', 
        pass: 'ebvhftlefruimqru' 
    }
});

// --- MODIFIED: PostgreSQL Connection (Uses Render's DATABASE_URL) ---
const db = new Pool({
    // Render automatically injects DATABASE_URL for its managed Postgres service.
    connectionString: process.env.DATABASE_URL, 
    ssl: {
        // Required for secure connection to Render's DB
        rejectUnauthorized: false, 
    }
});

db.connect((err) => {
    if (err) {
        // Use err.stack for detailed PG error logging
        console.error('❌ PostgreSQL connection failed:', err.stack);
        process.exit(1);
    }
    console.log('✅ Successfully Connected to PostgreSQL database');
});


// --- Create uploads folder ---
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// --- Multer Setup (Omitted for brevity, assumed correct) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, unique + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg' || file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(null, false); 
        }
    }
}).fields([
    { name: 'card_file', maxCount: 1 },
    { name: 'psa_file', maxCount: 1 },
    { name: 'f137_file', maxCount: 1 },
    { name: 'brgy_cert_file', maxCount: 1 }
]);

// Helper function to delete files safely
const cleanupFiles = (files) => {
    files.forEach(file => {
        if (file) {
            try {
                const filePath = path.join(__dirname, 'uploads', file); 
                fs.unlinkSync(filePath); 
            } catch (e) {
                if (e.code !== 'ENOENT') {
                    console.error('File Cleanup Error (Suppressed):', file, e);
                }
            }
        }
    });
};

// --- Reusable Function to Generate/Insert User Credentials (MODIFIED) ---
const createOrGetCredentials = (app, callback) => {
    // Select the hash to check if the user already exists.
    // MODIFIED: Using $1
    db.query('SELECT username, password FROM users WHERE application_id = $1', [app.id])
        .then(existingUsersResult => {
            const existingUsers = existingUsersResult.rows;

            if (existingUsers.length > 0) {
                // Return the plain-text temporary password for the email function
                return callback(null, { 
                    username: existingUsers[0].username, 
                    password: 'password123'
                });
            }
        
            const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toLowerCase() : '';
            const firstNameInitials = getInitials(app.first_name);
            const middleNameInitals = getInitials(app.middle_name);
            const formattedLastName = (app.last_name || '').toLowerCase().replace(/ /g, '');
            const username = `${firstNameInitials}${middleNameInitals}${formattedLastName}@dtahs.edu.ph`;
            const plainPassword = 'password123'; 

            // CRUCIAL: Hash the password before insertion
            bcrypt.hash(plainPassword, 10, (hashErr, passwordHash) => {
                if (hashErr) return callback(hashErr);

                // MODIFIED: Using $1, $2, $3
                db.query('INSERT INTO users (username, password, application_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                    [username, passwordHash, app.id])
                    .then(() => {
                        // Return the plain-text password for the email only
                        callback(null, { username, password: plainPassword, isNew: true });
                    })
                    .catch(insertErr => {
                        // In PostgreSQL, use a unique index for conflict detection (as above)
                        console.error('DB INSERT Error:', insertErr);
                        return callback(insertErr);
                    });
            });
        })
        .catch(checkErr => {
            console.error('DB Error checking existing user:', checkErr);
            return callback(checkErr);
        });
};


// --- Email Sender Functions (EXISTING) ---
async function sendCredentialsEmail(recipientEmail, studentName, username, password) {
    const mailOptions = {
        from: '"Doña Teodora Alonzo Highschool" <dalonzohighschool@gmail.com>',
        to: recipientEmail,
        subject: 'Enrollment Status & Portal Credentials',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ccc; border-top: 5px solid #2b7a0b;">
                <h2>Hello, ${studentName}!</h2>
                <p>You have been granted <b>Provisional Access</b> to the Student Portal, or your enrollment has been <b>APPROVED</b>.</p>
                <p>Use the credentials below to access the Student Dashboard to view your status, announcements, and manage your account.</p>
                
                <h3 style="color: #2b7a0b;">Your Student Portal Login Details:</h3>
                <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                    <tr>
                        <td style="padding: 10px; border: 1px solid #eee; background-color: #f9f9f9; width: 30%;"><strong>Username (Email):</strong></td>
                        <td style="padding: 10px; border: 1px solid #eee;"><code>${username}</code></td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #eee; background-color: #f9f9f9;"><strong>Temporary Password:</strong></td>
                        <td style="padding: 10px; border: 1px solid #eee;"><code>${password}</code></td>
                    </tr>
                </table>

                <p style="color: #dc3545; font-weight: bold;">IMPORTANT SECURITY INSTRUCTIONS:</p>
                <ol style="margin-left: 20px;">
                    <li>Access your dashboard using the credentials above.</li>
                    <li>You are required to change this temporary password immediately upon your first login.</li>
                    <li>Do not share these credentials with anyone.</li>
                </ol>
                <p>If you have any questions, please contact the school office.</p>
                <p>Sincerely,<br>The Doña Teodora Alonzo Highschool Administration</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Credentials email sent successfully to ${recipientEmail}`);
        return { success: true };
    } catch (error) {
        console.error(`Failed to send credentials email to ${recipientEmail}:`, error);
        return { success: false, error: error.message };
    }
}


// === SOCKET.IO CONNECTION LOGIC (EXISTING) ===
io.on('connection', (socket) => {
  console.log('A user connected with socket ID:', socket.id);

  socket.on('registerUser', (applicationId) => {
    socket.join(`user-${applicationId}`);
    console.log(`User for app ID ${applicationId} joined room: user-${applicationId}`);
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});


// =========================================================================
//                             API ENDPOINTS
// =========================================================================

// --- 1. STUDENT: Application Submission (MODIFIED) ---
app.post('/submit-application', (req, res) => {
    upload(req, res, (err) => {
        const uploadedFiles = req.files || {};
        const fileNames = Object.values(uploadedFiles).flat().map(f => f.filename).filter(n => n); 

        if (err instanceof multer.MulterError) {
            console.error('Multer Error:', err.code, err.message);
            cleanupFiles(fileNames);
            return res.status(400).json({ success: false, message: 'File upload error: ' + err.message });
        } else if (err) {
            console.error('Server Error during upload:', err);
            cleanupFiles(fileNames);
            return res.status(500).json({ success: false, message: 'Server error during upload.' });
        }
        
        const { first_name, last_name, middle_name, birthdate, email, phone_num, grade_level } = req.body;
        
        const card_file = uploadedFiles['card_file']?.[0]?.filename || null;
        const psa_file = uploadedFiles['psa_file']?.[0]?.filename || null;
        const f137_file = uploadedFiles['f137_file']?.[0]?.filename || null;
        const brgy_cert_file = uploadedFiles['brgy_cert_file']?.[0]?.filename || null;
        
        if (!first_name || !email || !card_file || !psa_file || !f137_file || !brgy_cert_file) {
            cleanupFiles(fileNames);
            return res.status(400).json({ success: false, message: 'Missing required fields or documents.' });
        }

        // MODIFIED: Using $1 through $11 and returning ID
        const sql = `INSERT INTO applications 
                     (first_name, last_name, middle_name, birthdate, email, phone, grade_level, status, doc_card_path, doc_psa_path, doc_f137_path, doc_brgy_cert_path) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending Review', $8, $9, $10, $11) RETURNING id`;
        
        db.query(sql, [first_name, last_name, middle_name, birthdate, email, phone_num, grade_level, card_file, psa_file, f137_file, brgy_cert_file])
            .then(result => {
                const insertId = result.rows[0].id; // PostgreSQL returns ID in result.rows[0].id
                res.json({ success: true, message: 'Application submitted successfully with ID: ' + insertId });
            })
            .catch(dbErr => {
                console.error('DB Insert Error:', dbErr);
                cleanupFiles(fileNames); 
                return res.status(500).json({ success: false, message: 'Database error while saving application.' });
            });
    });
});

// --- 2. ADMIN: Get all applications (MODIFIED) ---
app.get('/get-applications', (req, res) => {
    const sql = 'SELECT id, first_name, last_name, email, grade_level, status, created_at FROM applications ORDER BY created_at DESC';
    db.query(sql)
        .then(results => {
            // PostgreSQL results are in results.rows
            res.json({ success: true, applications: results.rows });
        })
        .catch(err => {
            console.error('DB Error:', err);
            return res.status(500).json({ success: false, message: 'Failed to retrieve applications.' });
        });
});

// --- 3. ADMIN: Update Application Status (MODIFIED) ---
app.post('/update-application-status', (req, res) => {
    const { applicationId, newStatus } = req.body;

    const updateStatus = (successMessage, credentials = null) => { 
        // MODIFIED: Using $1, $2
        db.query('UPDATE applications SET status = $1 WHERE id = $2', [newStatus, applicationId])
            .then(() => {
                io.to(`user-${applicationId}`).emit('statusUpdated', { 
                    newStatus: newStatus,
                    message: "Your application status has been updated!"
                });

                // Return credentials only if they were generated/retrieved
                if (credentials) {
                    return res.json({ 
                        success: true, 
                        message: successMessage,
                        student_username: credentials.username,
                        student_password: credentials.password 
                    });
                }
                res.json({ success: true, message: successMessage });
            })
            .catch(err => {
                console.error('DB Error updating status:', err);
                return res.status(500).json({ success: false, message: 'Failed to update application status.' });
            });
    };

    if (newStatus === 'Approved') {
        // MODIFIED: Using $1
        db.query('SELECT * FROM applications WHERE id = $1', [applicationId])
            .then(appsResult => {
                const apps = appsResult.rows;
                if (apps.length === 0) return res.json({ success: false, message: 'Application not found.' });
            
                const app = apps[0];
            
                // 1. Create or Get Credentials
                createOrGetCredentials(app, async (credErr, credentials) => {
                    if (credErr) {
                        return res.status(500).json({ success: false, message: 'Failed to generate/retrieve credentials.' });
                    }

                    // 2. Send Email (uses generated/existing credentials)
                    const emailResult = await sendCredentialsEmail(
                        app.email, 
                        app.first_name, 
                        credentials.username, 
                        credentials.password
                    );
                
                    let successMessage = `Application Approved.`;
                    if (!emailResult.success) {
                        successMessage += ` WARNING: Failed to send credentials email (Check server console).`;
                    }
                
                    // 3. Update status and respond
                    updateStatus(successMessage, credentials);
                });
            })
            .catch(err => {
                return res.status(500).json({ success: false, message: 'Server error while fetching app data.' });
            });
    } else {
        updateStatus(`Application status set to ${newStatus}.`);
    }
});

// --- 4. ADMIN: Get Application Details (MODIFIED) ---
app.get('/get-application-details/:id', (req, res) => {
    const applicationId = req.params.id;
    
    // Select the hash instead of the password
    const sql = `
        SELECT 
            a.*, u.username AS student_username, u.password AS student_password
        FROM applications a 
        LEFT JOIN users u ON a.id = u.application_id
        WHERE a.id = $1`; // MODIFIED: Using $1
    
    db.query(sql, [applicationId])
        .then(results => {
            if (results.rows.length === 0) return res.json({ success: false, message: 'Application not found.' });

            const app = results.rows[0];
                    
            // CRUCIAL: Set student_password to the plain text value 'password123' 
            // if the password_hash exists, for display purposes only.
            if (app.student_username) {
                app.student_password = 'password123';
            }

            res.json({ success: true, application: app });
        })
        .catch(err => {
            // FIX: Log the specific database error to the server console
            console.error('DB ERROR fetching application details:', err); 
            return res.status(500).json({ success: false, message: 'Server error.' });
        });
});

// --- 5. ADMIN: Delete Application (MODIFIED) ---
app.post('/delete-application', (req, res) => {
    const { applicationId } = req.body;

    // MODIFIED: Using $1
    db.query('SELECT * FROM applications WHERE id = $1', [applicationId])
        .then(findResult => {
            const apps = findResult.rows;
            if (apps.length === 0) return res.status(404).json({ success: false, message: 'Application not found.' });

            const app = apps[0];
            
            // MODIFIED: Using $1
            db.query('DELETE FROM users WHERE application_id = $1', [applicationId])
                .then(() => {
                    // MODIFIED: Using $1
                    db.query('DELETE FROM applications WHERE id = $1', [applicationId])
                        .then(() => {
                            const filesToDelete = [app.doc_card_path, app.doc_psa_path, app.doc_f137_path, app.doc_brgy_cert_path];
                            cleanupFiles(filesToDelete);
                            res.json({ success: true, message: 'Application and all data permanently deleted.' });
                        })
                        .catch(appErr => res.status(500).json({ success: false, message: 'Failed to delete application.' }));
                })
                .catch(userErr => {
                    console.error('DB Error deleting user:', userErr);
                    // Continue deletion attempt even if user delete fails
                    db.query('DELETE FROM applications WHERE id = $1', [applicationId]) 
                        .then(() => {
                            const filesToDelete = [app.doc_card_path, app.doc_psa_path, app.doc_f137_path, app.doc_brgy_cert_path];
                            cleanupFiles(filesToDelete);
                            res.json({ success: true, message: 'Application and all data permanently deleted (User record may have failed deletion).' });
                        })
                        .catch(appErr => res.status(500).json({ success: false, message: 'Failed to delete application.' }));
                });
        })
        .catch(findErr => res.status(500).json({ success: false, message: 'Server error finding application to delete.' }));
});

// --- 6. ADMIN: SECURE LOGIN (MODIFIED) ---
app.post('/admin-login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Please provide both credentials.' });
    }

    // MODIFIED: Using $1
    const sql = 'SELECT password_hash FROM admins WHERE username = $1';
    
    db.query(sql, [username])
        .then(results => {
            if (results.rows.length === 0) {
                return res.status(401).json({ success: false, message: 'Invalid credentials.' });
            }

            const hashedPassword = results.rows[0].password_hash;
        
            bcrypt.compare(password, hashedPassword)
                .then(match => {
                    if (match) {
                        res.json({ success: true });
                    } else {
                        res.status(401).json({ success: false, message: 'Invalid credentials.' });
                    }
                })
                .catch(err => {
                    console.error('Bcrypt Error:', err);
                    res.status(500).json({ success: false, message: 'Internal password check error.' });
                });
        })
        .catch(err => {
            console.error('Admin Login DB Error:', err);
            return res.status(500).json({ success: false, message: 'Server database error.' });
        });
});

// --- 7. STUDENT LOGIN (MODIFIED) ---
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Please enter username and password.' });
    }

    // Retrieve the stored hash and application ID from the users table.
    // MODIFIED: Using $1
    const sql = 'SELECT u.application_id, u.password FROM users u WHERE u.username = $1';
    
    db.query(sql, [username])
        .then(usersResult => {
            const users = usersResult.rows;

            if (users.length === 0) {
                return res.status(401).json({ success: false, message: 'Invalid credentials. Please try again.' });
            }

            const user = users[0];
            const storedHash = user.password;
        
            // CRUCIAL: Compare the provided password against the stored hash.
            bcrypt.compare(password, storedHash)
                .then(match => {
                    if (!match) {
                        return res.status(401).json({ success: false, message: 'Invalid credentials. Please try again.' });
                    }
        
                    // Check for first login by comparing the plaintext temporary password against the hash.
                    const temporaryPassword = 'password123';
                    return bcrypt.compare(temporaryPassword, storedHash)
                        .then(isFirstLogin => {
                            // Fetch application data
                            // MODIFIED: Using $1
                            const appSql = 'SELECT * FROM applications WHERE id = $1';
                            return db.query(appSql, [user.application_id])
                                .then(applicationsResult => {
                                    const applications = applicationsResult.rows;
                                    if (applications.length === 0) {
                                        return res.status(500).json({ success: false, message: 'Could not find application data for this user.' });
                                    }
            
                                    const applicationData = applications[0];
                                    applicationData.username = username;
                                    applicationData.password = password; // Temporarily include plain password for client-side state

                                    res.json({ 
                                        success: true, 
                                        application: applicationData,
                                        firstLogin: isFirstLogin 
                                    });
                                });
                        });
                })
                .catch(err => {
                    console.error('Password Comparison Error:', err);
                    res.status(500).json({ success: false, message: 'Internal server error during login.' });
                });
        })
        .catch(err => {
            console.error('Student Login DB Error:', err);
            return res.status(500).json({ success: false, message: 'Server database error.' });
        });
});

// --- 8. GET ANNOUNCEMENTS (MODIFIED) ---
app.get('/get-announcements', (req, res) => {
    const sql = 'SELECT id, title, content FROM announcements ORDER BY created_at DESC'; 
    db.query(sql)
        .then(results => {
            res.json({ success: true, announcements: results.rows });
        })
        .catch(err => {
            return res.status(500).json({ success: false, message: 'Failed to retrieve announcements.' });
        });
});

// --- 9. CHANGE PASSWORD (MODIFIED) ---
app.post('/change-password', (req, res) => {
    const { applicationId, currentPassword, newPassword } = req.body;

    // 1. Fetch the stored hash
    // MODIFIED: Using $1
    const checkSql = 'SELECT password FROM users WHERE application_id = $1';
    db.query(checkSql, [applicationId])
        .then(usersResult => {
            const users = usersResult.rows;

            if (users.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });
            
            const storedHash = users[0].password;

            // 2. Compare the current password against the stored hash
            return bcrypt.compare(currentPassword, storedHash)
                .then(match => {
                    if (!match) {
                        return res.status(401).json({ success: false, message: 'Your current password was incorrect.' });
                    }
        
                    // 3. Hash the new password
                    return bcrypt.hash(newPassword, 10);
                })
                .then(newPasswordHash => {
                    // 4. Update the hash in the database
                    // MODIFIED: Using $1, $2
                    const updateSql = 'UPDATE users SET password = $1 WHERE application_id = $2';
                    return db.query(updateSql, [newPasswordHash, applicationId]);
                })
                .then(() => {
                    res.json({ success: true, message: 'Password updated successfully.' });
                })
                .catch(err => {
                    if (err.message.includes('current password was incorrect')) {
                        return res.status(401).json({ success: false, message: err.message });
                    }
                    console.error('Password Change Process Error:', err);
                    res.status(500).json({ success: false, message: 'Failed to update password.' });
                });
        })
        .catch(checkErr => res.status(500).json({ success: false, message: 'Database error.' }));
});

// --- 15. ADMIN: Send Credentials Only (Provisional Access) ---
app.post('/generate-credentials', (req, res) => {
    const { applicationId } = req.body;

    // MODIFIED: Using $1
    db.query('SELECT * FROM applications WHERE id = $1', [applicationId])
        .then(appsResult => {
            const apps = appsResult.rows;
            if (apps.length === 0) return res.json({ success: false, message: 'Application not found.' });
            
            const app = apps[0];

            if (app.status === 'Approved') {
                return res.json({ success: false, message: 'Application is already approved. Credentials should already exist.' });
            }
        
            // 1. Create or Get Credentials
            createOrGetCredentials(app, async (credErr, credentials) => {
                if (credErr) {
                    console.error('Final attempt to create credentials failed:', credErr);
                    return res.status(500).json({ success: false, message: 'Failed to generate/retrieve credentials.' });
                }

                // 2. Send Email
                const emailResult = await sendCredentialsEmail(
                    app.email, 
                    app.first_name, 
                    credentials.username, 
                    credentials.password
                );
            
                let successMessage = `Provisional credentials generated and sent to ${app.email}. Status remains ${app.status}.`;
                if (!emailResult.success) {
                    successMessage = `Credentials generated but FAILED to send email. Check server logs.`;
                }
            
                res.json({ 
                    success: true, 
                    message: successMessage,
                    student_username: credentials.username,
                    student_password: credentials.password 
                });
            });
        })
        .catch(err => res.status(500).json({ success: false, message: 'Server error while fetching app data.' }));
});


// --- 10 & 11 (Existing Announcement Endpoints) ---
app.post('/create-announcement', (req, res) => {
    const { title, content } = req.body;
    
    if (!title || !content) {
        return res.status(400).json({ success: false, message: 'Announcement title and content are required.' });
    }

    // MODIFIED: Using $1, $2, NOW()
    const sql = 'INSERT INTO announcements (title, content, created_at) VALUES ($1, $2, NOW())';
    
    db.query(sql, [title, content])
        .then(() => {
            res.json({ success: true, message: `Announcement "${title}" published successfully.` });
        })
        .catch(err => {
            console.error('DB Error creating announcement:', err);
            return res.status(500).json({ success: false, message: 'Failed to save announcement to database.' });
        });
});

app.post('/delete-announcement', (req, res) => {
    const { announcementId } = req.body;
    
    if (!announcementId) {
        return res.status(400).json({ success: false, message: 'Announcement ID is required for deletion.' });
    }

    // MODIFIED: Using $1
    const sql = 'DELETE FROM announcements WHERE id = $1';
    
    db.query(sql, [announcementId])
        .then(result => {
            if (result.rowCount === 0) { // Check affectedRows in PG is result.rowCount
                return res.status(404).json({ success: false, message: 'Announcement not found.' });
            }
            res.json({ success: true, message: 'Announcement deleted successfully.' });
        })
        .catch(err => {
            console.error('DB Error deleting announcement:', err);
            return res.status(500).json({ success: false, message: 'Failed to delete announcement from database.' });
        });
});


// --- START SERVER ---
server.listen(PORT, () => {
    console.log(`🚀 Server (and Socket.IO) is running on http://localhost:${PORT}`);
});