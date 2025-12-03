const sgMail = require('@sendgrid/mail');
const nodemailer = require('nodemailer'); 
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mysql = require('mysql2'); 
const bcrypt = require('bcryptjs'); 

// Set the SendGrid key using the environment variable
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
    console.warn("⚠️ WARNING: SENDGRID_API_KEY is missing in environment variables.");
}

const PORT = process.env.PORT || 8080;
console.log(`🔍 Attempting to start server on PORT: ${PORT}`);

const app = express();
const server = http.createServer(app); 
const io = new Server(server, { 
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// =========================================================================
// 1. GLOBAL SETTINGS & MIDDLEWARE
// =========================================================================

// GLOBAL STATE FOR ENROLLMENT (Action Center Toggle)
let enrollmentOpen = false; // Default is closed

app.use((req, res, next) => {
    const allowedOrigins = [
        'https://crimson0731.github.io',
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        'http://localhost:5501',
        'http://localhost:8080'
    ];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' })); 
app.use(cors()); 

// --- CRITICAL FIX: SERVE UPLOADS WITH ABSOLUTE PATH ---
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); 
app.use(express.static(__dirname)); 

// =========================================================================
// 2. DATABASE CONNECTION
// =========================================================================

let db; 
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 2500;

function attemptDbConnection(retryCount = 0) {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 60000
    });

    pool.query('SELECT 1', (err) => {
        if (!err) {
            db = pool;
            console.log(`✅ Successfully Connected to MySQL database on attempt ${retryCount + 1}`);
            return;
        }

        console.error(`❌ MySQL connection failed on attempt ${retryCount + 1}. Error: ${err.code}`);
        
        if (retryCount < MAX_RETRIES) {
            console.log(`Retrying connection in ${RETRY_DELAY_MS / 1000} seconds...`);
            pool.end();
            setTimeout(() => {
                attemptDbConnection(retryCount + 1);
            }, RETRY_DELAY_MS);
        } else {
            console.error(`🛑 Failed to connect to MySQL after ${MAX_RETRIES} attempts.`);
        }
    });
}

// Start server immediately
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server (and Socket.IO) is running on port ${PORT}`);
    console.log(`✅ Server is bound to 0.0.0.0:${PORT}`);
});

// Connect to database in background
attemptDbConnection();

// =========================================================================
// 3. FILE UPLOAD CONFIGURATION
// =========================================================================

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, unique + '-' + file.originalname);
    }
});

// 1. Main Multer Instance
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB Limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg' || file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(null, false); 
        }
    }
});

// 2. Specific Middleware for New Applications
const uploadApplicationFiles = upload.fields([
    { name: 'card_file', maxCount: 10 },
    { name: 'psa_file', maxCount: 10 },
    { name: 'f137_file', maxCount: 10 },
    { name: 'brgy_cert_file', maxCount: 10 }
]);

// =========================================================================
// 4. HELPER FUNCTIONS (EMAIL & CREDENTIALS)
// =========================================================================

const createOrGetCredentials = (app, callback) => {
    db.query('SELECT username, password FROM users WHERE application_id = ?', [app.id], (checkErr, existingUsers) => {
        if (checkErr) {
            console.error('DB Error checking existing user:', checkErr);
            return callback(checkErr);
        }

        // Return existing if found
        if (existingUsers.length > 0) {
            return callback(null, { 
                username: existingUsers[0].username, 
                password: 'password123'
            });
        }
        
        // Generate new
        const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toLowerCase() : '';
        const firstNameInitials = getInitials(app.first_name);
        const middleNameInitals = getInitials(app.middle_name);
        const formattedLastName = (app.last_name || '').toLowerCase().replace(/ /g, '');
        const username = `${firstNameInitials}${middleNameInitals}${formattedLastName}@dtahs.edu.ph`;
        const plainPassword = 'password123'; 

        bcrypt.hash(plainPassword, 10, (hashErr, passwordHash) => {
            if (hashErr) return callback(hashErr);

            db.query('INSERT INTO users (username, password, application_id) VALUES (?, ?, ?)',
                [username, passwordHash, app.id], (insertErr) => {
                    if (insertErr) {
                        if (insertErr.code === 'ER_DUP_ENTRY') {
                            console.warn(`Duplicate entry detected for application ${app.id}. Re-querying credentials.`);
                            return createOrGetCredentials(app, callback); 
                        }
                        console.error('DB INSERT Error:', insertErr);
                        return callback(insertErr);
                    }
                    callback(null, { username, password: plainPassword, isNew: true });
                }
            );
        });
    });
};

async function sendCredentialsEmail(recipientEmail, studentName, username, password) {
    const msg = {
        to: recipientEmail,
        from: 'dalonzohighschool@gmail.com', // Verified SendGrid sender
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
                <p>Sincerely,<br>The Doña Teodora Alonzo Highschool Administration</p>
            </div>
        `,
    };

    try {
        await sgMail.send(msg); 
        console.log(`✅ Credentials email sent successfully via SendGrid to: ${recipientEmail}`);
        return { success: true };
    } catch (error) {
        console.error('❌ SendGrid API Email failed:', error.response ? error.response.body : error.message);
        return { success: false, error: error.message };
    }
}

