// Create Super Admin User Script
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://pbuqzfrffquziystkvcy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseServiceKey) {
    console.error('SUPABASE_SERVICE_KEY is required');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function createSuperAdmin() {
    const email = 'mohammedzaheerhussain2002@gmail.com';
    const password = 'Zaheer9789#';
    const name = 'Zaheer Hussain';

    console.log('Creating super admin user...');

    // Step 1: Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
            name,
            role: 'super_admin'
        }
    });

    if (authError) {
        // Check if user already exists
        if (authError.message.includes('already been registered')) {
            console.log('User already exists. Updating profile role...');

            // Get existing user
            const { data: users } = await supabase.auth.admin.listUsers();
            const existingUser = users?.users?.find(u => u.email === email);

            if (existingUser) {
                // Update profile to super_admin
                const { error: updateError } = await supabase
                    .from('profiles')
                    .upsert({
                        id: existingUser.id,
                        email,
                        name,
                        role: 'super_admin',
                        is_active: true
                    }, { onConflict: 'id' });

                if (updateError) {
                    console.error('Error updating profile:', updateError);
                } else {
                    console.log('✅ Super admin role updated successfully!');
                    console.log(`   Email: ${email}`);
                    console.log(`   User ID: ${existingUser.id}`);
                }
            }
            return;
        }
        console.error('Error creating user:', authError);
        return;
    }

    console.log('Auth user created:', authData.user?.id);

    // Step 2: Create/update profile with super_admin role
    const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
            id: authData.user!.id,
            email,
            name,
            role: 'super_admin',
            is_active: true
        }, { onConflict: 'id' });

    if (profileError) {
        console.error('Error creating profile:', profileError);
        return;
    }

    console.log('✅ Super Admin created successfully!');
    console.log(`   Email: ${email}`);
    console.log(`   User ID: ${authData.user?.id}`);
    console.log(`   Role: super_admin`);
}

createSuperAdmin().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
