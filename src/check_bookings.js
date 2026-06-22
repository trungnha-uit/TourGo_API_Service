const supabase = require('./config/supabase');

async function run() {
    try {
        console.log("Checking all bookings in database...");
        const { data: bookings, error } = await supabase
            .from('bookings')
            .select('*, hotels(name, businesses_id), tours(name, businesses_id)');
            
        if (error) {
            console.error("Error fetching bookings:", error);
            return;
        }
        
        console.log(`Total bookings found: ${bookings.length}`);
        bookings.forEach((b, index) => {
            console.log(`[Booking #${index + 1}]`);
            console.log(`- ID: ${b.id}`);
            console.log(`- Status: ${b.status}`);
            console.log(`- Check-in: ${b.check_in}`);
            console.log(`- Check-out: ${b.check_out}`);
            console.log(`- Hotel: ${b.hotels ? b.hotels.name : "N/A"} (Business ID: ${b.hotels ? b.hotels.businesses_id : "N/A"})`);
            console.log(`- Tour: ${b.tours ? b.tours.name : "N/A"} (Business ID: ${b.tours ? b.tours.businesses_id : "N/A"})`);
        });

        // Let's also check who the active businesses are
        const { data: businesses } = await supabase.from('businesses').select('*');
        console.log("\nRegistered businesses:");
        console.log(businesses);

    } catch (e) {
        console.error(e);
    }
}
run();