async function sendReEnrollmentEmail(recipientEmail, studentName, gradeLevel) {
    const msg = {
        to: recipientEmail,
        from: 'dalonzohighschool@gmail.com', 
        subject: `Enrollment Approved: Grade ${gradeLevel}`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ccc; border-top: 5px solid #2b7a0b;">
                <h2>Hello, ${studentName}!</h2>
                <p>We are pleased to inform you that your enrollment for <strong>Grade ${gradeLevel}</strong> has been officially <strong>APPROVED</strong>.</p>
                
                <div style="background-color: #e9f7ec; padding: 15px; border-left: 4px solid #2b7a0b; margin: 20px 0;">
                    <p style="color: #155724; margin: 0; font-weight: bold;">
                        You may continue using your existing Student Portal account.
                    </p>
                </div>

                <p>Please log in to your dashboard to view your updated status and access school announcements.</p>
                <p>Sincerely,<br>The Doña Teodora Alonzo Highschool Administration</p>
            </div>
        `,
    };

    try {
        await sgMail.send(msg); 
        return { success: true };
    } catch (error) {
        console.error('❌ SendGrid Re-Enrollment Email Failed:', error.message);
        return { success: false, error: error.message };
    }
}

async function sendRejectionEmail(recipientEmail, studentName, reason) {
    const msg = {
        to: recipientEmail,
        from: 'dalonzohighschool@gmail.com',
        subject: 'Update on Your Enrollment Application',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ccc; border-top: 5px solid #dc3545;">
                <h2>Hello, ${studentName}.</h2>
                <p>We have reviewed your enrollment application. Unfortunately, we cannot approve your application at this time.</p>
                
                <div style="background-color: #f8d7da; color: #721c24; padding: 15px; border-left: 4px solid #dc3545; margin: 20px 0;">
                    <strong>Reason for Rejection:</strong><br>
                    ${reason || 'Application requirements were not met.'}
                </div>

                <p><strong>What you can do:</strong></p>
                <ul>
                    <li>Review the reason provided above.</li>
                    <li>Prepare the correct documents or information.</li>
                    <li>Submit a new application on our enrollment page.</li>
                </ul>

                <p>If you have questions, please contact the school administration.</p>
                <p>Sincerely,<br>The Doña Teodora Alonzo Highschool Administration</p>
            </div>
        `,
    };

    try {
        await sgMail.send(msg);
        console.log(`✅ Rejection email sent to: ${recipientEmail}`);
        return { success: true };
    } catch (error) {
        console.error('❌ SendGrid Rejection Email Failed:', error.message);
        return { success: false, error: error.message };
    }
}

// =========================================================================
// 5. SOCKET.IO CONFIGURATION
// =========================================================================

