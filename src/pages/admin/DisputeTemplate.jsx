/**
 * DisputeTemplate — Admin-only page at /admin/dispute-template
 *
 * Pre-filled dispute response text for submitting to Stripe when fighting
 * a chargeback. Admin fills in the charge-specific fields at the top,
 * then copies the generated evidence block directly into Stripe's dispute form.
 */
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../lib/OrgContext'
import toast from 'react-hot-toast'

const GREEN = '#1B4332'
const RED   = '#7f1d1d'

function Field({ label, value }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-400 font-medium sm:w-44 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-800 font-medium break-all">{value || '—'}</span>
    </div>
  )
}

export default function DisputeTemplate() {
  const { user } = useAuth()
  const org = useOrg()

  // Admin fills these in from the Stripe alert email
  const [disputeId,    setDisputeId]    = useState('')
  const [chargeId,     setChargeId]     = useState('')
  const [amount,       setAmount]       = useState('')
  const [reason,       setReason]       = useState('subscription_canceled')
  const [chargeDate,   setChargeDate]   = useState('')
  const [customerEmail,setCustomerEmail]= useState('')
  const [deadline,     setDeadline]     = useState('')
  const [copied,       setCopied]       = useState(false)

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  const orgName = org?.name ?? 'Scorify Golf Customer'
  const orgId   = org?.id   ?? '[org-id]'

  const REASON_LABELS: Record<string, string> = {
    subscription_canceled:  'Subscription Canceled',
    credit_not_processed:   'Credit Not Processed',
    duplicate:              'Duplicate Charge',
    fraudulent:             'Fraudulent',
    general:                'General',
    product_not_received:   'Product Not Received',
    product_unacceptable:   'Product Unacceptable',
    unrecognized:           'Unrecognized Charge',
  }

  const evidenceText = `
DISPUTE RESPONSE — SCORIFY GOLF
Prepared: ${today}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MERCHANT INFORMATION
Business Name:    Scorify Golf
Website:          https://scorifygolf.com
Contact Email:    admin@scorifygolf.com
Business Type:    SaaS — Golf League Management Platform

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRANSACTION DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Dispute ID:       ${disputeId || '[enter dispute ID]'}
Charge ID:        ${chargeId  || '[enter charge ID]'}
Amount Disputed:  ${amount    || '[enter amount]'}
Charge Date:      ${chargeDate || '[enter charge date]'}
Customer Email:   ${customerEmail || '[enter customer email]'}
Reason Filed:     ${REASON_LABELS[reason] ?? reason}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVIDENCE OF SERVICE DELIVERY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Scorify Golf is a web-based software service. Delivery of service is
confirmed by the following evidence, all of which is recorded in our
verified system audit logs:

1. ACCOUNT CREATION — The customer's account was created and activated
   on the date of signup. This is recorded in our authentication system
   (Supabase Auth) with a timestamped user record and confirmed via
   email delivery through Resend.

2. ACTIVE USAGE — Our security and activity logs record the customer's
   authenticated sessions, including login timestamps, IP addresses,
   browser agent, and pages accessed. These logs confirm the Service
   was accessed and used after the charge date.

3. ORGANIZATION RECORD — The customer's organization is active in our
   database:
   Organization Name: ${orgName}
   Organization ID:   ${orgId}
   This record was created at account setup and includes all league,
   player, event, and scoring data entered by the customer.

4. SUBSCRIPTION ACTIVATION — Our Stripe webhook logs confirm that
   upon successful payment, the customer's account tier was updated
   in our database and full feature access was granted immediately.

5. NO REPORTED ISSUES — Our support inbox (admin@scorifygolf.com)
   and security event logs contain no support requests, bug reports,
   or complaints from this customer prior to the dispute being filed.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REFUND POLICY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Our published Refund Policy is available at:
https://scorifygolf.com/refund-policy

Key terms applicable to this charge:
• All plans include a 3-day free trial before billing begins.
• Monthly subscriptions are non-refundable once a billing period begins,
  except in cases of verified software malfunction.
• Annual subscriptions qualify for a 50% prorated refund if cancelled
  within 3 months of the charge date.
• Accidental purchase refunds are honored within 24 hours of the charge.
• The customer did not contact us to request a refund before filing this
  dispute. Had they contacted us, we would have reviewed our audit logs
  and responded within 2 business days per our published policy.

The charge subject to this dispute falls outside the refund window
and/or the customer did not contact us prior to filing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADDITIONAL DOCUMENTATION (ATTACH TO DISPUTE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The following should be attached as screenshots or exports:

[ ] Screenshot of Stripe charge details showing amount, date, customer
[ ] Screenshot of customer's active organization in Scorify Golf admin
[ ] Screenshot of security_log table filtered to this customer's org_id
    showing login events and activity after the charge date
[ ] Screenshot of published Refund Policy at scorifygolf.com/refund-policy
[ ] Email confirmation sent to customer at time of signup (from Resend logs)
[ ] Screenshot of Stripe subscription showing trial end and billing start

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DECLARATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

I declare that the information provided in this response is accurate
and complete to the best of my knowledge. The service was delivered as
described, the charge was legitimate, and the customer had access to
and used the Service after the charge date.

Submitted by: Scorify Golf (admin@scorifygolf.com)
Date: ${today}
`.trim()

  function copyToClipboard() {
    navigator.clipboard.writeText(evidenceText).then(() => {
      setCopied(true)
      toast.success('Evidence text copied to clipboard')
      setTimeout(() => setCopied(false), 3000)
    })
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full text-white" style={{ background: RED }}>
            Dispute Response
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Chargeback Response Template</h1>
        <p className="text-sm text-gray-500 mt-1">
          Fill in the dispute details from your Stripe alert email, then copy the evidence block
          and paste it into Stripe's dispute response form.
        </p>
      </div>

      {/* Alert box */}
      <div className="rounded-xl px-5 py-4 text-sm" style={{ background: '#fff7f7', border: '1px solid #fecaca' }}>
        <p className="font-semibold mb-1" style={{ color: RED }}>Before submitting to Stripe</p>
        <ol className="list-decimal pl-5 space-y-1 text-gray-700">
          <li>Open the dispute in your <a href="https://dashboard.stripe.com/disputes" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: GREEN }}>Stripe Dashboard</a></li>
          <li>Fill in the fields below from the dispute details</li>
          <li>Copy the generated evidence text and paste into Stripe's "Additional information" field</li>
          <li>Attach the screenshots listed at the bottom of the evidence block</li>
          <li>Submit before the deadline shown in your alert email</li>
        </ol>
      </div>

      {/* Step 1: Fill in dispute details */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Step 1 — Enter Dispute Details</h2>
          <p className="text-xs text-gray-400 mt-0.5">From your Stripe alert email or the Stripe dashboard</p>
        </div>
        <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Dispute ID</label>
            <input className="input font-mono text-xs" placeholder="dp_1abc..." value={disputeId} onChange={e => setDisputeId(e.target.value)} />
          </div>
          <div>
            <label className="label">Charge ID</label>
            <input className="input font-mono text-xs" placeholder="ch_1abc..." value={chargeId} onChange={e => setChargeId(e.target.value)} />
          </div>
          <div>
            <label className="label">Amount Disputed</label>
            <input className="input" placeholder="$29.00" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="label">Original Charge Date</label>
            <input className="input" type="date" value={chargeDate} onChange={e => setChargeDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Customer Email</label>
            <input className="input" type="email" placeholder="customer@email.com" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Dispute Reason</label>
            <select className="input bg-white" value={reason} onChange={e => setReason(e.target.value)}>
              <option value="subscription_canceled">Subscription Canceled</option>
              <option value="credit_not_processed">Credit Not Processed</option>
              <option value="duplicate">Duplicate Charge</option>
              <option value="fraudulent">Fraudulent</option>
              <option value="product_not_received">Product Not Received</option>
              <option value="product_unacceptable">Product Unacceptable</option>
              <option value="unrecognized">Unrecognized Charge</option>
              <option value="general">General</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Evidence Submission Deadline</label>
            <input className="input" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Step 2: Auto-populated account evidence */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Step 2 — Verify Account Evidence</h2>
          <p className="text-xs text-gray-400 mt-0.5">Auto-populated from your Scorify Golf account</p>
        </div>
        <div className="px-6 py-2 divide-y divide-gray-50">
          <Field label="Organization" value={org?.name} />
          <Field label="Organization ID" value={org?.id} />
          <Field label="Subscription Tier" value={org?.tier} />
          <Field label="Admin Account" value={user?.email} />
          <Field label="Refund Policy URL" value="scorifygolf.com/refund-policy" />
          <Field label="Support Email" value="admin@scorifygolf.com" />
        </div>
        <div className="px-6 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            To pull security logs for this dispute, go to your{' '}
            <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: GREEN }}>
              Supabase Dashboard
            </a>{' '}
            → Table Editor → <code className="bg-gray-100 px-1 rounded text-xs">security_log</code> → filter by <code className="bg-gray-100 px-1 rounded text-xs">org_id</code>.
          </p>
        </div>
      </div>

      {/* Step 3: Generated evidence text */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Step 3 — Copy Evidence Text</h2>
            <p className="text-xs text-gray-400 mt-0.5">Paste this into Stripe's "Additional information" field</p>
          </div>
          <button
            onClick={copyToClipboard}
            className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: copied ? '#16a34a' : GREEN }}
          >
            {copied ? '✓ Copied' : 'Copy Text'}
          </button>
        </div>
        <div className="px-6 py-4">
          <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono text-gray-700 bg-gray-50 rounded-xl p-4 overflow-x-auto" style={{ maxHeight: 400 }}>
            {evidenceText}
          </pre>
        </div>
      </div>

      {/* Step 4: Checklist */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Step 4 — Screenshot Checklist</h2>
          <p className="text-xs text-gray-400 mt-0.5">Attach these to the Stripe dispute form</p>
        </div>
        <ul className="px-6 py-4 space-y-3">
          {[
            { item: 'Stripe charge details', detail: 'Stripe Dashboard → Payments → find charge → screenshot showing amount, date, customer email' },
            { item: 'Customer org in admin', detail: 'Scorify Golf admin → Settings — shows org is active with subscription tier' },
            { item: 'Security log activity', detail: 'Supabase → security_log filtered by org_id — shows login events after charge date' },
            { item: 'Refund policy page', detail: 'Screenshot of scorifygolf.com/refund-policy with date visible' },
            { item: 'Signup confirmation email', detail: 'Resend dashboard → Emails — find welcome/confirmation email sent to customer' },
            { item: 'Stripe subscription record', detail: 'Stripe → Subscriptions — shows trial end date and first billing date' },
          ].map(({ item, detail }) => (
            <li key={item} className="flex items-start gap-3">
              <input type="checkbox" className="mt-0.5 shrink-0 rounded" />
              <div>
                <p className="text-sm font-medium text-gray-800">{item}</p>
                <p className="text-xs text-gray-400 mt-0.5">{detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-center text-gray-400 pb-6">
        Questions? Email <a href="mailto:admin@scorifygolf.com" className="underline">admin@scorifygolf.com</a>
      </p>
    </div>
  )
}
