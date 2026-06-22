const supabase = require('./config/supabase');

async function run() {
    try {
        console.log("Inserting dummy user...");
        const userId = '11111111-1111-1111-1111-111111111111';
        
        // Check if user already exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('id', userId)
            .single();
            
        if (!existingUser) {
            const { error: userError } = await supabase
                .from('users')
                .insert({
                    id: userId,
                    name: 'Nguyễn Văn A',
                    email: 'traveler_test@example.com',
                    status: 'active',
                    location: 'Hồ Chí Minh'
                });
            if (userError) {
                console.error("Error inserting user:", userError);
                return;
            }
            console.log("User inserted successfully.");
        } else {
            console.log("User already exists.");
        }

        console.log("Inserting mock booking...");
        const hotelId = 'b853de89-9aa0-4aa2-a085-c85bc5f23f0a';
        
        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .insert({
                user_id: userId,
                hotel_id: hotelId,
                booking_date: '2026-06-28',
                check_in: '2026-06-28',
                check_out: '2026-06-29',
                status: 'PENDING',
                guests: 2
            })
            .select();
            
        if (bookingError) {
            console.error("Error inserting booking:", bookingError);
        } else {
            console.log("Mock booking inserted successfully:", booking);
        }

    } catch (e) {
        console.error(e);
    }
}
run();
