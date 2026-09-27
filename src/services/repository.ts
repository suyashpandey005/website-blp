import { supabase } from '../lib/supabase'

import type {
  Expense,
  Invoice,
  Payment,
  Trip,
  Vehicle,
  Customer,
} from './storageService'

export type Driver = {
  id: string
  name: string
  phone: string
  licenseNumber: string
  licenseExpiry: string
  status: string
}

export type CompanySettings = {
  id: string
  name: string
  address: string
  phone: string
  email: string
  gstin: string
  website: string
  ownerName: string
  bankName: string
  bankAccountHolder: string
  bankAccountNumber: string
  bankIfsc: string
  upiId: string
  stampPath: string
  signaturePath: string
  paymentTerms: string
  invoiceTerms: string
}

export type InvoiceItem = {
  id: string
  invoiceId: string
  description: string
  sacCode: string
  vehicleEquipment: string
  routeSite: string
  quantity: number
  unit: string
  rate: number
  taxableAmount: number
  taxMode: 'GST' | 'NON-GST'
  gstRate: number
}

export type DashboardData = {
  trips: Trip[]
  vehicles: Vehicle[]
  drivers: Driver[]
  customers: Customer[]
  invoices: Invoice[]
  payments: Payment[]
  expenses: Expense[]
  company: CompanySettings
}

function mapTrip(row: Record<string, unknown>): Trip {
  return {
    id: String(row.id),
    date: String(row.trip_date || ''),
    route: String(row.route || ''),
    vehicle: String(row.vehicle_name || row.vehicle_id || ''),
    vehicleId: row.vehicle_id ? String(row.vehicle_id) : undefined,
    driver: String(row.driver_name || row.driver_id || ''),
    driverId: row.driver_id ? String(row.driver_id) : undefined,
    customer: String(row.customer_name || row.customer_id || ''),
    customerId: row.customer_id ? String(row.customer_id) : undefined,
    goods: String(row.goods_type || ''),
    trips: Number(row.trip_count || 0),
    rate: Number(row.rate_per_trip || 0),
    diesel: Number(row.diesel_consumed || 0),
    dieselRate: Number(row.diesel_rate || 0),
    otherExpenses: Number(row.other_expenses || 0),
    status: row.status as Trip['status'],
    loadingPoint: String(row.loading_point || ''),
    unloadingPoint: String(row.unloading_point || ''),
    billingMode: (row.billing_mode || 'Per Trip') as Trip['billingMode'],
    notes: String(row.notes || ''),
  }
}
function mapVehicle(row: Record<string, unknown>): Vehicle { return { id: String(row.id), registration: String(row.registration_number), type: String(row.vehicle_type), driver: String(row.driver_name || 'Unassigned'), status: row.status as Vehicle['status'], trips: Number(row.trip_count || 0), revenue: Number(row.revenue || 0), diesel: Number(row.diesel_used || 0) } }
function mapCustomer(row: Record<string, unknown>): Customer {
  return {
    id: String(row.id),
    name: String(row.customer_name || ''),
    phone: String(row.phone || ''),
    date: String(row.customer_date || ''),
    gstin: String(row.gstin || ''),
    bankName: String(row.bank_name || ''),
    bankAccountHolder: String(row.bank_account_holder || ''),
    bankAccountNumber: String(row.bank_account_number || ''),
    bankIfsc: String(row.bank_ifsc || ''),
    bankUpiId: String(row.bank_upi_id || ''),
    billing: Number(row.billing || 0),
    paid: Number(row.paid || 0),
    status: row.status as Customer['status'],
  }
}
function mapInvoice(row: Record<string, unknown>): Invoice {
  return {
    id: String(row.invoice_number),
    dbId: String(row.id),
    date: String(row.invoice_date),
    customer: String(row.customer_name || row.customer_id || ''),
    customerId: row.customer_id ? String(row.customer_id) : undefined,
    taxable: Number(row.taxable_amount),
    gstRate: Number(row.gst_rate),
    total: Number(row.grand_total),
    paid: Number(row.amount_paid || 0),
    status: row.status as Invoice['status'],
  }
}
function mapCompany(row: Record<string, unknown>): CompanySettings { return { id: String(row.id), name: String(row.name || 'BLP Construction'), address: String(row.address || ''), phone: String(row.phone || ''), email: String(row.email || ''), gstin: String(row.gstin || ''), website: String(row.website || ''), ownerName: String(row.owner_name || ''), bankName: String(row.bank_name || ''), bankAccountHolder: String(row.bank_account_holder || ''), bankAccountNumber: String(row.bank_account_number || ''), bankIfsc: String(row.bank_ifsc || ''), upiId: String(row.upi_id || ''), stampPath: String(row.stamp_path || ''), signaturePath: String(row.signature_path || ''), paymentTerms: String(row.payment_terms || 'Due on receipt'), invoiceTerms: String(row.invoice_terms || '') } }
function mapInvoiceItem(row: Record<string, unknown>): InvoiceItem { return { id: String(row.id), invoiceId: String(row.invoice_id), description: String(row.description), sacCode: String(row.sac_code || ''), vehicleEquipment: String(row.vehicle_equipment || ''), routeSite: String(row.route_site || ''), quantity: Number(row.quantity), unit: String(row.unit), rate: Number(row.rate), taxableAmount: Number(row.taxable_amount), taxMode: row.tax_mode as InvoiceItem['taxMode'], gstRate: Number(row.gst_rate || 0) } }

