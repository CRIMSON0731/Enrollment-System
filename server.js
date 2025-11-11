// --- Imports ---
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mysql = require('mysql2'); 
const nodemailer = require('nodemailer'); 

// --- CONFIG ---
const PORT = process.env.PORT || 3000;
const app = express();

// --- Nodemailer Transport Configuration ---
// NOTE: Using the generated App Password to resolve EAUTH error
const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
        user: 'dalonzohighschool@gmail.com', // Dedicated email account
        pass: 'ebvhftlefruimqru' // The 16-character App Password (Final Fix)
    }
});
// --- END Nodemailer Config ---


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

// Helper function to delete files safely (avoids server crash)
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

// --- Email Sender Function ---
async function sendCredentialsEmail(recipientEmail, studentName, username, password) {
    const mailOptions = {
        from: '"Doña Teodora Alonzo Highschool" <dalonzohighschool@gmail.com>',
        to: recipientEmail,
        subject: 'Enrollment Approved! Your Student Portal Credentials',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ccc; border-top: 5px solid #2b7a0b;">
                <h2>Congratulations, ${studentName}!</h2>
                <p>We are delighted to inform you that your enrollment application has been officially <b>APPROVED</b>.</p>
                <p>You can now access the Student Dashboard to view your status, announcements, and manage your account.</p>
                
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
        console.log(`Email sent successfully to ${recipientEmail}`);
        return { success: true };
    } catch (error) {
        console.error(`Failed to send email to ${recipientEmail}:`, error);
        return { success: false, error: error.message };
    }
}


// =========================================================================
//                             API ENDPOINTS
// =========================================================================

// --- 1. STUDENT: Application Submission ---
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

        const sql = `INSERT INTO applications 
                     (first_name, last_name, middle_name, birthdate, email, phone, grade_level, status, doc_card_path, doc_psa_path, doc_f137_path, doc_brgy_cert_path) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending Review', ?, ?, ?, ?)`;
        
        db.query(sql, [first_name, last_name, middle_name, birthdate, email, phone_num, grade_level, card_file, psa_file, f137_file, brgy_cert_file], (dbErr, result) => {
            if (dbErr) {
                console.error('DB Insert Error:', dbErr);
                cleanupFiles(fileNames); 
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

// --- 3. ADMIN: Update Application Status (INTEGRATED EMAIL SENDER) ---
app.post('/update-application-status', (req, res) => {
    const { applicationId, newStatus } = req.body;

    const updateStatus = (successMessage) => { 
        db.query('UPDATE applications SET status = ? WHERE id = ?', [newStatus, applicationId], (err) => {
            if (err) {
                console.error('DB Error updating status:', err);
                return res.status(500).json({ success: false, message: 'Failed to update application status.' });
            }
             if (newStatus === 'Approved') {
                db.query('SELECT username, password FROM users WHERE application_id = ?', [applicationId], (err, users) => {
                    if (err || users.length === 0) return res.json({ success: true, message: successMessage });
                    res.json({ 
                        success: true, 
                        message: successMessage,
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
        db.query('SELECT * FROM applications WHERE id = ?', [applicationId], async (err, apps) => { 
            if (err) return res.status(500).json({ success: false, message: 'Server error while fetching app data.' });
            if (apps.length === 0) return res.json({ success: false, message: 'Application not found.' });
            
            const app = apps[0];
            
            // --- USERNAME & PASSWORD LOGIC ---
            const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toLowerCase() : '';

            const firstNameInitials = getInitials(app.first_name);
            const middleNameInitials = getInitials(app.middle_name);
            const formattedLastName = (app.last_name || '').toLowerCase().replace(/ /g, '');
            
            const username = `${firstNameInitials}${middleNameInitials}${formattedLastName}@dtahs.edu.ph`;
            const password = 'password123'; 
            // --- END LOGIC ---

            // Insert user credentials
            db.query('INSERT INTO users (username, password, application_id) VALUES (?, ?, ?)',
                [username, password, applicationId], async (insertErr) => { 
                if (insertErr) {
                    console.error('User creation failed (likely duplicate):', insertErr);
                }
                
                // --- NEW: SEND EMAIL ---
                const emailResult = await sendCredentialsEmail(
                    app.email, 
                    app.first_name, 
                    username, 
                    password
                );
                
                let successMessage = `Application ${newStatus}.`;
                if (!emailResult.success) {
                    successMessage += ` WARNING: Failed to send credentials email (Check server console for details).`;
                }

                // Update status and send final response using the result message
                updateStatus(successMessage);
            });
        });
    } else {
        updateStatus(`Application status set to ${newStatus}.`);
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
            
            db.query('DELETE FROM applications WHERE id = ?', [applicationId], (appErr, result) => {
                if (appErr) return res.status(500).json({ success: false, message: 'Failed to delete application.' });
                
                // Delete files (using safe cleanup helper)
                const filesToDelete = [app.doc_card_path, app.doc_psa_path, app.doc_f137_path, app.doc_brgy_cert_path];
                cleanupFiles(filesToDelete);
                
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
            applicationData.username = user.username;
            applicationData.password = user.password; 

            res.json({ success: true, application: applicationData });
        });
    });
});

// --- 8. GET ANNOUNCEMENTS (for Dashboard) ---
app.get('/get-announcements', (req, res) => {
    const sql = 'SELECT id, title, content FROM announcements ORDER BY created_at DESC'; 
    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Failed to retrieve announcements.' });
        }
        res.json({ success: true, announcements: results });
    });
});

// --- 9. CHANGE PASSWORD (for Dashboard) ---
app.post('/change-password', (req, res) => {
    const { applicationId, currentPassword, newPassword } = req.body;

    const checkSql = 'SELECT * FROM users WHERE application_id = ? AND password = ?';
    db.query(checkSql, [applicationId, currentPassword], (checkErr, users) => {
        if (checkErr) return res.status(500).json({ success: false, message: 'Database error.' });

        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Your current password was incorrect.' });
        }

        const updateSql = 'UPDATE users SET password = ? WHERE application_id = ?';
        db.query(updateSql, [newPassword, applicationId], (updateErr, result) => {
            if (updateErr) return res.status(500).json({ success: false, message: 'Failed to update password.' });
            res.json({ success: true, message: 'Password updated successfully.' });
        });
    });
});

// --- 10. ADMIN CREATE ANNOUNCEMENT ---
app.post('/create-announcement', (req, res) => {
    const { title, content } = req.body;
    
    if (!title || !content) {
        return res.status(400).json({ success: false, message: 'Announcement title and content are required.' });
    }

    const sql = 'INSERT INTO announcements (title, content, created_at) VALUES (?, ?, NOW())';
    
    db.query(sql, [title, content], (err, result) => {
        if (err) {
            console.error('DB Error creating announcement:', err);
            return res.status(500).json({ success: false, message: 'Failed to save announcement to database.' });
        }
        res.json({ success: true, message: `Announcement "${title}" published successfully.` });
    });
});

// --- 11. ADMIN DELETE ANNOUNCEMENT (New Endpoint) ---
app.post('/delete-announcement', (req, res) => {
    const { announcementId } = req.body;
    
    if (!announcementId) {
        return res.status(400).json({ success: false, message: 'Announcement ID is required for deletion.' });
    }

    const sql = 'DELETE FROM announcements WHERE id = ?';
    
    db.query(sql, [announcementId], (err, result) => {
        if (err) {
            console.error('DB Error deleting announcement:', err);
            return res.status(500).json({ success: false, message: 'Failed to delete announcement from database.' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Announcement not found.' });
        }

        res.json({ success: true, message: 'Announcement deleted successfully.' });
    });
});


// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});