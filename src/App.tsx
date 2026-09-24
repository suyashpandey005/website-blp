import { useEffect, useMemo, useState } from 'react'
import './App.css'
import './module.css'
import './supabase.css'
import './admin.css'
import './admin-control.css'
import './admin-invite.css'
import { formatCurrency, formatDate, tripAmount, tripDieselCost, tripProfit } from './services/storageService'

import { supabase } from './lib/supabase'
import { signIn } from './services/authService'
import { loadCompanyData } from './services/repository'
import { customerRepository, driverRepository, expenseRepository, invoiceRepository, paymentRepository, tripRepository, vehicleRepository } from './services/repository'
import { PersistedRecordModal } from './components/PersistedRecordModal'
import { InvoiceWorkspace } from './components/InvoiceWorkspace'
import { CompanySettingsForm } from './components/CompanySettings'
import './components/settings.css'
import type { FormEvent } from 'react'
import type { DashboardData } from './services/repository'
import { adminService } from './services/adminService'
import type { AdminUser, AuditEntry } from './services/adminService'

type Page = 'Dashboard' | 'Trips' | 'Fleet' | 'Drivers' | 'Customers' | 'Invoices' | 'Payments' | 'Expenses' | 'Fuel' | 'Reports' | 'GST Reports' | 'Profit & Loss' | 'Daily Register' | 'Routes' | 'Maintenance' | 'Business Analytics' | 'Settings'
type Theme = 'light' | 'dark'
const groups: Array<[string, string[]]> = [['COMMAND CENTER', ['Dashboard', 'Daily Register', 'Routes']], ['OPERATIONS', ['Trips', 'Fleet', 'Drivers', 'Fuel', 'Maintenance']], ['BUSINESS', ['Customers', 'Invoices', 'Payments']], ['FINANCE', ['Expenses', 'GST Reports', 'Profit & Loss']], ['ANALYTICS', ['Reports', 'Business Analytics', 'Settings']]]
const icons: Record<string, string> = { Dashboard: '⌂', 'Daily Register': '▦', Routes: '⌁', Trips: '↗', Fleet: '▰', Drivers: '♙', Fuel: '◒', Maintenance: '⚒', Customers: '◎', Invoices: '▤', Payments: '₹', Expenses: '◌', 'GST Reports': '%', 'Profit & Loss': '∿', Reports: '▥', 'Business Analytics': '◩', Settings: '⚙' }
const money = (n: number) => formatCurrency(n)

function App() {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('blp-theme') as Theme) || 'light')
  const [data, setData] = useState<Awaited<ReturnType<typeof loadCompanyData>> | null>(null)
  const [authState, setAuthState] = useState<'loading' | 'signed-out' | 'ready' | 'setup-required' | 'denied' | 'password-recovery'>('loading')
  const [authError, setAuthError] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [userRole, setUserRole] = useState('staff')
  const [companyId, setCompanyId] = useState('')
  const [page, setPage] = useState<Page>('Dashboard')
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState<Page | null>(null)
  const [mobileNav, setMobileNav] = useState(false)

  useEffect(() => {
    document.body.classList.toggle('mobile-menu-open', mobileNav)

    return () => {
      document.body.classList.remove('mobile-menu-open')
    }
  }, [mobileNav])
  const [searchOpen, setSearchOpen] = useState(false)
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('blp-theme', theme) }, [theme])
  useEffect(() => {
    let mounted = true
    const bootstrap = async () => {
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) { setAuthState('setup-required'); return }
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        setAuthState('signed-out')
        return
      }

      setUserEmail(sessionData.session.user.email || '')

      if (window.location.pathname === '/change-password') {
        setAuthState('password-recovery')
        return
      }
      const { data: membership, error } = await supabase.from('company_members').select('company_id, role').eq('user_id', sessionData.session.user.id).limit(1).maybeSingle()
      if (error) {
  console.error('Company membership query failed:', error)
  setAuthError(`Company access error: ${error.message}`)
  setAuthState('setup-required')
  return
}
      if (!membership) { setAuthError('Your account is signed in, but it is not linked to a company yet. Run supabase/assign-company.sql with your email, then sign in again.'); setAuthState('setup-required'); return }
      setCompanyId(membership.company_id)
      if (window.location.pathname.startsWith('/admin') && !['owner', 'admin'].includes(membership.role)) { setAuthError('Your account does not have administrator access.'); setAuthState('denied'); return }
      setUserRole(membership.role)
      try {
        const companyData = await loadCompanyData(membership.company_id)
        if (mounted) {
          setData(companyData)
          setAuthState('ready')
        }
      } catch (error) {
  console.error('LOAD COMPANY DATA FAILED:', error)

  if (mounted) {
    setAuthError(
      error instanceof Error
        ? `Company data error: ${error.message}`
        : 'Could not load company data.'
    )
    setAuthState('setup-required')
  }
}
    }
    void bootstrap()
    const { data: authListener } = supabase.auth.onAuthStateChange(() => { void bootstrap() })
    return () => { mounted = false; authListener.subscription.unsubscribe() }
  }, [])
  useEffect(() => { const listener = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(true) }; if (event.key === 'Escape') setSearchOpen(false) }; window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener) }, [])
  const go = (next: string) => { setPage(next as Page); setMobileNav(false); setModal(null) }
  const filteredRows = useMemo(() => (data ? getRows(page, data) : []).filter((row) => Object.values(row).join(' ').toLowerCase().includes(query.toLowerCase())), [data, page, query])
  if (authState === 'loading') return <div className="setup-screen"><div><span className="brand-mark">BLP</span><h1>Connecting to BLP COMMAND</h1><p>Loading your company workspace from Supabase.</p></div></div>
  if (authState === 'signed-out') return <AuthScreen />
  if (authState === 'password-recovery') return <RecoveryPasswordScreen />
  if (authState === 'denied') return <div className="setup-screen"><div><span className="brand-mark">BLP</span><h1>Access denied</h1><p>{authError}</p><button className="button primary" onClick={() => { window.location.href = '/' }}>Return to command center</button></div></div>
  if (authState === 'setup-required' || !data) return (
    <div className="setup-screen">
      <div>
        <span className="brand-mark">BLP</span>
        <h1>Workspace connection problem</h1>
        <p>{authError || 'Could not load your company workspace.'}</p>
        <p className="setup-help">Check the browser console for the exact Supabase error. Do not change your API key unless the error says the credentials are invalid.</p>
      </div>
    </div>
  )
  const revenue = data.trips.reduce((sum, trip) => sum + tripAmount(trip), 0)
  const expenses = data.expenses.reduce((sum, expense) => sum + expense.amount, 0) + data.trips.reduce((sum, trip) => sum + tripDieselCost(trip) + trip.otherExpenses, 0)
  if (window.location.pathname.startsWith('/admin')) return <AdminControlCenter email={userEmail} role={userRole} data={data} />
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}><div className="brand"><div className="brand-mark">BLP</div><div><strong>COMMAND</strong><span>Fleet / Operations / Finance</span></div></div><div className="sidebar-status"><span className="status-dot" /> SYSTEMS NOMINAL <b>v1.0.0</b></div><nav>{groups.map(([title, items]) => <div className="nav-group" key={title}><p className="nav-label">{title}</p>{(items as string[]).map((item) => <button className={`nav-item ${page === item ? 'active' : ''}`} key={item} onClick={() => { go(item); setMobileNav(false) }}><span className="nav-icon">{icons[item]}</span><span>{item}</span>{page === item && <i />}</button>)}</div>)}</nav><div className="sidebar-footer"><span>BLP CONSTRUCTION</span><span>Bilaspur, CG / IN</span></div></aside>

