const { createClient } = require('@supabase/supabase-js');

// Use environment variables or hardcoded if necessary (but better use env)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const { data: groups, error: gError } = await supabase.from('groups').select('id, user_id, name, is_active').ilike('name', '%VIP Strass%');
    if (gError) throw gError;

    console.log('--- Groups matching VIP Strass ---');
    console.log(JSON.stringify(groups, null, 2));

    if (groups && groups.length > 0) {
      const userId = groups[0].user_id;
      console.log('\n--- User ID identified: ' + userId + ' ---');

      const { data: instances, error: iError } = await supabase.from('whatsapp_instances').select('id, user_id, name, nickname, status').eq('user_id', userId);
      if (iError) throw iError;

      console.log('\n--- Instances for this user ---');
      console.log(JSON.stringify(instances, null, 2));
      
      const { data: gi, error: giError } = await supabase.from('group_instances')
        .select(`
            group_id, 
            instance_id,
            groups (name),
            whatsapp_instances (name, status)
        `)
        .in('group_id', groups.map(g => g.id));
      if (giError) throw giError;

      console.log('\n--- Group Instances associations ---');
      console.log(JSON.stringify(gi, null, 2));
    } else {
        console.log("No groups found matching VIP Strass");
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