export const tripRepository = {
 async list(companyId: string) {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('company_id', companyId)
    .order('trip_date', { ascending: false })

  if (error) {
    console.error('TRIPS QUERY ERROR:', error)
    throw error
  }

  return (data || []).map(mapTrip)
},

  async create(companyId: string, trip: Omit<Trip, 'id'>) {
    const { data, error } = await supabase
      .from('trips')
      .insert({
        company_id: companyId,

        trip_date: trip.date,

        vehicle_id: trip.vehicle,

        driver_id: trip.driver || null,

        customer_id: trip.customer,

        route: trip.route,

        goods_type: trip.goods,

        trip_count: trip.trips,

        rate_per_trip: trip.rate,

        diesel_consumed: trip.diesel,

        diesel_rate: trip.dieselRate,

        other_expenses: trip.otherExpenses,

        status: trip.status,

        notes: trip.notes,

        loading_point: trip.loadingPoint,

        unloading_point: trip.unloadingPoint,

        billing_mode: trip.billingMode,
      })
      .select('*')
      .single()

    if (error) throw error

    return mapTrip(data)
  },

  async remove(companyId: string, id: string) {
    const { error } = await supabase
      .from('trips')
      .delete()
      .eq('company_id', companyId)
      .eq('id', id)

    if (error) throw error
  },
}

