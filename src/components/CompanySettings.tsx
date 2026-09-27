import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { CompanySettings } from '../services/repository'
import { companyRepository } from '../services/repository'
import { supabase } from '../lib/supabase'

function withDefaults(company: CompanySettings): CompanySettings {
  return {
    ...company,
    name: company.name || 'BLP Construction',
    ownerName: company.ownerName || 'Swapnil Pandey',
    phone: company.phone || '9359022700',
    email: company.email || 'blpconstruction55@gmail.com',
    address:
      company.address && !/dehradun/i.test(company.address)
        ? company.address
        : 'Belsari, Takhatpur, Bilaspur, Chhattisgarh – 495330',
    bankAccountHolder:
      company.bankAccountHolder || 'B L P CONSTRUCTION',
    bankAccountNumber:
      company.bankAccountNumber || '50200090912797',
    bankIfsc: company.bankIfsc || 'HDFC0004485',
    paymentTerms: company.paymentTerms || 'Due on receipt',
  }
}

export function CompanySettingsForm({
  company,
  onSaved,
}: {
  company: CompanySettings
  onSaved: (company: CompanySettings) => void
}) {
  const [form, setForm] = useState<CompanySettings>(() => withDefaults(company))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const seededCompanyId = useRef(company.id)

  useEffect(() => {
    if (company.id === seededCompanyId.current) return
    seededCompanyId.current = company.id
    setForm(withDefaults(company))
  }, [company])

  const set = (key: keyof CompanySettings, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')

    try {
      await companyRepository.update(company.id, form)
      setMessage('Company details saved successfully.')
      onSaved(form)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save company details.',
      )
    } finally {
      setSaving(false)
    }
  }

  const signOut = async () => {
    setError('')
    const { error } = await supabase.auth.signOut()

    if (error) {
      setError('Could not sign out. Please try again.')
      return
    }

    window.location.href = '/'
  }

  const uploadSignature = async (file?: File) => {
    if (!file) return

    setError('')

    try {
      const path = await companyRepository.uploadAsset(
        company.id,
        'signature',
        file,
      )

      const next = {
        ...form,
        signaturePath: path,
      }

      setForm(next)
      onSaved(next)
      setMessage('Authorized signature uploaded.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Signature upload failed.',
      )
    }
  }

  return (
    <section className="settings-workspace">
      <div className="settings-heading">
        <span className="section-kicker">
          COMPANY PROFILE / BILLING CONTROL
        </span>

        <h2>Company Settings</h2>

        <p>
          These details are used automatically on invoices and payment
          documents.
        </p>
      </div>

      <form className="settings-form" onSubmit={save}>
        <label>
          Company Name
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </label>

        <label>
          Owner / Authorized Person
          <input
            value={form.ownerName}
            onChange={(e) => set('ownerName', e.target.value)}
          />
        </label>

        <label>
          Phone
          <input
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
        </label>

        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </label>

        <label className="wide">
          Business Address
          <textarea
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
          />
        </label>

        <label>
          GSTIN
          <input
            value={form.gstin}
            onChange={(e) => set('gstin', e.target.value)}
            placeholder="Enter GSTIN"
          />
        </label>

        <label>
          Website
          <input
            value={form.website}
            onChange={(e) => set('website', e.target.value)}
          />
        </label>

        <div className="settings-divider wide">
          <span>BANK / PAYMENT DETAILS</span>
        </div>

        <label>
          Bank Name
          <input
            value={form.bankName}
            onChange={(e) => set('bankName', e.target.value)}
            placeholder="Enter bank name"
          />
        </label>

        <label>
          Account Holder
          <input
            value={form.bankAccountHolder}
            onChange={(e) =>
              set('bankAccountHolder', e.target.value)
            }
          />
        </label>

        <label>
          Bank Account Number
          <input
            value={form.bankAccountNumber}
            onChange={(e) =>
              set('bankAccountNumber', e.target.value)
            }
          />
        </label>

        <label>
          IFSC Code
          <input
            value={form.bankIfsc}
            onChange={(e) => set('bankIfsc', e.target.value)}
          />
        </label>

        <label>
          UPI ID
          <input
            value={form.upiId}
            onChange={(e) => set('upiId', e.target.value)}
            placeholder="Enter UPI ID"
          />
        </label>

        <div className="settings-divider wide">
          <span>INVOICE SETTINGS</span>
        </div>

        <label>
          Payment Terms
          <input
            value={form.paymentTerms}
            onChange={(e) => set('paymentTerms', e.target.value)}
          />
        </label>

        <label className="wide">
          Invoice Terms
          <textarea
            value={form.invoiceTerms}
            onChange={(e) => set('invoiceTerms', e.target.value)}
          />
        </label>

        <div className="settings-divider wide">
          <span>AUTHORIZED SIGNATURE</span>
        </div>

        <label className="wide">
          Upload Signature
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) =>
              void uploadSignature(e.target.files?.[0])
            }
          />
        </label>

        <div className="settings-divider wide">
          <span>COMPANY STAMP</span>
        </div>

        <div className="asset-empty wide">
          Company stamp image is intentionally not uploaded.
          <br />
          The invoice will keep a blank stamp area for the physical
          company stamp.
        </div>

        <div className="settings-actions wide">
          <button
            className="button primary"
            disabled={saving}
            type="submit"
          >
            {saving ? 'Saving...' : 'Save Company Details'}
          </button>

          <button
            className="button secondary"
            type="button"
            onClick={() => void signOut()}
          >
            Sign Out
          </button>

          {message && (
            <span className="settings-success">{message}</span>
          )}

          {error && (
            <span className="auth-error">{error}</span>
          )}
        </div>
      </form>
    </section>
  )
}