io.on('connection', (socket) => {
    console.log('A user connected with socket ID:', socket.id);

    // For enrolled students
    socket.on('registerUser', (applicationId) => {
        socket.join(`user-${applicationId}`);
        console.log(`User for app ID ${applicationId} joined room: user-${applicationId}`);
    });

    // For Inquiry Notifications
    socket.on('watchInquiry', (inquiryId) => {
        socket.join(`inquiry-${inquiryId}`);
        console.log(`Socket ${socket.id} is watching Inquiry #${inquiryId}`);
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

// =========================================================================
// 6. ROUTES - ENROLLMENT TOGGLE
// =========================================================================

app.get('/get-enrollment-status', (req, res) => {
    res.json({ success: true, isOpen: enrollmentOpen });
});

app.post('/toggle-enrollment', (req, res) => {
    const { isOpen } = req.body;
    enrollmentOpen = isOpen;
    
    // BROADCAST TO ALL CONNECTED CLIENTS (Instant Update)
    io.emit('enrollmentStatusChanged', { isOpen: enrollmentOpen });
    
    console.log(`Enrollment system is now ${enrollmentOpen ? 'OPEN' : 'CLOSED'}`);
    res.json({ success: true, message: `Enrollment is now ${isOpen ? 'OPEN' : 'CLOSED'}` });
});

// =========================================================================
// 7. ROUTES - AUTH & PASSWORDS
// =========================================================================

// FORGOT PASSWORD
app.post('/forgot-password', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

    const sql = `
        SELECT u.id AS user_id, u.username, a.first_name, a.email AS contact_email 
        FROM users u 
        JOIN applications a ON u.application_id = a.id 
        WHERE u.username = ? OR a.email = ?`;

    db.query(sql, [email, email], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: "Database error." });

        if (results.length === 0) {
            return res.json({ success: true, message: "If this email is registered, a reset link has been sent." });
        }

        const user = results[0];
        const tempPassword = Math.random().toString(36).slice(-8);

        bcrypt.hash(tempPassword, 10, (hashErr, hashedPassword) => {
            if (hashErr) return res.status(500).json({ success: false, message: "Encryption error." });

            const updateSql = "UPDATE users SET password = ? WHERE id = ?";
            db.query(updateSql, [hashedPassword, user.user_id], async (updateErr) => {
                if (updateErr) return res.status(500).json({ success: false, message: "Failed to update password." });

                const msg = {
                    to: user.contact_email, 
                    from: 'dalonzohighschool@gmail.com',
                    subject: 'Password Reset Request - DTAHS',
                    html: `
                        <div style="font-family: Arial, sans-serif; padding: 20px; border-top: 5px solid #dc3545;">
                            <h3>Password Reset Request</h3>
                            <p>Hello ${user.first_name},</p>
                            <p>Your new <strong>Temporary Password</strong> is:</p>
                            <div style="background: #f8f9fa; padding: 15px; font-weight: bold; text-align: center; border: 1px dashed #ccc;">
                                ${tempPassword}
                            </div>
                            <p style="margin-top: 20px;">Please log in and change it immediately.</p>
                        </div>
                    `,
                };

                try {
                    await sgMail.send(msg);
                    res.json({ success: true, message: "Reset email sent." });
                } catch (emailErr) {
                    res.json({ success: false, message: "Failed to send email." });
                }
            });
        });
    });
});

// STUDENT LOGIN
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const sql = 'SELECT u.application_id, u.password FROM users u WHERE u.username = ?';
    
    db.query(sql, [username], async (err, users) => {
        if (err || users.length === 0) return res.status(401).json({ success: false, message: 'Invalid credentials.' });

        const user = users[0];
        if (await bcrypt.compare(password, user.password)) {
            const isFirstLogin = await bcrypt.compare('password123', user.password);

            db.query('SELECT * FROM applications WHERE id = ?', [user.application_id], (appErr, applications) => {
                if (appErr || applications.length === 0) return res.status(500).json({ success: false, message: 'App data not found.' });
                
                const applicationData = applications[0];
                applicationData.username = username;
                applicationData.password = password; 

                res.json({ 
                    success: true, 
                    application: applicationData,
                    firstLogin: isFirstLogin 
                });
            });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }
    });
});

// ADMIN LOGIN
app.post('/admin-login', (req, res) => {
    db.query('SELECT password_hash FROM admins WHERE username = ?', [req.body.username], async (err, results) => {
        if (err || results.length === 0) return res.status(401).json({ success: false, message: 'Invalid credentials.' });

        const match = await bcrypt.compare(req.body.password, results[0].password_hash);
        if (match) {
            res.json({ success: true, username: req.body.username });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }
    });
});

