import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: caller, error: callerError } = await adminClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (callerError || !caller.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const { data: membership } = await adminClient.from('company_members').select('company_id, role').eq('user_id', caller.user.id).in('role', ['owner', 'admin']).limit(1).maybeSingle()
    if (!membership) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const body = await request.json() as { email?: string; displayName?: string; role?: 'admin' | 'staff' }
    if (!body.email || !body.displayName || !body.role) return new Response(JSON.stringify({ error: 'Name, email, and role are required.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const { data: created, error: createError } = await adminClient.auth.admin.inviteUserByEmail(body.email)
    if (createError || !created.user) return new Response(JSON.stringify({ error: createError?.message || 'Could not create user.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const { error: membershipError } = await adminClient.from('company_members').insert({ company_id: membership.company_id, user_id: created.user.id, role: body.role === 'admin' ? 'admin' : 'member' })
    if (membershipError) return new Response(JSON.stringify({ error: 'User invited, but company membership creation failed.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const { error: profileError } = await adminClient.from('user_profiles').insert({ user_id: created.user.id, display_name: body.displayName, role: body.role })
    if (profileError) return new Response(JSON.stringify({ error: 'User invited, but profile creation failed.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    return new Response(JSON.stringify({ userId: created.user.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch { return new Response(JSON.stringify({ error: 'Unexpected server error.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
})