{mobileNav && (
  <button
    type="button"
    className="mobile-nav-overlay"
    aria-label="Close navigation"
    onClick={() => setMobileNav(false)}
  />
)}
    <main className="main-area"><header className="topbar"><button className="icon-button menu-button" onClick={() => setMobileNav(!mobileNav)}>☰</button><div className="breadcrumbs"><span>BLP COMMAND</span><b>/</b><strong>{page}</strong></div><div className="topbar-actions"><button className="search-trigger" onClick={() => setSearchOpen(true)}><span>⌕</span> Search anything <kbd>⌘ K</kbd></button><button className="icon-button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? '☾' : '☀'}</button><button className="notification">♢{data.invoices.filter((invoice) => invoice.status === 'Overdue').length > 0 && <i>{data.invoices.filter((invoice) => invoice.status === 'Overdue').length}</i>}</button><div className="user-chip"><span>SP</span><div><b>{data.company.ownerName || userEmail}</b><small>{userEmail}</small></div></div></div></header>
      <div className="content"><div className="page-heading"><div><div className="eyebrow">{new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date()).toUpperCase()} <span className="live"><i /> LIVE OPERATIONS</span></div><h1>{page === 'Dashboard' ? 'Command Center' : page}</h1><p>{page === 'Dashboard' ? `${data.company.ownerName || data.company.name} — here is your business at a glance.` : `Manage your ${page.toLowerCase()} records.`}</p></div><div className="heading-actions"><button className="button secondary" onClick={() => exportCsv(page, filteredRows)}>Export CSV ↓</button><button className="button primary" onClick={() => setModal(page === 'Dashboard' ? 'Trips' : page)}>＋ Add {page === 'Dashboard' ? 'trip' : page.replace(/s$/, '').toLowerCase()}</button></div></div>
        {page === 'Dashboard' ? <Dashboard data={data} revenue={revenue} expenses={expenses} companyId={companyId} onDeleted={async () => setData(await loadCompanyData(companyId))} /> : page === 'Invoices' ? <InvoiceWorkspace data={data} /> : page === 'Settings' ? <CompanySettingsForm company={data.company} onSaved={(company) => setData({ ...data, company })} /> : <Module page={page} rows={filteredRows} query={query} setQuery={setQuery} companyId={companyId} onDeleted={async () => setData(await loadCompanyData(companyId))} />}
      </div></main>
    {modal && <PersistedRecordModal kind={modal} companyId={companyId} data={data} onSaved={async () => { setData(await loadCompanyData(companyId)); setModal(null) }} close={() => setModal(null)} />}
    {searchOpen && <div className="modal-backdrop" onClick={() => setSearchOpen(false)}><div className="command-modal" onClick={(event) => event.stopPropagation()}><div className="command-input"><span>⌕</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search trips, vehicles, customers..." /><kbd>ESC</kbd></div><p>QUICK ACTIONS</p>{['Trips', 'Fleet', 'Customers', 'Invoices', 'Payments', 'Expenses', 'Reports'].map((item) => <button key={item} onClick={() => { setSearchOpen(false); go(item) }}>＋ <span>{item}</span><kbd>↵</kbd></button>)}</div></div>}
  </div>
}