export const vehicleRepository = {
  async list(companyId: string) {
    const { data, error } = await supabase
      .from('vehicle_summary')
      .select('*')
      .eq('company_id', companyId)

    if (error) throw error

    return (data || []).map(mapVehicle)
  },

  async create(
    companyId: string,
    vehicle: Omit<Vehicle, 'id' | 'trips' | 'revenue' | 'diesel'>,
  ) {
    const { data, error } = await supabase
      .from('vehicles')
      .insert({
        company_id: companyId,
        registration_number: vehicle.registration,
        vehicle_type: vehicle.type,
        status: vehicle.status,
      })
      .select('*')
      .single()

    if (error) throw error

    return mapVehicle(data)
  },

  async assignDriver(
    companyId: string,
    vehicleId: string,
    driverId: string,
  ) {
    const { error } = await supabase
      .from('vehicles')
      .update({
        driver_id: driverId,
      })
      .eq('company_id', companyId)
      .eq('id', vehicleId)

    if (error) throw error
  },

  async remove(companyId: string, id: string) {
    const { error } = await supabase
      .from('vehicles')
      .delete()
      .eq('company_id', companyId)
      .eq('id', id)

    if (error) throw error
  },
}
export const driverRepository = {
  async list(companyId: string) {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('company_id', companyId)
      .order('name', { ascending: true })

    if (error) throw error

    return (data || []).map((row) => ({
      id: String(row.id),
      name: String(row.name || ''),
      phone: String(row.phone || ''),
      licenseNumber: String(row.license_number || ''),
      licenseExpiry: String(row.license_expiry || ''),
      status: String(row.status || 'Active'),
    }))
  },

  async create(
    companyId: string,
    driver: Omit<Driver, 'id'>,
  ) {
    const { data, error } = await supabase
      .from('drivers')
      .insert({
        company_id: companyId,
        name: driver.name,
        phone: driver.phone,
        license_number: driver.licenseNumber,
        license_expiry: driver.licenseExpiry || null,
        status: driver.status,
      })
      .select('*')
      .single()

    if (error) throw error

    return {
      id: String(data.id),
      name: String(data.name || ''),
      phone: String(data.phone || ''),
      licenseNumber: String(data.license_number || ''),
      licenseExpiry: String(data.license_expiry || ''),
      status: String(data.status || 'Active'),
    }
  },

  async remove(companyId: string, id: string) {
    const { error } = await supabase
      .from('drivers')
      .delete()
      .eq('company_id', companyId)
      .eq('id', id)

    if (error) throw error
  },
}
export const customerRepository = {
  async list(companyId: string) {
    const { data, error } = await supabase
      .from('customer_summary')
      .select('*')
      .eq('company_id', companyId)
      .order('customer_name', { ascending: true })
    if (error) throw error
    return (data || []).map(mapCustomer)
  },
  async create(
    companyId: string,
    customer: Omit<Customer, 'id' | 'billing' | 'paid'>,
  ) {
    const { data, error } = await supabase
      .from('customers')
      .insert({
        company_id: companyId,
        customer_name: customer.name,
        phone: customer.phone,
        customer_date: customer.date,
        gstin: customer.gstin,
        status: customer.status,
      })
      .select('*')
      .single()
    if (error) throw error
    return mapCustomer(data)
  },
  async remove(companyId: string, id: string) {
    // Customers are referenced by trips, invoices, and payments.
    // Never cascade-delete business records just to make the customer delete button work.
    const [tripsResult, invoicesResult, paymentsResult] = await Promise.all([
      supabase
        .from('trips')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('customer_id', id),
      supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('customer_id', id),
      supabase
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('customer_id', id),
    ])

    const dependencyError = tripsResult.error || invoicesResult.error || paymentsResult.error
    if (dependencyError) throw dependencyError

    const trips = tripsResult.count || 0
    const invoices = invoicesResult.count || 0
    const payments = paymentsResult.count || 0

    if (trips || invoices || payments) {
      const linked: string[] = []
      if (trips) linked.push(`${trips} trip${trips === 1 ? '' : 's'}`)
      if (invoices) linked.push(`${invoices} invoice${invoices === 1 ? '' : 's'}`)
      if (payments) linked.push(`${payments} payment${payments === 1 ? '' : 's'}`)
      throw new Error(
        `This customer cannot be deleted because it is linked to ${linked.join(', ')}. Keep the customer record so your business history remains intact.`,
      )
    }

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('company_id', companyId)
      .eq('id', id)
    if (error) throw error
  },
}
export const invoiceRepository = { async list(companyId: string) { const { data, error } = await supabase.from('invoice_summary').select('*').eq('company_id', companyId).order('invoice_date', { ascending: false }); if (error) throw error; return (data || []).map(mapInvoice) }, async create(companyId: string, invoice: { number: string; date: string; customerId: string; taxable: number; gstRate: number }) { const gst = invoice.taxable * invoice.gstRate / 100; const { error } = await supabase.from('invoices').insert({ company_id: companyId, invoice_number: invoice.number, invoice_date: invoice.date, customer_id: invoice.customerId, taxable_amount: invoice.taxable, gst_rate: invoice.gstRate, cgst: gst / 2, sgst: gst / 2, igst: 0, grand_total: invoice.taxable + gst, amount_paid: 0, status: 'Pending' }); if (error) throw error } , async remove(companyId: string, id: string) { await deleteBusinessRecord(companyId, 'invoices', id) } }
export const paymentRepository = {
  async list(companyId: string) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('company_id', companyId)
      .order('payment_date', { ascending: false })

    if (error) throw error

    return (data || []).map((row) => ({
      id: String(row.id),
      date: String(row.payment_date || ''),
      customer: String(row.customer_id || ''),
      customerId: row.customer_id ? String(row.customer_id) : undefined,
      invoice: String(row.invoice_id || ''),
      invoiceId: row.invoice_id ? String(row.invoice_id) : undefined,
      amount: Number(row.amount || 0),
      method: String(row.payment_method || 'UPI') as Payment['method'],
      reference: String(row.reference_number || ''),
    }))
  },

  async create(
    companyId: string,
    payment: {
      date: string
      customerId: string
      invoiceId?: string
      amount: number
      method: string
      reference: string
    },
  ) {
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        company_id: companyId,
        payment_date: payment.date,
        customer_id: payment.customerId,
        invoice_id: payment.invoiceId || null,
        amount: payment.amount,
        payment_method: payment.method,
        reference_number: payment.reference,
      })

    if (paymentError) throw paymentError

    if (payment.invoiceId) {
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('grand_total, amount_paid, due_date')
        .eq('company_id', companyId)
        .eq('id', payment.invoiceId)
        .single()

      if (invoiceError) throw invoiceError

      const total = Number(invoice.grand_total || 0)
      const newPaid = Math.min(total, Number(invoice.amount_paid || 0) + payment.amount)
      const today = new Date().toISOString().slice(0, 10)

      let status: 'Pending' | 'Paid' | 'Overdue' | 'Partially Paid' = 'Pending'
      if (newPaid >= total) status = 'Paid'
      else if (invoice.due_date && invoice.due_date < today) status = 'Overdue'
      else if (newPaid > 0) status = 'Partially Paid'

      const { error: updateError } = await supabase
        .from('invoices')
        .update({ amount_paid: newPaid, status })
        .eq('company_id', companyId)
        .eq('id', payment.invoiceId)

      if (updateError) throw updateError
    }
  },

  async remove(companyId: string, id: string) {
    const { data: payment, error: readError } = await supabase
      .from('payments')
      .select('invoice_id, amount')
      .eq('company_id', companyId)
      .eq('id', id)
      .single()

    if (readError) throw readError

    const { error } = await supabase
      .from('payments')
      .delete()
      .eq('company_id', companyId)
      .eq('id', id)

    if (error) throw error

    if (payment.invoice_id) {
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('grand_total, amount_paid, due_date')
        .eq('company_id', companyId)
        .eq('id', payment.invoice_id)
        .single()

      if (invoiceError) throw invoiceError

      const newPaid = Math.max(0, Number(invoice.amount_paid || 0) - Number(payment.amount || 0))
      const total = Number(invoice.grand_total || 0)
      const today = new Date().toISOString().slice(0, 10)

      let status: 'Pending' | 'Paid' | 'Overdue' | 'Partially Paid' = 'Pending'
      if (newPaid >= total) status = 'Paid'
      else if (invoice.due_date && invoice.due_date < today) status = 'Overdue'
      else if (newPaid > 0) status = 'Partially Paid'

      const { error: updateError } = await supabase
        .from('invoices')
        .update({ amount_paid: newPaid, status })
        .eq('company_id', companyId)
        .eq('id', payment.invoice_id)

      if (updateError) throw updateError
    }
  },
}

