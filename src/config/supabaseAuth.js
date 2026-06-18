const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

console.log('[SUPABASE AUTH CONFIG] Initializing Supabase Auth client...');

const supabaseAuth = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    }
);

module.exports = supabaseAuth;
