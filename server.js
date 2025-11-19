const sgMail = require('@sendgrid/mail');

// Set the key using the environment variable
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
    console.warn("⚠️ WARNING: SENDGRID_API_KEY is missing in environment variables.");
}

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mysql = require('mysql2'); 
const nodemailer = require('nodemailer'); 
const bcrypt = require('bcryptjs'); 

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

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Server is running' });
});

app.get('/', (req, res) => {
    res.send('<h1>Server is running!</h1><p>If you see this, the deployment is working.</p>');
});

app.use('/uploads', express.static('uploads')); 
app.use(express.static(__dirname)); 

// -----------------------------------------------------------------
// DATABASE CONNECTION LOGIC
// -----------------------------------------------------------------

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

// -----------------------------------------------------------------
// FILE UPLOAD CONFIGURATION
// -----------------------------------------------------------------

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, unique + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, 
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg' || file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(null, false); 
        }
    }
});

const uploadApplicationFiles = upload.fields([
    { name: 'card_file', maxCount: 1 },
    { name: 'psa_file', maxCount: 1 },
    { name: 'f137_file', maxCount: 1 },
    { name: 'brgy_cert_file', maxCount: 1 }
]);

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

// -----------------------------------------------------------------
// HELPER FUNCTIONS
// -----------------------------------------------------------------

const createOrGetCredentials = (app, callback) => {
    db.query('SELECT username, password FROM users WHERE application_id = ?', [app.id], (checkErr, existingUsers) => {
        if (checkErr) {
            console.error('DB Error checking existing user:', checkErr);
            return callback(checkErr);
        }

        if (existingUsers.length > 0) {
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
        from: 'dalonzohighschool@gmail.com', 
        subject: 'Enrollment Status & Portal Credentials',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ccc; border-top: 5px solid #2b7a0b;">
                <h2>Hello, ${studentName}!</h2>
                <p>You have been granted <b>Provisional Access</b> to the Student Portal, or your enrollment has been <b>APPROVED</b>.</p>
                <p>Use the credentials below to access the Student Dashboard.</p>
                
                <h3 style="color: #2b7a0b;">Your Student Portal Login Details:</h3>
                <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                    <tr>
                        <td style="padding: 10px; border: 1px solid #eee; background-color: #f9f9f9; width: 30%;"><strong>Username:</strong></td>
                        <td style="padding: 10px; border: 1px solid #eee;"><code>${username}</code></td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #eee; background-color: #f9f9f9;"><strong>Temporary Password:</strong></td>
                        <td style="padding: 10px; border: 1px solid #eee;"><code>${password}</code></td>
                    </tr>
                </table>
                <p>Please change this password immediately upon logging in.</p>
            </div>
        `,
    };

    try {
        await sgMail.send(msg); 
        return { success: true };
    } catch (error) {
        console.error('❌ SendGrid API Email failed:', error.message);
        return { success: false, error: error.message };
    }
}

// -----------------------------------------------------------------
// SOCKET.IO CONFIGURATION
// -----------------------------------------------------------------

io.on('connection', (socket) => {
    console.log('A user connected with socket ID:', socket.id);

    socket.on('registerUser', (applicationId) => {
        socket.join(`user-${applicationId}`);
    });

    socket.on('watchInquiry', (inquiryId) => {
        socket.join(`inquiry-${inquiryId}`);
    });

    socket.on('disconnect', () => {});
});

// -----------------------------------------------------------------
// ROUTES
// -----------------------------------------------------------------

// Forgot Password
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
        if (results.length === 0) return res.json({ success: true, message: "If this email is registered, a reset link has been sent." });

        const user = results[0];
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let tempPassword = "";
        for (let i = 0; i < 8; i++) tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));

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
                            <p>Your new <strong>Temporary Password</strong> is: <strong>${tempPassword}</strong></p>
                            <p>Please log in and change it immediately.</p>
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

// Submit Application (New Student)
app.post('/submit-application', (req, res) => {
    uploadApplicationFiles(req, res, (err) => {
        const uploadedFiles = req.files || {};
        const fileNames = Object.values(uploadedFiles).flat().map(f => f.filename).filter(n => n); 

        if (err) {
            cleanupFiles(fileNames);
            return res.status(500).json({ success: false, message: 'Upload error: ' + err.message });
        }
        
        const { first_name, last_name, middle_name, birthdate, email, phone_num, grade_level } = req.body;
        const card_file = uploadedFiles['card_file']?.[0]?.filename || null;
        const psa_file = uploadedFiles['psa_file']?.[0]?.filename || null;
        const f137_file = uploadedFiles['f137_file']?.[0]?.filename || null;
        const brgy_cert_file = uploadedFiles['brgy_cert_file']?.[0]?.filename || null;
        
        if (!first_name || !email || !card_file || !psa_file || !f137_file || !brgy_cert_file) {
            cleanupFiles(fileNames);
            return res.status(400).json({ success: false, message: 'Missing required fields.' });
        }

        db.query('SELECT id FROM applications WHERE email = ?', [email], (checkErr, existingApps) => {
            if (existingApps.length > 0) {
                cleanupFiles(fileNames);
                return res.status(400).json({ success: false, message: 'Email already registered.' });
            }

            const sql = `INSERT INTO applications 
            (first_name, last_name, middle_name, birthdate, email, phone, grade_level, status, doc_card_path, doc_psa_path, doc_f137_path, doc_brgy_cert_path) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending Review', ?, ?, ?, ?)`;
            
            db.query(sql, [first_name, last_name, middle_name, birthdate, email, phone_num, grade_level, card_file, psa_file, f137_file, brgy_cert_file], (dbErr, result) => {
                if (dbErr) {
                    cleanupFiles(fileNames); 
                    return res.status(500).json({ success: false, message: 'Database error.' });
                }
                res.json({ success: true, message: 'Application submitted ID: ' + result.insertId });
            });
        });
    });
});