export const expenseRepository = {
  async list(companyId: string) {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('company_id', companyId)
      .order('expense_date', { ascending: false })
    if (error) throw error
    return (data || []).map((row) => ({
      id: String(row.id),
      date: String(row.expense_date || ''),
      category: String(row.category || ''),
      vehicle: String(row.vehicle_id || ''),
      vehicleId: row.vehicle_id ? String(row.vehicle_id) : undefined,
      amount: Number(row.amount || 0),
      method: String(row.payment_method || 'Cash') as Expense['method'],
      description: String(row.description || ''),
    }))
  },
  async create(
    companyId: string,
    expense: {
      date: string
      category: string
      vehicleId?: string
      amount: number
      method: string
      description: string
    },
  ) {
    const { error } = await supabase.from('expenses').insert({
      company_id: companyId,
      expense_date: expense.date,
      category: expense.category,
      vehicle_id: expense.vehicleId || null,
      amount: expense.amount,
      payment_method: expense.method,
      description: expense.description,
    })
    if (error) throw error
  },
  async remove(companyId: string, id: string) {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('company_id', companyId)
      .eq('id', id)
    if (error) throw error
  },
}

export const invoiceItemRepository = { async list(companyId: string, invoiceId: string) { const { data, error } = await supabase.from('invoice_items').select('*').eq('company_id', companyId).eq('invoice_id', invoiceId).order('created_at'); if (error) throw error; return (data || []).map(mapInvoiceItem) }, async create(companyId: string, item: Omit<InvoiceItem, 'id'>) { const { error } = await supabase.from('invoice_items').insert({ company_id: companyId, invoice_id: item.invoiceId, description: item.description, sac_code: item.sacCode, vehicle_equipment: item.vehicleEquipment, route_site: item.routeSite, quantity: item.quantity, unit: item.unit, rate: item.rate, taxable_amount: item.taxableAmount, tax_mode: item.taxMode, gst_rate: item.gstRate }); if (error) throw error } }

