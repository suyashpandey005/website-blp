import { useState } from 'react'

import type { DashboardData } from '../services/repository'
import {
  customerRepository,
  driverRepository,
  expenseRepository,
  invoiceRepository,
  paymentRepository,
  tripRepository,
  vehicleRepository,
} from '../services/repository'

import type { TripStatus, VehicleStatus } from '../services/storageService'
import { formatCurrency } from '../services/storageService'

type BillingMode = 'Per Trip' | 'Per Hour' | 'Per Minute' | 'Fixed Amount'

export function PersistedRecordModal({
  kind,
  companyId,
  data,
  onSaved,
  close,
}: {
  kind: string
  companyId: string
  data: DashboardData
  onSaved: () => Promise<void>
  close: () => void
}) {
  const [form, setForm] = useState<Record<string, string>>({
    date: new Date().toISOString().slice(0, 10),

    vehicle: '',
    customer: '',
    invoice: '',
    driver: '',
    assignedVehicle: '',
    driverName: '',
    licenseNumber: '',
    licenseExpiry: '',
    driverStatus: 'Active',

    loadingPoint: '',
    unloadingPoint: '',

    billingMode: 'Per Trip',

    trips: '1',
    hours: '0',
    minutes: '0',

    rate: '0',

    diesel: '0',
    dieselRate: '0',

    goods: '',
    remarks: '',

    registration: '',
    type: '',

    name: '',
    phone: '',
    gstin: '',
    bankName: '',
    bankAccountHolder: '',
    bankAccountNumber: '',
    bankIfsc: '',
    bankUpiId: '',

    number: '',
    taxable: '0',
    gstRate: '18',

    amount: '0',
    method: 'UPI',
    reference: '',

    category: kind === 'Fuel' ? 'Fuel' : kind === 'Maintenance' ? 'Maintenance' : '',
    description: '',

    status: kind === 'Fleet' ? 'Active' : 'Scheduled',
  })

  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (key: string, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const numeric = (key: string) => Number(form[key] || 0)

  const calculateTripQuantity = () => {
    switch (form.billingMode as BillingMode) {
      case 'Per Hour':
        return numeric('hours')

      case 'Per Minute':
        return numeric('minutes')

      case 'Fixed Amount':
        return 1

      case 'Per Trip':
      default:
        return numeric('trips')
    }
  }

  const calculateTripAmount = () => {
    if (form.billingMode === 'Fixed Amount') {
      return numeric('rate')
    }

    return calculateTripQuantity() * numeric('rate')
  }

  const save = async () => {
    setError('')
    setSaving(true)

    try {
      if (kind === 'Trips') {
        const vehicle = data.vehicles.find(
          (item) => item.id === form.vehicle,
        )

        const customer = data.customers.find(
          (item) => item.id === form.customer,
        )

        const driver = data.drivers.find(
          (item) => item.id === form.driver,
        )

        if (!vehicle || !customer || !driver) {
          setError('Please select a vehicle, driver and customer.')
          return
        }

        if (!form.loadingPoint.trim() || !form.unloadingPoint.trim()) {
          setError('Loading point and unloading point are required.')
          return
        }

        if (!form.billingMode) {
          setError('Please select a billing mode.')
          return
        }

        if (numeric('rate') < 0) {
          setError('Rate cannot be negative.')
          return
        }

        if (
          form.billingMode === 'Per Trip' &&
          numeric('trips') <= 0
        ) {
          setError('Enter at least 1 trip.')
          return
        }

        if (
          form.billingMode === 'Per Hour' &&
          numeric('hours') <= 0
        ) {
          setError('Enter the number of hours.')
          return
        }

        if (
          form.billingMode === 'Per Minute' &&
          numeric('minutes') <= 0
        ) {
          setError('Enter the number of minutes.')
          return
        }

        await tripRepository.create(companyId, {
          date: form.date,

          route: `${form.loadingPoint.trim()} → ${form.unloadingPoint.trim()}`,

          vehicle: vehicle.id,

          driver: driver.id,

          customer: customer.id,

          goods: form.goods.trim(),

          trips: calculateTripQuantity(),

          rate: numeric('rate'),

          diesel: numeric('diesel'),

          dieselRate: numeric('dieselRate'),

          otherExpenses: 0,

          status: form.status as TripStatus,

          loadingPoint: form.loadingPoint.trim(),

          unloadingPoint: form.unloadingPoint.trim(),

          billingMode: form.billingMode as BillingMode,

          notes: form.remarks.trim(),
        })
      } else if (kind === 'Drivers') {
        if (!form.driverName.trim()) {
          setError('Driver name is required.')
          return
        }

        if (!form.phone.trim()) {
          setError('Phone number is required.')
          return
        }

        if (!form.licenseNumber.trim()) {
          setError('License number is required.')
          return
        }

        const driver = await driverRepository.create(companyId, {
          name: form.driverName.trim(),
          phone: form.phone.trim(),
          licenseNumber: form.licenseNumber.trim(),
          licenseExpiry: form.licenseExpiry,
          status: form.driverStatus || 'Active',
        })

        if (form.assignedVehicle) {
          await vehicleRepository.assignDriver(
            companyId,
            form.assignedVehicle,
            driver.id,
          )
        }
      } else if (kind === 'Fleet') {
        if (!form.registration.trim() || !form.type.trim()) {
          setError('Registration and vehicle type are required.')
          return
        }

        await vehicleRepository.create(companyId, {
          registration: form.registration.trim().toUpperCase(),

          type: form.type.trim(),

          driver: 'Unassigned',

          status: (form.status || 'Idle') as VehicleStatus,
        })
      } else if (kind === 'Customers') {
        if (!form.name.trim()) {
          setError('Company name is required.')
          return
        }

        await customerRepository.create(companyId, {
          name: form.name.trim(),
          phone: form.phone.trim(),
          date: form.date.trim(),
          gstin: '',
          bankName: '',
          bankAccountHolder: '',
          bankAccountNumber: '',
          bankIfsc: '',
          bankUpiId: '',
          status: 'Active',
        })
      } else if (kind === 'Invoices') {
        if (
          !form.customer ||
          !form.number.trim() ||
          numeric('taxable') <= 0 ||
          numeric('gstRate') < 0 ||
          numeric('gstRate') > 100
        ) {
          setError(
            'Invoice number, customer, taxable amount, and valid GST are required.',
          )
          return
        }

        await invoiceRepository.create(companyId, {
          number: form.number.trim(),

          date: form.date,

          customerId: form.customer,

          taxable: numeric('taxable'),

          gstRate: numeric('gstRate'),
        })
      } else if (kind === 'Payments') {
        if (
          !form.customer ||
          !form.invoice ||
          numeric('amount') <= 0 ||
          !form.method
        ) {
          setError(
            'Customer, invoice, payment method, and a positive amount are required.',
          )
          return
        }

        const selectedInvoice = data.invoices.find(
          (invoice) => invoice.dbId === form.invoice,
        )

        if (!selectedInvoice) {
          setError('Please select a valid invoice.')
          return
        }

        const outstanding = Math.max(
          0,
          selectedInvoice.total - selectedInvoice.paid,
        )

        if (numeric('amount') > outstanding) {
          setError(
            `Payment cannot exceed the outstanding balance of ${formatCurrency(outstanding)}.`,
          )
          return
        }

        await paymentRepository.create(companyId, {
          date: form.date,
          customerId: form.customer,
          invoiceId: selectedInvoice?.dbId,
          amount: numeric('amount'),
          method: form.method,
          reference: form.reference.trim(),
        })
      } else {
        if (numeric('amount') < 0 || !form.category.trim()) {
          setError('Category and a valid amount are required.')
          return
        }

        await expenseRepository.create(companyId, {
          date: form.date,

          category: form.category.trim(),

          vehicleId: form.vehicle || undefined,

          amount: numeric('amount'),

          method: form.method,

          description: form.description.trim(),
        })
      }

      await onSaved()

      close()
    } catch (error: any) {
  console.error('SAVE ERROR:', error)
  setError(error?.message || JSON.stringify(error) || 'Unable to save the record.')

    } finally {
      setSaving(false)
    }
  }

  const tripFields =
    form.billingMode === 'Per Trip'
      ? [
          ['trips', 'Number of trips'],
          ['rate', 'Rate per trip'],
        ]
      : form.billingMode === 'Per Hour'
        ? [
            ['hours', 'Hours'],
            ['rate', 'Rate per hour'],
          ]
        : form.billingMode === 'Per Minute'
          ? [
              ['minutes', 'Minutes'],
              ['rate', 'Rate per minute'],
            ]
          : [['rate', 'Fixed amount']]

  const fields =
    kind === 'Drivers'
      ? [
          ['driverName', 'Driver Name'],
          ['phone', 'Phone Number'],
          ['licenseNumber', 'License Number'],
          ['licenseExpiry', 'License Expiry'],
        ]
      : kind === 'Trips'
        ? tripFields
      : kind === 'Fleet'
        ? [
            ['registration', 'Registration number'],
            ['type', 'Vehicle type'],
          ]
        : kind === 'Customers'
          ? [
              ['name', 'Customer Name'],
              ['phone', 'Phone'],
              ['date', 'Date'],
            ]
          : kind === 'Invoices'
            ? [
                ['number', 'Invoice number'],
                ['taxable', 'Taxable amount'],
                ['gstRate', 'GST rate'],
              ]
            : kind === 'Payments'
              ? [
                  ['invoice', 'Invoice'],
                  ['amount', 'Amount'],
                  ['method', 'Payment method'],
                  ['reference', 'Reference number'],
                ]
              : [
                  ['category', 'Category'],
                  ['amount', 'Amount'],
                  ['description', 'Description'],
                ]

  const numericFields = [
    'trips',
    'hours',
    'minutes',
    'rate',
    'diesel',
    'dieselRate',
    'taxable',
    'gstRate',
    'amount',
  ]

  return (
    <div
      className="modal-backdrop"
      onClick={close}
    >
      <div
        className="form-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="form-heading">
          <div>
            <span className="section-kicker">
              SUPABASE RECORD
            </span>

            <h2>
              Add {kind.replace(/s$/, '')}
            </h2>
          </div>

          <button
            className="icon-button"
            onClick={close}
          >
            ×
          </button>
        </div>

        <div className="form-grid">

          <label>
            Date

            <input
              type="date"
              value={form.date}
              onChange={(event) =>
                set('date', event.target.value)
              }
            />
          </label>

          {(kind === 'Trips' ||
            kind === 'Invoices' ||
            kind === 'Payments') && (
            <label>
              Customer

              <select
                value={form.customer}
                onChange={(event) =>
                  set('customer', event.target.value)
                }
              >
                <option value="">
                  Select customer
                </option>

                {data.customers.map((customer) => (
                  <option
                    key={customer.id}
                    value={customer.id}
                  >
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {kind === 'Trips' && (
            <>
              <label>
                Vehicle

                <select
                  value={form.vehicle}
                  onChange={(event) =>
                    set('vehicle', event.target.value)
                  }
                >
                  <option value="">
                    Select vehicle
                  </option>

                  {data.vehicles.map((vehicle) => (
                    <option
                      key={vehicle.id}
                      value={vehicle.id}
                    >
                      {vehicle.registration}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Driver

                <select
                  value={form.driver}
                  onChange={(event) =>
                    set('driver', event.target.value)
                  }
                >
                  <option value="">
                    Select driver
                  </option>

                  {data.drivers.map((driver) => (
                    <option
                      key={driver.id}
                      value={driver.id}
                    >
                      {driver.name} — {driver.phone}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Loading Point

                <input
                  type="text"
                  placeholder="e.g. Bilaspur"
                  value={form.loadingPoint}
                  onChange={(event) =>
                    set(
                      'loadingPoint',
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                Unloading Point

                <input
                  type="text"
                  placeholder="e.g. Raipur"
                  value={form.unloadingPoint}
                  onChange={(event) =>
                    set(
                      'unloadingPoint',
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                Billing Mode

                <select
                  value={form.billingMode}
                  onChange={(event) =>
                    set(
                      'billingMode',
                      event.target.value,
                    )
                  }
                >
                  <option value="Per Trip">
                    Per Trip
                  </option>

                  <option value="Per Hour">
                    Per Hour
                  </option>

                  <option value="Per Minute">
                    Per Minute
                  </option>

                  <option value="Fixed Amount">
                    Fixed Amount
                  </option>
                </select>
              </label>
            </>
          )}

          {kind === 'Drivers' && (
            <>
              <label>
                Vehicle

                <select
                  value={form.assignedVehicle}
                  onChange={(event) =>
                    set('assignedVehicle', event.target.value)
                  }
                >
                  <option value="">
                    Select vehicle
                  </option>

                  {data.vehicles.map((vehicle) => (
                    <option
                      key={vehicle.id}
                      value={vehicle.id}
                    >
                      {vehicle.registration} — {vehicle.type}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Vehicle Type

                <input
                  type="text"
                  value={
                    data.vehicles.find(
                      (vehicle) =>
                        vehicle.id === form.assignedVehicle,
                    )?.type || ''
                  }
                  placeholder="Select vehicle first"
                  readOnly
                />
              </label>

              <label>
                Status

                <select
                  value={form.driverStatus}
                  onChange={(event) =>
                    set('driverStatus', event.target.value)
                  }
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>
            </>
          )}

          {(kind === 'Expenses' ||
            kind === 'Fuel') && (
            <label>
              Vehicle

              <select
                value={form.vehicle}
                onChange={(event) =>
                  set('vehicle', event.target.value)
                }
              >
                <option value="">
                  No vehicle
                </option>

                {data.vehicles.map((vehicle) => (
                  <option
                    key={vehicle.id}
                    value={vehicle.id}
                  >
                    {vehicle.registration}
                  </option>
                ))}
              </select>
            </label>
          )}

          {fields.map(([key, label]) => {
            if (kind === 'Payments' && key === 'invoice') {
              return (
                <label key={key}>
                  Invoice
                  <select
                    value={form.invoice || ''}
                    onChange={(event) => {
                      const invoiceId = event.target.value
                      const selectedInvoice = data.invoices.find(
                        (invoice) => invoice.dbId === invoiceId,
                      )

                      set('invoice', invoiceId)

                      if (selectedInvoice) {
                        const matchingCustomer = data.customers.find(
                          (customer) =>
                            customer.id === selectedInvoice.customerId ||
                            customer.name === selectedInvoice.customer,
                        )

                        if (matchingCustomer) {
                          set('customer', matchingCustomer.id)
                        }
                      }
                    }}
                  >
                    <option value="">Select invoice</option>

                    {data.invoices.map((invoice) => (
                      <option
                        key={invoice.dbId}
                        value={invoice.dbId}
                      >
                        {invoice.id} — {invoice.customer}
                      </option>
                    ))}
                  </select>
                </label>
              )
            }

            if (kind === 'Payments' && key === 'method') {
              return (
                <label key={key}>
                  Payment Method
                  <select
                    value={form.method || 'UPI'}
                    onChange={(event) =>
                      set('method', event.target.value)
                    }
                  >
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">
                      Bank Transfer
                    </option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </label>
              )
            }

            return (
              <label key={key}>
                {label}

                <input
                  type={
                    key === 'licenseExpiry'
                      ? 'date'
                      : numericFields.includes(key)
                        ? 'number'
                        : 'text'
                  }
                  min={
                    numericFields.includes(key)
                      ? '0'
                      : undefined
                  }
                  value={form[key] || ''}
                  onChange={(event) =>
                    set(key, event.target.value)
                  }
                />
              </label>
            )
          })}

          {kind === 'Trips' && (
            <>
              <label>
                Fuel consumed (litres)

                <input
                  type="number"
                  min="0"
                  value={form.diesel}
                  onChange={(event) =>
                    set(
                      'diesel',
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                Fuel rate

                <input
                  type="number"
                  min="0"
                  value={form.dieselRate}
                  onChange={(event) =>
                    set(
                      'dieselRate',
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                Goods / Material

                <input
                  type="text"
                  placeholder="e.g. Cement"
                  value={form.goods}
                  onChange={(event) =>
                    set(
                      'goods',
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                Status

                <select
                  value={form.status}
                  onChange={(event) =>
                    set(
                      'status',
                      event.target.value,
                    )
                  }
                >
                  <option value="Scheduled">
                    Scheduled
                  </option>

                  <option value="In transit">
                    In transit
                  </option>

                  <option value="Completed">
                    Completed
                  </option>
                </select>
              </label>

              <label className="wide">
                Remarks

                <textarea
                  rows={3}
                  placeholder="Additional trip remarks"
                  value={form.remarks}
                  onChange={(event) =>
                    set(
                      'remarks',
                      event.target.value,
                    )
                  }
                />
              </label>
            </>
          )}
        </div>

        {kind === 'Trips' && (
          <div className="calc-preview">
            Billing:
            {' '}

            <b>
              {form.billingMode}
            </b>

            {' · '}

            Billable amount:
            {' '}

            <b>
              {formatCurrency(
                calculateTripAmount(),
              )}
            </b>

            {numeric('diesel') > 0 &&
              numeric('dieselRate') > 0 && (
                <>
                  {' · '}
                  Fuel cost:
                  {' '}

                  <b>
                    {formatCurrency(
                      numeric('diesel') *
                        numeric('dieselRate'),
                    )}
                  </b>
                </>
              )}
          </div>
        )}

        {error && (
          <div className="auth-error">
            {error}
          </div>
        )}

        <div className="form-actions">
          <button
            className="button secondary"
            onClick={close}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            className="button primary"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving
              ? 'Saving...'
              : 'Save record'}
          </button>
        </div>
      </div>
    </div>
  )
}
