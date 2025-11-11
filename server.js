// --- Imports ---
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mysql = require('mysql2'); 

// --- CONFIG ---
const PORT = process.env.PORT || 3000;
const app = express();

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads')); 
app.use(express.static(__dirname)); 

// --- MySQL Connection ---
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '#PROFELECGROUP1',
    database: 'enrollment_system'
});

db.connect((err) => {
    if (err) {
        console.error('❌ MySQL connection failed:', err);
        process.exit(1);
    }
    console.log('✅ Successfully Connected to MySQL database');
});

// --- Create uploads folder ---
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// --- Multer Setup ---
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
}).fields([
    { name: 'card_file', maxCount: 1 },
    { name: 'psa_file', maxCount: 1 },
    { name: 'f137_file', maxCount: 1 },
    { name: 'brgy_cert_file', maxCount: 1 }
]);

// =========================================================================
//                             API ENDPOINTS
// =========================================================================

// --- 1. STUDENT: Application Submission (FIXED) ---
app.post('/submit-application', (req, res) => {
    upload(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ success: false, message: 'File upload error: ' + err.message });
        } else if (err) {
            return res.status(500).json({ success: false, message: 'Server error during upload.' });
        }

        const { first_name, last_name, middle_name, birthdate, email, phone_num, grade_level } = req.body;
        
        const card_file = req.files['card_file'] ? req.files['card_file'][0].filename : null;
        const psa_file = req.files['psa_file'] ? req.files['psa_file'][0].filename : null;
        const f137_file = req.files['f137_file'] ? req.files['f137_file'][0].filename : null;
        const brgy_cert_file = req.files['brgy_cert_file'] ? req.files['brgy_cert_file'][0].filename : null;

        if (!first_name || !email || !card_file || !psa_file) {
            [card_file, psa_file, f137_file, brgy_cert_file].forEach(file => {
                if (file) fs.unlink(path.join('uploads', file), (err) => err && console.error('Cleanup error:', err));
            });
            return res.status(400).json({ success: false, message: 'Missing required fields or documents.' });
        }

        const sql = `INSERT INTO applications 
                     (first_name, last_name, middle_name, birthdate, email, phone, grade_level, status, doc_card_path, doc_psa_path, doc_f137_path, doc_brgy_cert_path) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending Review', ?, ?, ?, ?)`;
        
        db.query(sql, [first_name, last_name, middle_name, birthdate, email, phone_num, grade_level, card_file, psa_file, f137_file, brgy_cert_file], (dbErr, result) => {
            if (dbErr) {
                console.error('DB Insert Error:', dbErr);
                return res.status(500).json({ success: false, message: 'Database error while saving application.' });
            }
            res.json({ success: true, message: 'Application submitted successfully with ID: ' + result.insertId });
        });
    });
});

// --- 2. ADMIN: Get all applications ---
app.get('/get-applications', (req, res) => {
    const sql = 'SELECT id, first_name, last_name, email, grade_level, status, created_at FROM applications ORDER BY created_at DESC';
    db.query(sql, (err, results) => {
        if (err) {
            console.error('DB Error:', err);
            return res.status(500).json({ success: false, message: 'Failed to retrieve applications.' });
        }
        res.json({ success: true, applications: results });
    });
});

// --- 3. ADMIN: Update Application Status (FIXED USERNAME) ---
app.post('/update-application-status', (req, res) => {
    const { applicationId, newStatus } = req.body;

    const updateStatus = () => {
        db.query('UPDATE applications SET status = ? WHERE id = ?', [newStatus, applicationId], (err) => {
            if (err) {
                console.error('DB Error updating status:', err);
                return res.status(500).json({ success: false, message: 'Failed to update application status.' });
            }
             if (newStatus === 'Approved') {
                db.query('SELECT username, password FROM users WHERE application_id = ?', [applicationId], (err, users) => {
                    if (err || users.length === 0) return res.json({ success: true, message: `Application ${newStatus}.` });
                    res.json({ 
                        success: true, 
                        message: `Application ${newStatus}.`,
                        student_username: users[0].username,
                        student_password: users[0].password 
                    });
                });
            } else {
                res.json({ success: true, message: `Application status set to ${newStatus}.` });
            }
        });
    };

    if (newStatus === 'Approved') {
        db.query('SELECT * FROM applications WHERE id = ?', [applicationId], (err, apps) => {
            if (err) return res.status(500).json({ success: false, message: 'Server error while fetching app data.' });
            if (apps.length === 0) return res.json({ success: false, message: 'Application not found.' });
            
            const app = apps[0];
            
            // --- FIXED USERNAME LOGIC ---
            // "Jason", "Ramos", "Villanueva" -> "jrvillanueva@dtahs.edu.ph"
            // "James Earl", "Ramos", "Dela Cruz" -> "jerdelacruz@dtahs.edu.ph"
            const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toLowerCase() : '';

            const firstNameInitials = getInitials(app.first_name);
            const middleNameInitials = getInitials(app.middle_name);
            const formattedLastName = (app.last_name || '').toLowerCase().replace(/ /g, '');
            
            const username = `${firstNameInitials}${middleNameInitials}${formattedLastName}@dtahs.edu.ph`;
            const password = 'password123'; 
            // --- END FIXED LOGIC ---

            db.query('INSERT INTO users (username, password, application_id) VALUES (?, ?, ?)',
                [username, password, applicationId], (err) => {
                if (err) {
                    console.error('User creation failed (likely duplicate):', err);
                }
                updateStatus(); // Always update status
            });
        });
    } else {
        updateStatus();
    }
});