// ADMIN CHANGE PASSWORD
app.post('/admin-change-password', (req, res) => {
    const { username, currentPassword, newPassword } = req.body;
    
    const checkSql = 'SELECT password_hash FROM admins WHERE username = ?';
    db.query(checkSql, [username], async (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ success: false, message: 'Admin not found.' });

        const match = await bcrypt.compare(currentPassword, results[0].password_hash);
        if (!match) return res.status(401).json({ success: false, message: 'Incorrect current password.' });

        bcrypt.hash(newPassword, 10, (hashErr, newHash) => {
            if (hashErr) return res.status(500).json({ success: false, message: 'Encryption error.' });

            db.query('UPDATE admins SET password_hash = ? WHERE username = ?', [newHash, username], (updateErr) => {
                if (updateErr) return res.status(500).json({ success: false, message: 'Update failed.' });
                res.json({ success: true, message: 'Password updated.' });
            });
        });
    });
});

// STUDENT CHANGE PASSWORD
app.post('/change-password', (req, res) => {
    const { applicationId, currentPassword, newPassword } = req.body;

    const checkSql = 'SELECT password FROM users WHERE application_id = ?';
    db.query(checkSql, [applicationId], async (checkErr, users) => {
        if (checkErr || users.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });
        
        const match = await bcrypt.compare(currentPassword, users[0].password);
        if (!match) return res.status(401).json({ success: false, message: 'Incorrect password.' });

        bcrypt.hash(newPassword, 10, (hashErr, newPasswordHash) => {
            if (hashErr) return res.status(500).json({ success: false, message: 'Encryption error.' });

            const updateSql = 'UPDATE users SET password = ? WHERE application_id = ?';
            db.query(updateSql, [newPasswordHash, applicationId], (updateErr, result) => {
                if (updateErr) return res.status(500).json({ success: false, message: 'Update failed.' });
                res.json({ success: true, message: 'Password updated successfully.' });
            });
        });
    });
});

// =========================================================================
// 8. UTILITY ROUTES
// =========================================================================

app.post('/delete-application', (req, res) => {
    const { applicationId } = req.body;

    db.query('SELECT * FROM applications WHERE id = ?', [applicationId], (findErr, apps) => {
        if (findErr || apps.length === 0) return res.status(404).json({ success: false });
        
        const app = apps[0];
        db.query('DELETE FROM users WHERE application_id = ?', [applicationId], (userErr) => {
            db.query('DELETE FROM applications WHERE id = ?', [applicationId], (appErr, result) => {
                if (appErr) return res.status(500).json({ success: false });
                
                // Attempt file cleanup
                [app.doc_card_path, app.doc_psa_path, app.doc_f137_path, app.doc_brgy_cert_path].forEach(f => {
                    try { if (f) fs.unlinkSync(path.join(__dirname, 'uploads', f)); } catch(e) {}
                });
                
                res.json({ success: true, message: 'Deleted.' });
            });
        });
    });
});

app.get('/get-announcements', (req, res) => {
    db.query('SELECT * FROM announcements ORDER BY created_at DESC', (err, r) => res.json({ success: true, announcements: r }));
});

app.post('/create-announcement', (req, res) => {
    db.query('INSERT INTO announcements (title, content, created_at) VALUES (?, ?, NOW())', [req.body.title, req.body.content], () => res.json({ success: true }));
});

app.post('/delete-announcement', (req, res) => {
    db.query('DELETE FROM announcements WHERE id = ?', [req.body.announcementId], () => res.json({ success: true }));
});

app.get('/get-inquiries', (req, res) => {
    db.query("SELECT * FROM inquiries ORDER BY created_at DESC", (err, r) => res.json({ success: true, inquiries: r }));
});

app.post('/reply-inquiry', (req, res) => {
    db.query("UPDATE inquiries SET status = ? WHERE id = ?", [req.body.status, req.body.inquiryId], () => res.json({ success: true }));
});

app.post('/generate-credentials', (req, res) => {
    db.query('SELECT * FROM applications WHERE id = ?', [req.body.applicationId], (err, apps) => {
        createOrGetCredentials(apps[0], async (credErr, creds) => {
            await sendCredentialsEmail(apps[0].email, apps[0].first_name, creds.username, creds.password);
            res.json({ success: true });
        });
    });
});

