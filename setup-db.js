const fs = require('fs');
const path = require('path');
const { exec } = require('./database/db');
const { seedDatabase } = require('./database/seed');

async function setup() {
  try {
    console.log('Running schema.sql...');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'database', 'schema.sql'), 'utf8');
    await exec(schemaSql);
    console.log('Schema created successfully.');
    
    console.log('Running seed data...');
    await seedDatabase();
    
    console.log('Setup complete!');
    process.exit(0);
  } catch (err) {
    console.error('Setup failed:', err);
    process.exit(1);
  }
}

setup();