function RecoveryPasswordScreen() {
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const valid = next.length >= 8 && /[A-Z]/.test(next) && /[a-z]/.test(next) && /\d/.test(next)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    if (!valid || next !== confirm) {
      setMessage('Use 8+ characters with uppercase, lowercase and a number; passwords must match.')
      return
    }
    const { error } = await supabase.auth.updateUser({ password: next })
    if (error) {
      setMessage(error.message)
      return
    }
    window.history.replaceState({}, '', '/')
    window.location.href = '/'
  }

  return <div className="auth-screen"><div className="auth-panel">
    <span className="brand-mark">BLP</span>
    <span className="section-kicker">ACCOUNT RECOVERY</span>
    <h1>Set a new password</h1>
    <p>Choose a new password for your BLP COMMAND account.</p>
    <form onSubmit={submit} className="password-form">
      <label>New password<input type="password" required value={next} onChange={(event) => setNext(event.target.value)} /></label>
      <label>Confirm new password<input type="password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label>
      <small>Minimum 8 characters, one uppercase, one lowercase, and one number.</small>
      {message && <div className="auth-error">{message}</div>}
      <button className="button primary" type="submit">Update password</button>
    </form>
  </div></div>
}

function AuthScreen() { const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [resetSent, setResetSent] = useState(false); const submit = async (event: FormEvent) => { event.preventDefault(); setError(''); try {
      await signIn(email, password)
    } catch (error) {
      console.error('Login failed:', error)
      setError(
        error instanceof Error
          ? error.message
          : 'Unable to sign in with those credentials.'
      )
    } }; const reset = async () => { setError(''); setResetSent(false); if (!email) { setError('Enter your email address first.'); return }; const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/change-password` }); if (resetError) setError(resetError.message); else setResetSent(true) }; return <div className="auth-screen"><div className="auth-panel"><span className="brand-mark">BLP</span><span className="section-kicker">FLEET / OPERATIONS / FINANCE</span><h1>Command center access</h1><p>Sign in to your company workspace.</p><form onSubmit={submit}><label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>{error && <div className="auth-error">{error}</div>}{resetSent && <div className="auth-success">Password reset email sent.</div>}<button className="button primary" type="submit">Sign in to BLP COMMAND</button><button className="text-button" type="button" onClick={() => void reset}>Forgot password?</button></form></div></div> }

function AdminControlCenter({ email, role, data }: { email: string; role: string; data: DashboardData }) { const [route, setRoute] = useState(window.location.pathname); const section = route.split('/')[2] || 'overview'; const [users, setUsers] = useState<AdminUser[]>([]); const [activity, setActivity] = useState<AuditEntry[]>([]); const [error, setError] = useState(''); useEffect(() => { void Promise.all([adminService.listUsers(), adminService.listAuditLog()]).then(([nextUsers, nextActivity]) => { setUsers(nextUsers); setActivity(nextActivity) }).catch(() => setError('Could not load administration data.')) }, []); const navigate = (target: string) => { window.history.pushState({}, '', target); setRoute(target) }; const signOut = async () => { await supabase.auth.signOut(); window.location.href = '/login' }; return <div className="admin-shell"><aside className="admin-sidebar"><div className="brand"><div className="brand-mark">BLP</div><div><strong>COMMAND</strong><span>Administration</span></div></div><nav><p>CONTROL CENTER</p>{[['overview', 'Overview'], ['users', 'Users'], ['business', 'Business Data'], ['security', 'Security'], ['activity', 'Activity Log'], ['data', 'Data Management'], ['company', 'Company Settings']].map(([key, label]) => <button className={section === key ? 'active' : ''} key={key} onClick={() => navigate(`/admin/${key}`)}>{label}</button>)}</nav><nav className="admin-account-nav"><p>MY ACCOUNT</p><button className={section === 'profile' ? 'active' : ''} onClick={() => navigate('/admin/profile')}>Profile</button><button onClick={() => navigate('/admin/change-password')}>Change Password</button><button onClick={() => void signOut}>Sign Out</button></nav></aside><main className="admin-main"><header className="admin-topbar"><div><span className="section-kicker">BLP COMMAND / ADMINISTRATION</span><strong>{section.replace('-', ' ')}</strong></div><div className="admin-identity"><span>SP</span><div><b>Swapnil Pandey</b><small>Administrator · {email}</small></div></div></header><div className="admin-content"><div className="admin-title"><div><span className="section-kicker">SECURITY / OPERATIONS</span><h1>Admin Control Center</h1><p>Manage users, security, business data and system activity.</p></div>{error && <span className="auth-error">{error}</span>}</div>{section === 'users' ? <AdminUsersV2 users={users} setUsers={setUsers} /> : section === 'activity' ? <AdminActivity activity={activity} /> : section === 'security' || section === 'change-password' ? <ChangePassword email={email} close={() => navigate('/admin/security')} /> : section === 'profile' ? <AdminProfile email={email} role={role} /> : section === 'company' ? <AdminCompanySettings data={data} navigate={navigate} /> : section === 'business' || section === 'data' ? <AdminBusiness data={data} /> : <AdminOverview data={data} users={users} navigate={navigate} />}</div></main></div> }

function AdminOverview({ data, users, navigate }: { data: DashboardData; users: AdminUser[]; navigate: (path: string) => void }) {
  const cards = [
    ['USERS', users.length, '/admin/users'],
    ['ADMINS', users.filter((user) => user.role === 'admin').length, '/admin/users'],
    ['MEMBERS', users.filter((user) => user.role === 'member').length, '/admin/users'],
    ['CUSTOMERS', data.customers.length, '/admin/business'],
    ['VEHICLES', data.vehicles.length, '/admin/business'],
    ['TRIPS', data.trips.length, '/admin/business'],
    ['INVOICES', data.invoices.length, '/admin/business'],
    ['PAYMENTS', data.payments.length, '/admin/business'],
  ]

  return (
    <>
      <div className="admin-kpi-grid">
        {cards.map(([label, value, path]) => (
          <button className="admin-kpi" key={String(label)} onClick={() => navigate(String(path))}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>Open records →</small>
          </button>
        ))}
      </div>

      <div className="admin-overview-grid">
        <section className="admin-section">
          <SectionHead title="Business data" action="View all" onClick={() => navigate('/admin/business')} />
          {[
            ['Customers', data.customers.length],
            ['Vehicles', data.vehicles.length],
            ['Drivers', data.drivers.length],
            ['Trips', data.trips.length],
            ['Invoices', data.invoices.length],
            ['Payments', data.payments.length],
            ['Expenses', data.expenses.length],
          ].map(([label, value]) => (
            <div className="admin-data-row" key={String(label)}>
              <span>{label}</span>
              <b>{value}</b>
              <button onClick={() => navigate('/admin/business')}>Manage →</button>
            </div>
          ))}
        </section>

        <section className="admin-section">
          <SectionHead title="Security status" action="Open security" onClick={() => navigate('/admin/security')} />

          <div className="security-row">
            <i>●</i>
            <span>Supabase Authentication</span>
            <b>Connected</b>
          </div>

          <div className="security-row">
            <i>●</i>
            <span>Role-based access</span>
            <b>Active</b>
          </div>

          <div className="security-row">
            <i>●</i>
            <span>Row Level Security</span>
            <b>Enabled</b>
          </div>

          <div className="security-row">
            <i>●</i>
            <span>Owner protection</span>
            <b>Enabled</b>
          </div>
        </section>
      </div>
    </>
  )
}

function AdminBusiness({ data }: { data: DashboardData }) { return <section className="admin-section"><SectionHead title="Business data" action="Export CSV" onClick={() => exportCsv('business-data', [...data.customers, ...data.vehicles, ...data.trips])} />{[['Customers', data.customers.length], ['Vehicles', data.vehicles.length], ['Drivers', data.drivers.length], ['Trips', data.trips.length], ['Invoices', data.invoices.length], ['Payments', data.payments.length], ['Expenses', data.expenses.length]].map(([label, value]) => <div className="admin-data-row" key={String(label)}><span>{label}</span><b>{value}</b><small>Records from Supabase</small></div>)}</section> }

export function AdminUsers({
  users,
  setUsers,
}: {
  users: AdminUser[]
  setUsers: (users: AdminUser[]) => void
}) {
  const [savingUser, setSavingUser] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const changeRole = async (user: AdminUser, nextRole: 'admin' | 'member') => {
    setMessage('')
    setError('')

    if (user.role === 'owner') {
      setError('The company owner role is protected.')
      return
    }

    if (user.role === nextRole) {
      return
    }

    const roleLabel = nextRole === 'admin' ? 'ADMIN' : 'MEMBER'

    if (
      !confirm(
        `Change ${user.displayName || user.email} to ${roleLabel}?`
      )
    ) {
      return
    }

    setSavingUser(user.userId)

    try {
      await adminService.updateRole(user.userId, nextRole)

      setUsers(
        users.map((item) =>
          item.userId === user.userId
            ? { ...item, role: nextRole }
            : item
        )
      )

      setMessage(
        `${user.displayName || user.email} is now ${roleLabel}.`
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not update the user role.'
      )
    } finally {
      setSavingUser(null)
    }
  }

  const ownerCount = users.filter((user) => user.role === 'owner').length
  const adminCount = users.filter((user) => user.role === 'admin').length
  const memberCount = users.filter((user) => user.role === 'member').length

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <h2>Users & Roles</h2>
          <p style={{ margin: '5px 0 0', color: 'var(--muted)', fontSize: '11px' }}>
            Manage access to BLP Construction.
          </p>
        </div>
      </div>

      <div className="admin-kpi-grid" style={{ marginTop: '18px' }}>
        <div className="admin-kpi">
          <span>TOTAL USERS</span>
          <strong>{users.length}</strong>
          <small>Company members</small>
        </div>

        <div className="admin-kpi">
          <span>OWNER</span>
          <strong>{ownerCount}</strong>
          <small>Protected account</small>
        </div>

        <div className="admin-kpi">
          <span>ADMINS</span>
          <strong>{adminCount}</strong>
          <small>Administrative access</small>
        </div>

        <div className="admin-kpi">
          <span>MEMBERS</span>
          <strong>{memberCount}</strong>
          <small>Standard access</small>
        </div>
      </div>

      {message && (
        <div className="auth-success" style={{ marginBottom: '15px' }}>
          {message}
        </div>
      )}

      {error && (
        <div className="auth-error" style={{ marginBottom: '15px' }}>
          {error}
        </div>
      )}

      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Created</th>
              <th>Access Control</th>
            </tr>
          </thead>

          <tbody>
            {users.length ? (
              users.map((user) => (
                <tr key={user.userId}>
                  <td>
                    <strong>
                      {user.displayName || 'Unnamed user'}
                    </strong>
                  </td>

                  <td>{user.email}</td>

                  <td>
                    <span className={`admin-role admin-role-${user.role}`}>
                      {user.role === 'owner'
                        ? 'OWNER'
                        : user.role === 'admin'
                          ? 'ADMIN'
                          : 'MEMBER'}
                    </span>
                  </td>

                  <td>
                    {formatDate(user.createdAt.slice(0, 10))}
                  </td>

                  <td>
                    {user.role === 'owner' ? (
                      <span style={{ color: 'var(--muted)', fontSize: '10px' }}>
                        🔒 Protected
                      </span>
                    ) : (
                      <select
                        value={user.role}
                        disabled={savingUser === user.userId}
                        onChange={(event) =>
                          void changeRole(
                            user,
                            event.target.value as 'admin' | 'member'
                          )
                        }
                        style={{
                          padding: '7px 9px',
                          border: '1px solid var(--line)',
                          background: 'var(--panel)',
                          color: 'var(--ink)',
                          fontSize: '10px',
                          fontFamily: 'var(--mono)',
                        }}
                      >
                        <option value="member">MEMBER</option>
                        <option value="admin">ADMIN</option>
                      </select>
                    )}

                    {savingUser === user.userId && (
                      <span
                        style={{
                          marginLeft: '8px',
                          color: 'var(--muted)',
                          fontSize: '9px',
                        }}
                      >
                        Saving...
                      </span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>
                  No company users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function AdminUsersV2({ users, setUsers }: { users: AdminUser[]; setUsers: (users: AdminUser[]) => void }) {
  return (
    <AdminUsers
      users={users}
      setUsers={setUsers}
    />
  )
}

function AdminActivity({ activity }: { activity: AuditEntry[] }) {
  const [entries, setEntries] = useState(activity)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refresh = async () => {
    setLoading(true)
    setError('')

    try {
      const nextActivity = await adminService.listAuditLog()
      setEntries(nextActivity)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load the audit log.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <h2>Audit Log</h2>
          <p
            style={{
              margin: '5px 0 0',
              color: 'var(--muted)',
              fontSize: '11px',
            }}
          >
            Recent administrative activity for BLP Construction.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="auth-error" style={{ marginBottom: '15px' }}>
          {error}
        </div>
      )}

      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Module</th>
              <th>Record</th>
            </tr>
          </thead>

          <tbody>
            {entries.length ? (
              entries.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    {new Date(entry.createdAt).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </td>

                  <td>
                    <span
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: '9px',
                      }}
                    >
                      {entry.actorUserId
                        ? `${entry.actorUserId.slice(0, 8)}...`
                        : 'System'}
                    </span>
                  </td>

                  <td>
                    <span className="admin-role">
                      {entry.action || '—'}
                    </span>
                  </td>

                  <td>{entry.entityType || 'System'}</td>

                  <td>
                    {entry.entityId
                      ? `${entry.entityId.slice(0, 12)}...`
                      : '—'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>
                  No activity has been recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: '14px',
          paddingTop: '12px',
          borderTop: '1px solid var(--line)',
          color: 'var(--muted)',
          fontSize: '9px',
        }}
      >
        Showing the latest {entries.length} recorded event
        {entries.length === 1 ? '' : 's'}.
      </div>
    </section>
  )
}


function AdminCompanySettings({
  data,
  navigate,
}: {
  data: DashboardData
  navigate: (path: string) => void
}) {
  const company = data.company

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span className="section-kicker">COMPANY CONTROL</span>
          <h2>Company Settings</h2>
          <p>View the company information currently connected to BLP Command.</p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/settings')}
        >
          Open full settings →
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '14px',
          marginTop: '20px',
        }}
      >
        <div className="admin-section">
          <span className="section-kicker">COMPANY</span>

          <h3>{company.name || 'BLP Construction'}</h3>

          <div className="admin-data-row">
            <span>Owner</span>
            <b>{company.ownerName || 'Swapnil Pandey'}</b>
          </div>

          <div className="admin-data-row">
            <span>Phone</span>
            <b>{company.phone || '—'}</b>
          </div>

          <div className="admin-data-row">
            <span>Email</span>
            <b>{company.email || '—'}</b>
          </div>

          <div className="admin-data-row">
            <span>Address</span>
            <b>{company.address || '—'}</b>
          </div>
        </div>

        <div className="admin-section">
          <span className="section-kicker">BILLING ACCOUNT</span>

          <div className="admin-data-row">
            <span>Account Holder</span>
            <b>{company.bankAccountHolder || '—'}</b>
          </div>

          <div className="admin-data-row">
            <span>Account Number</span>
            <b>
              {company.bankAccountNumber
                ? `•••• •••• ${company.bankAccountNumber.slice(-4)}`
                : '—'}
            </b>
          </div>

          <div className="admin-data-row">
            <span>IFSC</span>
            <b>{company.bankIfsc || '—'}</b>
          </div>

          <div className="admin-data-row">
            <span>UPI ID</span>
            <b>{company.upiId || '—'}</b>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: '16px',
          padding: '15px',
          border: '1px solid var(--line)',
          background: 'var(--paper)',
        }}
      >
        <span className="section-kicker">INVOICE CONFIGURATION</span>

        <div className="admin-data-row">
          <span>Payment Terms</span>
          <b>{company.paymentTerms || '—'}</b>
        </div>

        <div className="admin-data-row">
          <span>Website</span>
          <b>{company.website || '—'}</b>
        </div>
      </div>

      <div
        style={{
          marginTop: '16px',
          padding: '14px',
          border: '1px solid var(--line)',
          background: 'var(--paper)',
        }}
      >
        <strong>Editing company information</strong>
        <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '12px' }}>
          Company and billing details are stored in Supabase. Use the full
          Settings page to edit these values.
        </p>
      </div>
    </section>
  )
}

function AdminProfile({ email, role }: { email: string; role: string }) { return <section className="admin-section profile-section"><span className="section-kicker">MY PROFILE</span><h2>Swapnil Pandey</h2><p>{email}</p><strong>{role === 'admin' ? 'Administrator' : role}</strong></section> }
function SectionHead({ title, action, onClick }: { title: string; action: string; onClick: () => void }) { return <div className="admin-section-head"><h2>{title}</h2><button onClick={onClick}>{action} →</button></div> }

export function AdminScreen({ email, role, data }: { email: string; role: string; data: DashboardData }) { const [passwordOpen, setPasswordOpen] = useState(false); const logout = async () => { await supabase.auth.signOut(); window.location.href = '/' }; return <div className="admin-screen"><div className="admin-header"><div><span className="section-kicker">SECURITY / ADMINISTRATION</span><h1>Admin Control Center</h1><p>Manage users, security and business operations</p></div><div className="admin-actions"><button className="button secondary" onClick={() => setPasswordOpen(true)}>Change password</button><button className="button primary" onClick={() => void logout}>Sign out</button></div></div><div className="admin-grid"><section className="panel admin-card"><span className="section-kicker">ADMINISTRATOR</span><h2>Swapnil Pandey</h2><p>{email}</p><strong>{role === 'admin' ? 'Administrator' : role}</strong></section><section className="panel admin-card"><span className="section-kicker">DATABASE CONNECTION</span><h2 className="connection-ok">● Connected</h2><p>Supabase PostgreSQL · RLS enabled</p><small>Authenticated queries are company-scoped.</small></section><section className="panel admin-card admin-stats"><span className="section-kicker">BUSINESS DATA</span><div><b>{data.customers.length}<small>Customers</small></b><b>{data.vehicles.length}<small>Vehicles</small></b><b>{data.trips.length}<small>Trips</small></b><b>{data.invoices.length}<small>Invoices</small></b><b>{data.payments.length}<small>Payments</small></b><b>{data.expenses.length}<small>Expenses</small></b></div></section><section className="panel admin-card"><span className="section-kicker">QUICK ACTIONS</span><div className="admin-quick-actions"><button>Add customer</button><button>Add vehicle</button><button>Create trip</button><button>Create invoice</button><button>Record payment</button></div></section></div>{passwordOpen && <ChangePassword email={email} close={() => setPasswordOpen(false)} />}</div> }

function ChangePassword({
  email,
  close,
}: {
  email: string
  close: () => void
}) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')

  const valid =
    next.length >= 8 &&
    /[A-Z]/.test(next) &&
    /[a-z]/.test(next) &&
    /\d/.test(next)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')

    if (!valid || next !== confirm) {
      setMessage(
        'Use 8+ characters with upper, lower, and number; passwords must match.'
      )
      return
    }

    const { error: verifyError } =
      await supabase.auth.signInWithPassword({
        email,
        password: current,
      })

    if (verifyError) {
      setMessage('Current password is incorrect.')
      return
    }

    const { error } = await supabase.auth.updateUser({
      password: next,
    })

    if (error) {
      setMessage('Password update failed.')
      return
    }

    setMessage('Password updated successfully.')
    setTimeout(() => close(), 900)
  }

  return (
    <div className="modal-backdrop">
      <div
        className="form-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="form-heading">
          <div>
            <span className="section-kicker">ACCOUNT SECURITY</span>
            <h2>Change password</h2>
          </div>

          <button
            type="button"
            className="icon-button"
            aria-label="Close change password"
            onClick={close}
          >
            ×
          </button>
        </div>

        <form onSubmit={submit} className="password-form">
          <label>
            Current password
            <input
              type="password"
              required
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
            />
          </label>

          <label>
            New password
            <input
              type="password"
              required
              value={next}
              onChange={(event) => setNext(event.target.value)}
            />
          </label>

          <small>
            Minimum 8 characters, one uppercase, one lowercase, and one number.
          </small>

          <label>
            Confirm new password
            <input
              type="password"
              required
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </label>

          {message && <div className="auth-error">{message}</div>}

          <button className="button primary" type="submit">
            Update password
          </button>
        </form>
      </div>
    </div>
  )
}

function Dashboard({ data, revenue, expenses, companyId, onDeleted }: { data: NonNullable<Awaited<ReturnType<typeof loadCompanyData>>>; revenue: number; expenses: number; companyId: string; onDeleted: () => Promise<void> }) {
  const overdue = data.invoices.filter((invoice) => invoice.status === 'Overdue')
  const today = new Date().toISOString().slice(0, 10)
  const todayTrips = data.trips.filter((trip) => trip.date === today)
  const activeVehicles = data.vehicles.filter((vehicle) => vehicle.status === 'Active').length
  const utilization = data.vehicles.length ? Math.round((activeVehicles / data.vehicles.length) * 100) : 0

  return <>
    <section className="hero-strip">
      <div>
        <span className="section-kicker">DAILY BRIEFING / LIVE</span>
        <h2>Keep the wheels turning.</h2>
        <p>{data.vehicles.length} vehicles registered, {data.invoices.length} invoices tracked, fleet utilization is <strong>{utilization}%</strong>.</p>
      </div>
      <div className="hero-route">
        <span>BLP</span>
        <div className="route-line"><i /><b /><i /></div>
        <span>LIVE</span>
      </div>
    </section>
    <section className="stats-grid">
      <StatCard label="Total trip revenue" value={money(revenue)} icon="↗" />
      <StatCard label="Net profit" value={money(revenue - expenses)} icon="∿" />
      <StatCard label="Outstanding" value={money(data.invoices.reduce((sum, invoice) => sum + invoice.total - invoice.paid, 0))} icon="◌" negative />
      <StatCard label="Trips today" value={`${todayTrips.length}`} icon="▰" />
    </section>
    <div className="dashboard-grid">
      <section className="panel revenue-panel">
        <Heading title="Revenue performance" meta="LIVE FROM SUPABASE" />
        {revenue || expenses ? <RevenueChart trips={data.trips} expenses={data.expenses} /> : <div className="empty-state"><strong>NO FINANCIAL DATA</strong><p>Create trip or expense records to begin tracking performance.</p></div>}
      </section>
      <section className="panel operations-panel">
        <Heading title="Today's operations" meta={new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date()).toUpperCase()} />
        <div className="operation-list">
          <Operation label="Trips today" value={`${todayTrips.length}`} detail="live trip records" icon="↗" />
          <Operation label="Fleet utilization" value={`${utilization}%`} detail={`${activeVehicles} active vehicles`} icon="▰" />
          <Operation label="Diesel consumed" value={`${todayTrips.reduce((sum, trip) => sum + trip.diesel, 0)} L`} detail="from today's trips" icon="◒" />
          <Operation label="Revenue today" value={money(todayTrips.reduce((sum, trip) => sum + tripAmount(trip), 0))} detail="from today's trips" icon="₹" />
        </div>
      </section>
      <section className="panel trips-panel"><Heading title="Live trip register" meta={`${data.trips.length} RECORDS`} /><Table page="Trips" rows={data.trips} companyId={companyId} onDeleted={onDeleted} /></section>
      <section className="panel alerts-panel"><Heading title="Needs attention" meta={`${overdue.length} ITEMS`} />{overdue.length ? overdue.map((invoice) => <Alert key={invoice.id} icon="!" title="Invoice overdue" detail={invoice.id} />) : <div className="empty-state"><strong>ALL CLEAR</strong><p>No overdue invoices for this workspace.</p></div>}</section>
    </div>
  </>
}

function StatCard({ label, value, icon, negative = false }: { label: string; value: string; icon: string; negative?: boolean }) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><i>{icon}</i></div><strong>{value}</strong><div className={`trend ${negative ? 'negative' : ''}`}><span>Live from Supabase</span></div></div>
}
function Heading({ title, meta }: { title: string; meta: string }) { return <div className="panel-heading"><div><h2>{title}</h2><span>{meta}</span></div></div> }

function RevenueChart({ trips, expenses }: { trips: DashboardData['trips']; expenses: DashboardData['expenses'] }) {
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date()
    date.setDate(1)
    date.setMonth(date.getMonth() - (5 - index))
    return { key: `${date.getFullYear()}-${date.getMonth()}`, label: date.toLocaleString('en-IN', { month: 'short' }).toUpperCase(), year: date.getFullYear(), month: date.getMonth(), revenue: 0, expenses: 0 }
  })
  for (const trip of trips) {
    const date = new Date(`${trip.date}T00:00:00`)
    const bucket = months.find((item) => item.year === date.getFullYear() && item.month === date.getMonth())
    if (bucket) bucket.revenue += tripAmount(trip)
  }
  for (const expense of expenses) {
    const date = new Date(`${expense.date}T00:00:00`)
    const bucket = months.find((item) => item.year === date.getFullYear() && item.month === date.getMonth())
    if (bucket) bucket.expenses += expense.amount
  }
  const max = Math.max(...months.flatMap((item) => [item.revenue, item.expenses]), 1)
  return <div className="live-chart"><div className="chart-legend"><span>Revenue</span><span>Expenses</span><b>{money(months.reduce((sum, item) => sum + item.revenue, 0))}</b></div><div className="live-bars">{months.map((item) => <div className="live-bar-group" key={item.key}><div className="live-bar revenue-bar" style={{ height: `${Math.max(4, item.revenue / max * 150)}px` }} title={`Revenue ${money(item.revenue)}`} /><div className="live-bar expense-bar" style={{ height: `${Math.max(4, item.expenses / max * 150)}px` }} title={`Expenses ${money(item.expenses)}`} /><span>{item.label}</span></div>)}</div></div>
}

function Operation({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: string }) { return <div className="operation"><i>{icon}</i><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div> }
function Alert({ icon, title, detail }: { icon: string; title: string; detail: string }) { return <div className="alert-item"><i>{icon}</i><div><strong>{title}</strong><span>{detail}</span></div><b>→</b></div> }

function Module({ page, rows, query, setQuery, companyId, onDeleted }: { page: Page; rows: Array<Record<string, unknown>>; query: string; setQuery: (value: string) => void; companyId: string; onDeleted: () => Promise<void> }) { return <section className="module-panel panel"><div className="module-toolbar"><div><span className="section-kicker">OPERATING RECORDS / {page.toUpperCase()}</span><h2>{page} register</h2><p>{rows.length} records loaded from Supabase.</p></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${page.toLowerCase()}...`} /></div><Table page={page} rows={rows} companyId={companyId} onDeleted={onDeleted} /></section> }
const columnLabels: Record<string, string> = {
  date: 'Date',
  route: 'Route',
  vehicle: 'Vehicle',
  driver: 'Driver',
  customer: 'Customer',
  status: 'Status',
  loadingPoint: 'Loading point',
  unloadingPoint: 'Unloading point',
  name: 'Name',
  phone: 'Phone',
  gstin: 'GSTIN',
  billing: 'Billing',
  paid: 'Paid',
  invoice: 'Invoice',
  amount: 'Amount',
  method: 'Payment method',
  reference: 'Reference',
  category: 'Category',
  description: 'Description',
  registration: 'Registration',
  type: 'Vehicle type',
  licenseNumber: 'License number',
  licenseExpiry: 'License expiry',
  taxable: 'Taxable',
  gstRate: 'GST rate',
  total: 'Total',
  metric: 'Metric',
  value: 'Value',
  records: 'Records',
}