// --- UPDATED SUBMIT APPLICATION (HANDLES RE-APPLICATION AFTER REJECTION) ---
app.post('/submit-application', uploadApplicationFiles, (req, res) => {
    const files = req.files || {};
    const { first_name, last_name, middle_name, birthdate, email, phone_num, grade_level } = req.body;

    const getFilenames = (fieldName) => {
        if (files[fieldName] && files[fieldName].length > 0) {
            return files[fieldName].map(f => f.filename).join(',');
        }
        return null;
    };

    const card = getFilenames('card_file');
    const psa = getFilenames('psa_file');
    const f137 = getFilenames('f137_file');
    const brgy = getFilenames('brgy_cert_file');

    if (!first_name || !email) return res.status(400).json({ success: false, message: 'Missing fields.' });

    // HELPER TO PERFORM INSERT
    const executeInsert = () => {
        const sql = `INSERT INTO applications (first_name, last_name, middle_name, birthdate, email, phone, grade_level, status, doc_card_path, doc_psa_path, doc_f137_path, doc_brgy_cert_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending Review', ?, ?, ?, ?, NOW())`;
        db.query(sql, [first_name, last_name, middle_name, birthdate, email, phone_num, grade_level, card, psa, f137, brgy], (err, result) => {
            if (err) {
                console.error("DB Insert Error:", err);
                return res.status(500).json({ success: false, message: 'DB Error.' });
            }
            res.json({ success: true, message: 'ID: ' + result.insertId });
        });
    };

    // CHECK EXISTING EMAIL STATUS
    db.query('SELECT id, status FROM applications WHERE email = ?', [email], (checkErr, existing) => {
        if (existing.length > 0) {
            const existingApp = existing[0];
            
            // IF REJECTED: Delete old records and allow new insert
            if (existingApp.status === 'Rejected') {
                console.log(`Overwriting rejected application ID: ${existingApp.id}`);
                
                // Clean up linked user account first (if any)
                db.query('DELETE FROM users WHERE application_id = ?', [existingApp.id], () => {
                    // Then delete the application itself
                    db.query('DELETE FROM applications WHERE id = ?', [existingApp.id], () => {
                        // Finally, run the new insert
                        executeInsert();
                    });
                });
            } 
            // IF PENDING OR APPROVED: Block duplicate
            else {
                return res.status(400).json({ success: false, message: 'Email already registered.' });
            }
        } 
        // IF NEW EMAIL: Proceed
        else {
            executeInsert();
        }
    });
});

// --- RE-ENROLLMENT (Old Students) ---
app.post('/student-re-enroll', upload.single('school_card'), (req, res) => {
    if (!enrollmentOpen) return res.json({ success: false, message: "Enrollment is closed." });
    if (!req.file) return res.status(400).json({ success: false, message: "Report card required." });
    
    const { applicationId, nextGradeLevel } = req.body;
    const schoolCardPath = req.file.filename;

    const sql = `UPDATE applications SET grade_level = ?, status = 'Pending Review', created_at = NOW(), doc_card_path = ? WHERE id = ?`;
    db.query(sql, [nextGradeLevel, schoolCardPath, applicationId], (err, result) => {
        if (err) {
            fs.unlinkSync(path.join(__dirname, 'uploads', schoolCardPath)); 
            return res.status(500).json({ success: false });
        }
        io.emit('newApplicationReceived', { message: `Student re-enrolled` });
        res.json({ success: true, message: "Re-enrollment submitted." });
    });
});

// --- GET APPLICATIONS ---
app.get('/get-applications', (req, res) => {
    const sql = `
        SELECT a.id, a.first_name, a.last_name, a.email, a.grade_level, a.status, a.created_at,
               CASE WHEN u.id IS NOT NULL THEN 1 ELSE 0 END AS is_old_student
        FROM applications a
        LEFT JOIN users u ON a.id = u.application_id
        ORDER BY a.created_at DESC`;
    db.query(sql, (err, results) => res.json({ success: true, applications: results }));
});

