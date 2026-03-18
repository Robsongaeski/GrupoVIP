import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve('d:/16-Sistemas/GrupoVIP/.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    const { data, error } = await supabase.from('system_config').select('*').limit(1);
    if (error) {
      console.error('Error connecting to Supabase:', error.message);
      process.exit(1);
    }
    console.log('Successfully connected to Supabase!');
    console.log('Data sample:', data);
  } catch (err) {
    console.error('Unexpected error:', err.message);
    process.exit(1);
  }
}

testConnection();
