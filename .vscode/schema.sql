-- --------------------------------------------------------
-- 1. APPLICATIONS TABLE (Student Enrollment Data)
-- --------------------------------------------------------
CREATE TABLE applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    middle_name VARCHAR(255),
    birthdate DATE,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    grade_level VARCHAR(10),
    status VARCHAR(50) DEFAULT 'Pending Review',
    doc_card_path TEXT,
    doc_psa_path TEXT,
    doc_f137_path TEXT,
    doc_brgy_cert_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- 2. USERS TABLE (Student Login Credentials)
-- --------------------------------------------------------
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    -- Links to the enrollment application record
    application_id INT UNIQUE NOT NULL, 
    username VARCHAR(255) UNIQUE NOT NULL,
    password TEXT NOT NULL, -- Stores the bcrypt hash
    
    -- Foreign Key Constraint
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

-- --------------------------------------------------------
-- 3. ADMINS TABLE (Administrator Login Credentials)
-- --------------------------------------------------------
CREATE TABLE admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL -- Stores the bcrypt hash
);

-- --------------------------------------------------------
-- 4. ANNOUNCEMENTS TABLE
-- --------------------------------------------------------
CREATE TABLE announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------
-- 5. INITIAL DATA INSERTION
-- --------------------------------------------------------

-- ** IMPORTANT: REPLACE 'YOUR_BCRYPT_HASH_HERE' with the actual hash for 'admin123' **
INSERT INTO admins (username, password_hash)
VALUES ('admin', 'YOUR_BCRYPT_HASH_HERE');

ALTER USER 'root'@'%' IDENTIFIED WITH mysql_native_password BY 'pJkMQTDHyOlXVluNlEMNJxqUMMkfPldo';
FLUSH PRIVILEGES;