export const companyRepository = { async get(companyId: string) { const { data, error } = await supabase.from('companies').select('*').eq('id', companyId).single(); if (error) throw error; return mapCompany(data) }, async update(companyId: string, settings: Partial<CompanySettings>) { const { error } = await supabase.from('companies').update({ name: settings.name, address: settings.address, phone: settings.phone, email: settings.email, gstin: settings.gstin, website: settings.website, owner_name: settings.ownerName, bank_name: settings.bankName, bank_account_holder: settings.bankAccountHolder, bank_account_number: settings.bankAccountNumber, bank_ifsc: settings.bankIfsc, upi_id: settings.upiId, payment_terms: settings.paymentTerms, invoice_terms: settings.invoiceTerms }).eq('id', companyId); if (error) throw error }, async uploadAsset(companyId: string, kind: 'logo' | 'stamp' | 'signature', file: File) { if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2_000_000) throw new Error('Use a PNG, JPG, or WEBP image under 2 MB.'); const path = `${companyId}/${kind}-${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`; const { error } = await supabase.storage.from('company-documents').upload(path, file, { upsert: false, contentType: file.type }); if (error) throw error; const column = kind === 'logo' ? 'logo_path' : kind === 'stamp' ? 'stamp_path' : 'signature_path'; const { error: updateError } = await supabase.from('companies').update({ [column]: path }).eq('id', companyId); if (updateError) throw updateError; return path }, async signedAssetUrl(path: string) { if (!path) return ''; const { data, error } = await supabase.storage.from('company-documents').createSignedUrl(path, 300); if (error) throw error; return data.signedUrl } }

export async function deleteBusinessRecord(companyId: string, table: string, recordId: string) {
  const { error } = await supabase.rpc('delete_company_record', {
    p_company_id: companyId,
    p_table: table,
    p_record_id: recordId,
  })

  if (error) throw error
}

export async function loadCompanyData(
  companyId: string,
): Promise<DashboardData> {
  const [
    trips,
    vehicles,
    drivers,
    customers,
    invoices,
    payments,
    expenses,
    company,
  ] = await Promise.all([
    tripRepository.list(companyId),
    vehicleRepository.list(companyId),
    driverRepository.list(companyId),
    customerRepository.list(companyId),
    invoiceRepository.list(companyId),
    paymentRepository.list(companyId),
    expenseRepository.list(companyId),
    companyRepository.get(companyId),
  ])

  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.registration]))
  const driverById = new Map(drivers.map((driver) => [driver.id, driver.name]))
  const customerById = new Map(customers.map((customer) => [customer.id, customer.name]))
  const invoiceById = new Map(invoices.map((invoice) => [invoice.dbId || '', invoice.id]))

  const resolvedTrips = trips.map((trip) => ({
    ...trip,
    vehicle: trip.vehicleId ? (vehicleById.get(trip.vehicleId) || trip.vehicle) : trip.vehicle,
    driver: trip.driverId ? (driverById.get(trip.driverId) || trip.driver) : trip.driver,
    customer: trip.customerId ? (customerById.get(trip.customerId) || trip.customer) : trip.customer,
  }))

  const resolvedPayments = payments.map((payment) => ({
    ...payment,
    customer: payment.customerId ? (customerById.get(payment.customerId) || payment.customer) : payment.customer,
    invoice: payment.invoiceId ? (invoiceById.get(payment.invoiceId) || payment.invoice) : payment.invoice,
  }))

  const resolvedExpenses = expenses.map((expense) => ({
    ...expense,
    vehicle: expense.vehicleId ? (vehicleById.get(expense.vehicleId) || expense.vehicle) : expense.vehicle,
  }))

  return {
    trips: resolvedTrips,
    vehicles,
    drivers,
    customers,
    invoices,
    payments: resolvedPayments,
    expenses: resolvedExpenses,
    company,
  }
}
export async function uploadCompanyDocument(companyId: string, file: File) { const path = `${companyId}/${crypto.randomUUID()}-${file.name}`; const { error } = await supabase.storage.from('company-documents').upload(path, file, { upsert: false }); if (error) throw error; return path }
