import { sql } from '@vercel/postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createDatabase() {
  try {
    console.log('🔄 Creating database schema...');
    
    // Read schema file
    const schemaPath = join(__dirname, '..', 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    
    // Execute schema
    const statements = schema
      .split(';')
      .filter(stmt => stmt.trim())
      .map(stmt => stmt.trim() + ';');
    
    for (const statement of statements) {
      if (statement.includes('CREATE')) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        await sql.query(statement);
      }
    }
    
    console.log('✅ Database schema created successfully!');
    
    // Verify tables
    const { rows } = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    console.log('\n📊 Created tables:');
    rows.forEach(row => console.log(`  - ${row.table_name}`));
    
  } catch (error) {
    console.error('❌ Error creating database:', error);
    process.exit(1);
  }
}

createDatabase();
