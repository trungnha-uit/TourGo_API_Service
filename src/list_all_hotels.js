const supabase = require('./config/supabase');

async function run() {
    try {
        console.log("Fetching all hotels...");
        const { data: hotels, error } = await supabase.from('hotels').select('id, name, businesses_id');
        if (error) {
            console.error("Error fetching hotels:", error);
            return;
        }
        console.log(`Total hotels found: ${hotels.length}`);
        hotels.forEach((h, index) => {
            console.log(`[Hotel #${index + 1}] ID: ${h.id} | Name: ${h.name} | Business ID: ${h.businesses_id}`);
        });
    } catch (e) {
        console.error(e);
    }
}
run();