// --- UPDATE STATUS ---
app.post('/update-application-status', (req, res) => {
    const { applicationId, newStatus, rejectionReason } = req.body;

    db.query('SELECT * FROM applications WHERE id = ?', [applicationId], (err, apps) => {
        const appData = apps[0];
        db.query('SELECT id FROM users WHERE application_id = ?', [applicationId], (uErr, users) => {
            const isOldStudent = users.length > 0;

            db.query('UPDATE applications SET status = ? WHERE id = ?', [newStatus, applicationId], async () => {
                // Notify via Socket.io (Frontend Realtime)
                io.to(`user-${applicationId}`).emit('statusUpdated', { 
                    newStatus: newStatus, 
                    message: isOldStudent ? `Re-enrollment Update` : "Status Updated" 
                });

                // Handle Email Notifications based on Status
                if (newStatus === 'Approved') {
                    if (isOldStudent) {
                        await sendReEnrollmentEmail(appData.email, appData.first_name, appData.grade_level);
                        res.json({ success: true, message: "Old student approved." });
                    } else {
                        createOrGetCredentials(appData, async (credErr, credentials) => {
                            await sendCredentialsEmail(appData.email, appData.first_name, credentials.username, credentials.password);
                            res.json({ success: true, message: "New student approved." });
                        });
                    }
                } 
                // --- HANDLE REJECTION EMAILS ---
                else if (newStatus === 'Rejected') {
                    await sendRejectionEmail(appData.email, appData.first_name, rejectionReason);
                    res.json({ success: true, message: "Application rejected and email sent." });
                } 
                else {
                    res.json({ success: true, message: `Status updated.` });
                }
            });
        });
    });
});

// --- GET APP DETAILS ---
app.get('/get-application-details/:id', (req, res) => {
    const sql = `SELECT a.*, u.username AS student_username, CASE WHEN u.id IS NOT NULL THEN 1 ELSE 0 END AS is_old_student FROM applications a LEFT JOIN users u ON a.id = u.application_id WHERE a.id = ?`;
    db.query(sql, [req.params.id], (err, results) => {
        if (results.length === 0) return res.json({ success: false });
        if (results[0].student_username) results[0].student_password = '[Hidden]'; 
        res.json({ success: true, application: results[0] });
    });
});

// =========================================================================
// 9. INQUIRY ROUTE (WITH EMAIL NOTIFICATION FIX)
// =========================================================================

app.post('/submit-inquiry', upload.single('attachment'), async (req, res) => {
    const { name, email, subject, message } = req.body;
    const attachmentFilename = req.file ? req.file.filename : null;

    // 1. Save to Database
    const sql = "INSERT INTO inquiries (sender_name, sender_email, subject, message, attachment_path) VALUES (?, ?, ?, ?, ?)";
    
    db.query(sql, [name, email, subject, message, attachmentFilename], async (err, result) => {
        if (err) {
            console.error("Database Insert Error:", err);
            return res.status(500).json({ success: false, message: "Failed to save inquiry." });
        }

        // 2. Setup Nodemailer Transporter (Using Gmail)
        // Ensure EMAIL_USER and EMAIL_PASS are set in your Railway Environment Variables
        const transporter = nodemailer.createTransport({
            service: 'gmail', 
            auth: {
                user: process.env.EMAIL_USER, 
                pass: process.env.EMAIL_PASS
            }
        });

        // 3. Setup Email Content
        const mailOptions = {
            from: `"Inquiry System" <${process.env.EMAIL_USER}>`, 
            to: 'dalonzohighschool@gmail.com', // Admin Email (where you receive inquiries)
            replyTo: email, // This allows you to reply directly to the student
            subject: `New Inquiry: ${subject}`,
            html: `
                <h3>New Web Inquiry Received</h3>
                <p><strong>From:</strong> ${name} (${email})</p>
                <p><strong>Subject:</strong> ${subject}</p>
                <hr>
                <p><strong>Message:</strong></p>
                <p>${message}</p>
            `,
            attachments: req.file ? [
                {
                    filename: req.file.originalname,
                    path: req.file.path
                }
            ] : []
        };

        // 4. Send the Email
        try {
            await transporter.sendMail(mailOptions);
            console.log("✅ Inquiry email sent to admin successfully.");
            res.json({ success: true, message: "Inquiry sent and saved!" });
        } catch (emailError) {
            console.error("❌ Email Sending Failed:", emailError);
            // Return success because the DB insert worked, but log the email failure.
            res.json({ success: true, message: "Inquiry saved (Email notification failed)." });
        }
    });
});
