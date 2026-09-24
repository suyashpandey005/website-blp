import { supabase } from '../lib/supabase'

export type CompanyRole = 'owner' | 'admin' | 'member'

export type AdminUser = {
  userId: string
  displayName: string
  role: CompanyRole
  createdAt: string
  email: string
}

export type AuditEntry = {
  id: string
  action: string
  entityType: string
  entityId: string
  actorUserId: string
  createdAt: string
  metadata: Record<string, unknown>
}

export const adminService = {
  async listUsers(): Promise<AdminUser[]> {
    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      throw new Error('You must be signed in.')
    }

    const currentUserId = sessionData.session.user.id

    const { data: membership, error: membershipError } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', currentUserId)
      .maybeSingle()

    if (membershipError) throw membershipError

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new Error('Administrator access required.')
    }

    const { data, error } = await supabase
      .from('company_members')
      .select('user_id, role, created_at')
      .eq('company_id', membership.company_id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map((item) => ({
      userId: item.user_id,
      displayName:
        item.user_id === currentUserId
          ? sessionData.session.user.email || 'Current User'
          : 'Company Member',
      role: item.role as CompanyRole,
      createdAt: item.created_at,
      email:
        item.user_id === currentUserId
          ? sessionData.session.user.email || ''
          : 'Protected by Supabase Auth',
    }))
  },

  async updateRole(userId: string, role: 'admin' | 'member') {
    const { error } = await supabase.rpc('set_company_user_role', {
      target_user: userId,
      target_role: role,
    })

    if (error) throw error
  },

  async listAuditLog(): Promise<AuditEntry[]> {
    const { data, error } = await supabase
      .from('audit_log')
      .select(
        'id, action, entity_type, entity_id, actor_user_id, created_at, metadata',
      )
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    return (data || []).map((entry) => ({
      id: entry.id,
      action: entry.action,
      entityType: entry.entity_type || '',
      entityId: entry.entity_id || '',
      actorUserId: entry.actor_user_id || '',
      createdAt: entry.created_at,
      metadata: entry.metadata || {},
    }))
  },

  async writeAudit(
    companyId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, unknown> = {},
  ) {
    const { data: session } = await supabase.auth.getSession()

    if (!session.session) return

    const { error } = await supabase.from('audit_log').insert({
      company_id: companyId,
      actor_user_id: session.session.user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    })

    if (error) throw error
  },
}