function displayKey(key: string) {
  return columnLabels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())
}

function formatCell(key: string, value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number' && ['amount', 'total', 'paid', 'billing', 'revenue', 'taxable', 'value'].some((part) => key.includes(part))) return money(value)
  if (key === 'gstRate') return `${value}%`
  if (key === 'date' || key === 'licenseExpiry') return formatDate(String(value))
  return String(value)
}

function Table({ page, rows, companyId, onDeleted }: { page: Page; rows: Array<Record<string, unknown>>; companyId: string; onDeleted: () => Promise<void> }) {
  const [deleteError, setDeleteError] = useState('')
  if (!rows.length) return <div className="empty-state"><strong>NO RECORDS YET</strong><p>Create your first record to start tracking operations.</p></div>

  const hiddenKeys = new Set(['id', 'vehicleId', 'driverId', 'customerId', 'invoiceId', 'vehicle', 'driver', 'goods', 'dieselRate', 'otherExpenses', 'trips', 'rate', 'diesel', 'notes', 'billingMode'])
  const keys = Object.keys(rows[0]).filter((key) => !hiddenKeys.has(key)).slice(0, 7)
  const canDelete = ['Trips', 'Daily Register', 'Routes', 'Fleet', 'Drivers', 'Customers', 'Invoices', 'GST Reports', 'Payments', 'Expenses', 'Fuel', 'Maintenance'].includes(page)

  const remove = async (row: Record<string, unknown>) => {
    if (!confirm(`Permanently delete this ${page.toLowerCase().replace(/s$/, '')}?`)) return
    setDeleteError('')
    try {
      const id = String(row.id)
      if (['Trips', 'Daily Register', 'Routes'].includes(page)) await tripRepository.remove(companyId, id)
      else if (page === 'Fleet') await vehicleRepository.remove(companyId, id)
      else if (page === 'Drivers') await driverRepository.remove(companyId, id)
      else if (page === 'Customers') await customerRepository.remove(companyId, id)
      else if (page === 'Invoices') await invoiceRepository.remove(companyId, id)
      else if (page === 'Payments') await paymentRepository.remove(companyId, id)
      else if (['Expenses', 'Fuel', 'Maintenance'].includes(page)) await expenseRepository.remove(companyId, id)
      await onDeleted()
    } catch (error) {
      console.error('DELETE ERROR:', error)
      setDeleteError(error instanceof Error ? error.message : 'Could not delete this record.')
    }
  }

  return <div className="table-wrap">
    {deleteError && <div className="auth-error">{deleteError}</div>}
    <table><thead><tr>{keys.map((key) => <th key={key}>{displayKey(key)}</th>)}{canDelete && <th>Action</th>}</tr></thead>
      <tbody>{rows.map((row) => <tr key={String(row.id)}>
        {keys.map((key) => <td key={key}>{formatCell(key, row[key])}</td>)}
        {canDelete && <td><button className="table-action" onClick={() => void remove(row)}>Delete</button></td>}
      </tr>)}</tbody>
    </table>
  </div>
}

