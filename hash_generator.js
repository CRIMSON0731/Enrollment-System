const bcrypt = require('bcryptjs');

// --- SET YOUR DESIRED ADMIN PASSWORD HERE ---
const plainPassword = 'YourSecureAdminPassword'; 
// -------------------------------------------

const saltRounds = 10; // The standard number of rounds for security

bcrypt.hash(plainPassword, saltRounds, (err, hash) => {
    if (err) {
        console.error('Error generating hash:', err);
        return;
    }
    console.log('--- YOUR NEW ADMIN PASSWORD HASH ---');
    console.log(hash);
    console.log('------------------------------------');
});
