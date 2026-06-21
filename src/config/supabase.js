const {createClient} = require('@supabase/supabase-js');
require('dotenv').config();

console.log('[SUPABASE CONFIG] Initializing Supabase client...');
console.log('[SUPABASE CONFIG] SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('[SUPABASE CONFIG] Using Service Role Key:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
);

module.exports = supabase;