import { supabase } from '../lib/supabase'

import { useEffect, useState } from 'react'
import type { DashboardData } from '../services/repository'
import { formatCurrency, formatDate } from '../services/storageService'
import './invoice.css'

function amountWords(value: number) {
  if (!value) return 'Zero'
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const underThousand = (number: number): string => number < 20 ? ones[number] : number < 100 ? `${tens[Math.floor(number / 10)]} ${ones[number % 10]}`.trim() : `${ones[Math.floor(number / 100)]} Hundred ${underThousand(number % 100)}`.trim()
  let number = Math.round(value)
  const parts: string[] = []
  if (number >= 10000000) { parts.push(`${underThousand(Math.floor(number / 10000000))} Crore`); number %= 10000000 }
  if (number >= 100000) { parts.push(`${underThousand(Math.floor(number / 100000))} Lakh`); number %= 100000 }
  if (number >= 1000) { parts.push(`${underThousand(Math.floor(number / 1000))} Thousand`); number %= 1000 }
  if (number) parts.push(underThousand(number))
  return parts.join(' ')
}

export function InvoiceWorkspace({ data }: { data: DashboardData }) {
  const [selectedId, setSelectedId] = useState(data.invoices[0]?.id || '')
  const [signatureUrl, setSignatureUrl] = useState('')

  const invoice = data.invoices.find((item) => item.id === selectedId)
  const customer = invoice
    ? data.customers.find((item) => item.id === invoice.customerId) || data.customers.find((item) => item.name === invoice.customer)
    : undefined

  useEffect(() => {
    let active = true

    const loadSignature = async () => {
      setSignatureUrl('')

      if (!data.company.signaturePath) return

      const { data: signed, error } = await supabase.storage
        .from('company-documents')
        .createSignedUrl(data.company.signaturePath, 60 * 60)

      if (!error && signed?.signedUrl && active) {
        setSignatureUrl(signed.signedUrl)
      }
    }

    void loadSignature()

    return () => {
      active = false
    }
  }, [data.company.signaturePath])

  return (
    <section className="invoice-workspace">
      <div className="invoice-toolbar">
        <div>
          <span className="section-kicker">BILLING DOCUMENTS / INVOICES</span>
          <h2>Professional invoice</h2>
          <p>Print-ready A4 document generated from company records.</p>
        </div>

        <div className="invoice-actions">
          <select
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            <option value="">Select invoice</option>
            {data.invoices.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id}
              </option>
            ))}
          </select>

          <button
            className="button primary"
            disabled={!invoice}
            onClick={() => window.print()}
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      {invoice ? (
        <InvoiceDocument
          invoice={invoice}
          customer={customer}
          company={data.company}
          signatureUrl={signatureUrl}
        />
      ) : (
        <div className="invoice-empty">
          <strong>NO INVOICES CREATED</strong>
          <p>Create your first invoice to preview a customer-ready bill.</p>
        </div>
      )}
    </section>
  )
}

function InvoiceDocument({ invoice, customer, company, signatureUrl }: { invoice: DashboardData['invoices'][number]; customer?: DashboardData['customers'][number]; company: DashboardData['company']; signatureUrl: string }) { const tax = Math.max(0, invoice.total - invoice.taxable); const cgst = tax / 2; const sgst = tax / 2; return <article className="invoice-document"><header className="invoice-doc-header"><div><div className="invoice-brand"><span>BLP</span><div><strong>{company.name.toUpperCase()}</strong><small>Construction • Transportation • Earthmoving</small></div></div><p>{company.address || 'Address configured in Settings'}<br />Phone: {company.phone || 'Not configured'} · Email: {company.email || 'Not configured'}<br />GSTIN: {company.gstin || 'Not configured'}</p></div><div className="tax-invoice"><strong>TAX INVOICE</strong><dl><div><dt>Invoice No.</dt><dd>{invoice.id}</dd></div><div><dt>Invoice Date</dt><dd>{formatDate(invoice.date)}</dd></div><div><dt>Due Date</dt><dd>{company.paymentTerms}</dd></div></dl></div></header><div className="invoice-rule" /><section className="invoice-parties"><div><span>BILL TO</span><strong>{customer?.name || invoice.customer}</strong><p>{customer?.phone || 'Customer phone not configured'}<br />GSTIN: {customer?.gstin || 'Unregistered customer'}</p></div><div><span>PAYMENT TERMS</span><strong>{company.paymentTerms}</strong><p>Place of supply: Chhattisgarh<br />Reverse charge: No</p></div></section><table className="invoice-items"><thead><tr><th>S.No.</th><th>Description</th><th>SAC</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Taxable amount</th></tr></thead><tbody><tr><td>1</td><td>Transportation and fleet service</td><td>9965</td><td>1</td><td>Service</td><td>{formatCurrency(invoice.taxable)}</td><td>{formatCurrency(invoice.taxable)}</td></tr></tbody></table><section className="invoice-bottom"><div className="invoice-notes"><strong>Amount in words</strong><p>Rupees {amountWords(invoice.total)} Only</p><strong>PAYMENT DETAILS</strong><p>Account Holder: {company.bankAccountHolder || 'Not configured'}<br />Bank Account No: {company.bankAccountNumber || 'Not configured'}<br />IFSC: {company.bankIfsc || 'Not configured'}<br />Phone: {company.phone || 'Not configured'}<br />Email: {company.email || 'Not configured'}<br />Payment Methods: UPI / Bank Transfer / Cash / Cheque</p><strong>Terms &amp; conditions</strong><p>{company.invoiceTerms || 'Payment is due according to the agreed terms. Please quote the invoice number with payment.'}</p><div className="stamp-slot">COMPANY STAMP</div></div><div className="invoice-totals"><div><span>Subtotal</span><b>{formatCurrency(invoice.taxable)}</b></div>{tax > 0 ? <><div><span>GST @ {invoice.gstRate}%</span><b>{formatCurrency(tax)}</b></div><div><span>CGST</span><b>{formatCurrency(cgst)}</b></div><div><span>SGST</span><b>{formatCurrency(sgst)}</b></div></> : <div><span>GST</span><b>Non-GST invoice</b></div>}<div className="grand-total"><span>GRAND TOTAL</span><b>{formatCurrency(invoice.total)}</b></div><div><span>Amount paid</span><b>{formatCurrency(invoice.paid)}</b></div><div><span>Balance due</span><b>{formatCurrency(invoice.total - invoice.paid)}</b></div></div></section><footer className="invoice-doc-footer"><div><strong>Bank transfer details</strong><p>Account Holder: {company.bankAccountHolder || 'Not configured'}<br />Account No: {company.bankAccountNumber || 'Not configured'}<br />IFSC: {company.bankIfsc || 'Not configured'}</p></div><div className="signature"><div className="signature-slot">
  {signatureUrl ? (
    <img
      src={signatureUrl}
      alt="Authorized signature"
      className="invoice-signature-image"
    />
  ) : (
    <span>SIGNATURE</span>
  )}
</div><strong>For {company.name}</strong><span>{company.ownerName || 'Owner / Authorized Signatory'}</span><small>Owner / Authorized Signatory</small></div></footer><div className="invoice-thanks">Thank you for your business.</div></article> }
