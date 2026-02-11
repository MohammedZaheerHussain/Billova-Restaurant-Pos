// Set Super Admin Role Script - Fixed for role constraint
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://pbuqzfrffquziystkvcy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is required');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function setSuperAdmin() {
    const userId = 'a6fc6522-3178-4fd3-b493-d01ff5781e37';
    const email = 'mohammedzaheerhussain2002@gmail.com';
    const name = 'Zaheer Hussain';

    console.log('Checking existing profile...');

    // First check if profile exists
    const { data: existing } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (existing) {
        console.log('Profile exists, updating role...');
        const { error } = await supabase
            .from('profiles')
            .update({ role: 'SUPER_ADMIN', name: name })
            .eq('id', userId);

        if (error) {
            console.log('Trying lowercase...');
            const { error: err2 } = await supabase
                .from('profiles')
                .update({ role: 'super_admin', name: name })
                .eq('id', userId);
            if (err2) console.error('Update error:', err2);
            else console.log('✅ Updated with lowercase role!');
        } else {
            console.log('✅ Updated with uppercase role!');
        }
    } else {
        console.log('Profile does not exist, inserting...');
        // Try uppercase SUPER_ADMIN first
        const { error } = await supabase
            .from('profiles')
            .insert({
                id: userId,
                email: email,
                name: name,
                role: 'SUPER_ADMIN',
                is_active: true
            });

        if (error) {
            console.log('Error with SUPER_ADMIN:', error.message);
            console.log('Trying with owner role instead...');

            const { error: err2 } = await supabase
                .from('profiles')
                .insert({
                    id: userId,
                    email: email,
                    name: name,
                    role: 'owner',
                    is_active: true
                });

            if (err2) {
                console.error('Insert error:', err2);
            } else {
                console.log('✅ Inserted with owner role!');
            }
        } else {
            console.log('✅ Inserted with SUPER_ADMIN role!');
        }
    }

    // Verify
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (profile) {
        console.log('\n📋 Profile Details:');
        console.log(`   ID: ${profile.id}`);
        console.log(`   Email: ${profile.email}`);
        console.log(`   Name: ${profile.name}`);
        console.log(`   Role: ${profile.role}`);
        console.log(`   Active: ${profile.is_active}`);
    }
}

setSuperAdmin().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
