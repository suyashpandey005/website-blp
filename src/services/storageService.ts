export type TripStatus = 'In transit' | 'Completed' | 'Scheduled'
export type VehicleStatus = 'Active' | 'Idle' | 'Maintenance'
export type PaymentMethod = 'UPI' | 'Cash' | 'Bank Transfer' | 'Cheque'
export type Trip = {
  id: string
  date: string
  route: string
  vehicle: string
  vehicleId?: string
  driver: string
  driverId?: string
  customer: string
  customerId?: string
  goods: string
  trips: number
  rate: number
  diesel: number
  dieselRate: number
  otherExpenses: number
  status: TripStatus
  loadingPoint: string
  unloadingPoint: string
  billingMode: 'Per Trip' | 'Per Hour' | 'Per Minute' | 'Fixed Amount'
  notes: string
}
export type Vehicle = { id: string; registration: string; type: string; driver: string; status: VehicleStatus; trips: number; revenue: number; diesel: number }
export type Customer = {
  id: string
  name: string
  phone: string
  date: string
  gstin: string
  bankName?: string
  bankAccountHolder?: string
  bankAccountNumber?: string
  bankIfsc?: string
  bankUpiId?: string
  billing: number
  paid: number
  status: 'Active' | 'On hold'
}
export type Invoice = {
  id: string
  dbId?: string
  date: string
  customer: string
  customerId?: string
  taxable: number
  gstRate: number
  total: number
  paid: number
  status: 'Paid' | 'Pending' | 'Overdue' | 'Partially Paid'
}
export type Payment = {
  id: string
  date: string
  customer: string
  customerId?: string
  invoice: string
  invoiceId?: string
  amount: number
  method: PaymentMethod
  reference: string
}
export type Expense = {
  id: string
  date: string
  category: string
  vehicle: string
  vehicleId?: string
  amount: number
  method: PaymentMethod
  description: string
}
export type Data = { trips: Trip[]; vehicles: Vehicle[]; customers: Customer[]; invoices: Invoice[]; payments: Payment[]; expenses: Expense[] }
export function makeId(prefix: string) { return `${prefix}-${Date.now().toString().slice(-6)}` }
export function tripAmount(trip: Trip) { return trip.trips * trip.rate }
export function tripDieselCost(trip: Trip) { return trip.diesel * trip.dieselRate }
export function tripProfit(trip: Trip) { return tripAmount(trip) - tripDieselCost(trip) - trip.otherExpenses }
export function formatCurrency(value: number) { return `₹${Math.round(value).toLocaleString('en-IN')}` }
export function formatDate(value: string) { return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) }