function getRows(page: Page, data: DashboardData): Array<Record<string, unknown>> {
  if (['Trips', 'Daily Register', 'Routes'].includes(page)) return data.trips
  if (page === 'Fleet') return data.vehicles
  if (page === 'Drivers') return data.drivers
  if (page === 'Customers') return data.customers
  if (['Invoices', 'GST Reports'].includes(page)) return data.invoices
  if (page === 'Payments') return data.payments
  if (page === 'Expenses') return data.expenses
  if (page === 'Fuel') return data.expenses.filter((expense) => expense.category.toLowerCase() === 'fuel')
  if (page === 'Maintenance') return data.expenses.filter((expense) => expense.category.toLowerCase() === 'maintenance')
  return [
    { id: 'REPORT', metric: 'Revenue', value: data.trips.reduce((sum, trip) => sum + tripAmount(trip), 0), records: data.trips.length },
    { id: 'PROFIT', metric: 'Trip profit', value: data.trips.reduce((sum, trip) => sum + tripProfit(trip), 0), records: data.trips.length },
  ]
}
function exportCsv(page: string, rows: Array<Record<string, unknown>>) { const headers = Object.keys(rows[0] || { page }); const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => JSON.stringify(row[header] ?? '')).join(','))].join('\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = `${page.toLowerCase().replaceAll(' ', '-')}.csv`; link.click(); URL.revokeObjectURL(link.href) }

export default App
