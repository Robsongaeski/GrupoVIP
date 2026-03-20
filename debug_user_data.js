
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function debug(userId) {
  console.log(`Checking data for user: ${userId}`)
  
  const { data: instances, error: instError } = await supabase
    .from('whatsapp_instances')
    .select('id, name, nickname, status')
    .eq('user_id', userId)
  
  if (instError) console.error('Instances Error:', instError)
  else console.log('Instances:', instances)

  const { data: groups, error: groupError } = await supabase
    .from('groups')
    .select(`
      id, name, is_active,
      group_instances (
        instance_id,
        whatsapp_instances (id, name, status)
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true)

  if (groupError) console.error('Groups Error:', groupError)
  else {
    console.log('Groups found:', groups.length)
    groups.forEach(g => {
      console.log(`Group: ${g.name} (#${g.id})`)
      console.log(`  Instances:`, g.group_instances.map(gi => ({
        id: gi.instance_id,
        name: gi.whatsapp_instances?.name,
        status: gi.whatsapp_instances?.status
      })))
    })
  }
}

// Get the user ID from the CLI if provided
const targetUserId = process.argv[2]
if (targetUserId) {
    debug(targetUserId)
} else {
    console.log("Please provide a userId")
}
