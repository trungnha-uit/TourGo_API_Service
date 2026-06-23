const supabase = require('./config/supabase');

async function run() {
    const columns = ['total_price', 'price', 'amount', 'total', 'guests'];
    for (const col of columns) {
        const { data, error } = await supabase.from('bookings').select(col).limit(1);
        if (error) {
            console.log(`Column '${col}': NOT present (Error: ${error.message})`);
        } else {
            console.log(`Column '${col}': PRESENT`);
        }
    }
}
run();
