const bcrypt = require('bcryptjs');

// --- NEW PASSWORD TO USE ---
const plainPassword = 'admin123'; // Using 'admin123' as requested
// ---

const saltRounds = 10;

// 1. Use the synchronous version: bcrypt.hashSync
const hash = bcrypt.hashSync(plainPassword, saltRounds);

// 2. Print the result immediately
console.log('--- NEW ADMIN HASH FOR "admin123" ---');
console.log(hash);
console.log('------------------------------------');