// ==========================================
//      RE-ENROLLMENT ROUTE (NEW FEATURE)
// ==========================================
app.post('/student-re-enroll', (req, res) => {
    const { applicationId, nextGradeLevel } = req.body;

    if (!applicationId || !nextGradeLevel) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    // Logic: Update grade, reset status to 'Pending Review', and update timestamp
    const sql = `
        UPDATE applications 
        SET grade_level = ?, status = 'Pending Review', created_at = NOW() 
        WHERE id = ?`;

    db.query(sql, [nextGradeLevel, applicationId], (err, result) => {
        if (err) {
            console.error("Re-enrollment DB Error:", err);
            return res.status(500).json({ success: false, message: "Database error during re-enrollment." });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Student record not found." });
        }

        // Notify Admin
        io.emit('newApplicationReceived', { message: `A student has re-enrolled for ${nextGradeLevel}` });

        res.json({ success: true, message: "Re-enrollment successful! Your status is now Pending Review." });
    });
});

// Get Applications
app.get('/get-applications', (req, res) => {
    const sql = 'SELECT id, first_name, last_name, email, grade_level, status, created_at FROM applications ORDER BY created_at DESC';
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error.' });
        res.json({ success: true, applications: results });
    });
});

// Update Status
app.post('/update-application-status', (req, res) => {
    const { applicationId, newStatus } = req.body;

    const updateStatus = (successMessage, credentials = null) => {
        db.query('UPDATE applications SET status = ? WHERE id = ?', [newStatus, applicationId], (err) => {
            if (err) return res.status(500).json({ success: false, message: 'DB Update Error.' });
            
            io.to(`user-${applicationId}`).emit('statusUpdated', { newStatus: newStatus, message: "Your status has been updated!" });

            if (credentials) {
                return res.json({ success: true, message: successMessage, student_username: credentials.username, student_password: credentials.password });
            }
            res.json({ success: true, message: successMessage });
        });
    };

    if (newStatus === 'Approved') {
        db.query('SELECT * FROM applications WHERE id = ?', [applicationId], async (err, apps) => {
            if (apps.length === 0) return res.json({ success: false, message: 'App not found.' });
            
            createOrGetCredentials(apps[0], async (credErr, credentials) => {
                if (credErr) return res.status(500).json({ success: false, message: 'Credential error.' });
                await sendCredentialsEmail(apps[0].email, apps[0].first_name, credentials.username, credentials.password);
                updateStatus(`Application Approved.`, credentials);
            });
        });
    } else {
        updateStatus(`Status set to ${newStatus}.`);
    }
});

// Get App Details
app.get('/get-application-details/:id', (req, res) => {
    const sql = `SELECT a.*, u.username AS student_username, u.password AS student_password FROM applications a LEFT JOIN users u ON a.id = u.application_id WHERE a.id = ?`;
    db.query(sql, [req.params.id], (err, results) => {
        if (results.length === 0) return res.json({ success: false, message: 'Not found.' });
        const app = results[0];
        if (app.student_username) app.student_password = 'password123';
        res.json({ success: true, application: app });
    });
});

// Student Login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const sql = 'SELECT u.application_id, u.password FROM users u WHERE u.username = ?';
    
    db.query(sql, [username], async (err, users) => {
        if (users.length === 0) return res.status(401).json({ success: false, message: 'Invalid credentials.' });

        const user = users[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        
        const isFirstLogin = await bcrypt.compare('password123', user.password);
        db.query('SELECT * FROM applications WHERE id = ?', [user.application_id], (appErr, applications) => {
            const applicationData = applications[0];
            applicationData.username = username;
            res.json({ success: true, application: applicationData, firstLogin: isFirstLogin });
        });
    });
});

// Admin Login
app.post('/admin-login', (req, res) => {
    const { username, password } = req.body;
    const sql = 'SELECT password_hash FROM admins WHERE username = ?';
    db.query(sql, [username], async (err, results) => {
        if (results.length === 0) return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        const match = await bcrypt.compare(password, results[0].password_hash);
        if (match) res.json({ success: true, username: username });
        else res.status(401).json({ success: false, message: 'Invalid credentials.' });
    });
});

// Change Password
app.post('/change-password', (req, res) => {
    const { applicationId, currentPassword, newPassword } = req.body;
    db.query('SELECT password FROM users WHERE application_id = ?', [applicationId], async (checkErr, users) => {
        if (users.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });
        
        const match = await bcrypt.compare(currentPassword, users[0].password);
        if (!match) return res.status(401).json({ success: false, message: 'Incorrect current password.' });

        bcrypt.hash(newPassword, 10, (hashErr, newPasswordHash) => {
            db.query('UPDATE users SET password = ? WHERE application_id = ?', [newPasswordHash, applicationId], (updateErr) => {
                res.json({ success: true, message: 'Password updated successfully.' });
            });
        });
    });
});

// Inquiry Routes
app.post('/submit-inquiry', upload.single('attachment'), (req, res) => {
    const { name, email, subject, message } = req.body;
    const attachment = req.file ? req.file.filename : null;
    const sql = "INSERT INTO inquiries (sender_name, sender_email, subject, message, attachment_path) VALUES (?, ?, ?, ?, ?)";
    db.query(sql, [name, email, subject, message, attachment], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: "DB Error" });
        res.json({ success: true, message: "Inquiry sent!", inquiryId: result.insertId });
    });
});

app.get('/get-announcements', (req, res) => {
    db.query('SELECT id, title, content FROM announcements ORDER BY created_at DESC', (err, results) => {
        res.json({ success: true, announcements: results });
    });
});
