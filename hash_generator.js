const bcrypt = require('bcryptjs');

// --- NEW PASSWORD TO USE ---
const plainPassword = 'admin123'; 
// ---------------------------

const saltRounds = 10; 

bcrypt.hash(plainPassword, saltRounds, (err, hash) => {
    if (err) {
        console.error('Error generating hash:', err);
        return;
    }
    console.log('--- NEW ADMIN HASH FOR "admin123" ---');
    console.log(hash);
    console.log('------------------------------------');
});