// --- 4. ADMIN: Get Application Details ---
app.get('/get-application-details/:id', (req, res) => {
    const applicationId = req.params.id;
    const applicationQuery = 'SELECT * FROM applications WHERE id = ?';
    
    db.query(applicationQuery, [applicationId], (err, apps) => {
        if (err) return res.status(500).json({ success: false, message: 'Server error.' });
        if (apps.length === 0) return res.json({ success: false, message: 'Application not found.' });

        const app = apps[0];
        if (app.status === 'Approved') {
            const userQuery = 'SELECT username, password FROM users WHERE application_id = ?';
            db.query(userQuery, [applicationId], (userErr, users) => {
                if (users.length > 0) {
                    app.student_username = users[0].username;
                    app.student_password = users[0].password;
                }
                res.json({ success: true, application: app });
            });
        } else {
            res.json({ success: true, application: app });
        }
    });
});

// --- 5. ADMIN: Delete Application ---
app.post('/delete-application', (req, res) => {
    const { applicationId } = req.body;

    db.query('SELECT * FROM applications WHERE id = ?', [applicationId], (findErr, apps) => {
        if (findErr || apps.length === 0) return res.status(404).json({ success: false, message: 'Application not found.' });
        
        const app = apps[0];
        db.query('DELETE FROM users WHERE application_id = ?', [applicationId], (userErr) => {
            if (userErr) console.error('DB Error deleting user:', userErr);
            
            db.query('DELETE FROM applications WHERE id = ?', [applicationId], (appErr) => {
                if (appErr) return res.status(500).json({ success: false, message: 'Failed to delete application.' });
                
                // Delete files
                const filesToDelete = [app.doc_card_path, app.doc_psa_path, app.doc_f137_path, app.doc_brgy_cert_path];
                filesToDelete.forEach(file => {
                    if (file) fs.unlink(path.join(__dirname, 'uploads', file), e => e && console.error('Error deleting file:', file, e));
                });
                res.json({ success: true, message: 'Application and all data permanently deleted.' });
            });
        });
    });
});

// --- 6. ADMIN: Login ---
app.post('/admin-login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'admin123') {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Wrong admin credentials.' });
    }
});

// --- 7. NEW: STUDENT LOGIN ---
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Please enter username and password.' });
    }

    // WARNING: Storing plain text passwords is a major security risk.
    // This code matches your current (insecure) schema.
    // Consider using 'bcrypt' to hash passwords in the future.
    const sql = 'SELECT * FROM users WHERE username = ? AND password = ?';
    
    db.query(sql, [username, password], (err, users) => {
        if (err) {
            console.error('Student Login DB Error:', err);
            return res.status(500).json({ success: false, message: 'Server database error.' });
        }

        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials. Please try again.' });
        }

        const user = users[0];
        
        // User found, now get their application data
        const appSql = 'SELECT * FROM applications WHERE id = ?';
        db.query(appSql, [user.application_id], (appErr, applications) => {
            if (appErr || applications.length === 0) {
                return res.status(500).json({ success: false, message: 'Could not find application data for this user.' });
            }
            
            const applicationData = applications[0];
            // Add username and password to the data object for the dashboard
            applicationData.username = user.username;
            applicationData.password = user.password; // For change password check

            res.json({ success: true, application: applicationData });
        });
    });
});

// --- 8. NEW: GET ANNOUNCEMENTS (for Dashboard) ---
app.get('/get-announcements', (req, res) => {
    const sql = 'SELECT title, content FROM announcements ORDER BY created_at DESC';
    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Failed to retrieve announcements.' });
        }
        res.json({ success: true, announcements: results });
    });
});

// --- 9. NEW: CHANGE PASSWORD (for Dashboard) ---
app.post('/change-password', (req, res) => {
    const { applicationId, currentPassword, newPassword } = req.body;

    // First, verify the current password
    const checkSql = 'SELECT * FROM users WHERE application_id = ? AND password = ?';
    db.query(checkSql, [applicationId, currentPassword], (checkErr, users) => {
        if (checkErr) return res.status(500).json({ success: false, message: 'Database error.' });

        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Your current password was incorrect.' });
        }

        // Current password is correct, update to the new one
        const updateSql = 'UPDATE users SET password = ? WHERE application_id = ?';
        db.query(updateSql, [newPassword, applicationId], (updateErr, result) => {
            if (updateErr) return res.status(500).json({ success: false, message: 'Failed to update password.' });
            res.json({ success: true, message: 'Password updated successfully.' });
        });
    });
});


// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});