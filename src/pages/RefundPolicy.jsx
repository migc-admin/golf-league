import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Footer from '../components/ui/Footer'

const GREEN = '#1B4332'
const INK   = '#1d1d1f'

function Section({ title, children }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold mb-3" style={{ color: INK }}>{title}</h2>
      <div className="text-sm leading-relaxed space-y-3" style={{ color: '#374151' }}>
        {children}
      </div>
    </section>
  )
}

function Callout({ children }) {
  return (
    <div className="rounded-xl px-4 py-3 text-sm leading-relaxed" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>
      {children}
    </div>
  )
}

export default function RefundPolicy() {
  return (
    <>
      <Helmet>
        <title>Refund Policy — Scorify Golf</title>
        <meta name="description" content="Scorify Golf refund and cancellation policy for monthly, annual, and one-time subscriptions." />
      </Helmet>

      {/* Nav */}
      <header style={{ background: GREEN }} className="px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/home" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L10.5 5.5H15L11.5 8.5L13 13L8 10L3 13L4.5 8.5L1 5.5H5.5L8 1Z" fill="#ffffff" />
              </svg>
            </div>
            <span className="font-bold text-white text-lg" style={{ letterSpacing: '-0.02em' }}>Scorify Golf</span>
          </Link>
          <Link to="/home" className="text-sm font-medium text-white opacity-80 hover:opacity-100 transition-opacity">
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div style={{ background: GREEN }} className="px-6 pt-12 pb-16 text-center text-white">
        <h1 className="text-4xl font-bold mb-3" style={{ letterSpacing: '-0.03em' }}>Refund Policy</h1>
        <p className="text-sm opacity-70">Effective date: July 21, 2026 &nbsp;·&nbsp; Last updated: July 21, 2026</p>
      </div>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-14">

        <p className="text-sm leading-relaxed mb-10" style={{ color: '#374151' }}>
          This Refund Policy applies to all subscriptions and purchases made through Scorify Golf
          at <a href="https://scorifygolf.com" className="underline" style={{ color: GREEN }}>scorifygolf.com</a>.
          By purchasing a plan, you agree to the terms below. Questions? Email{' '}
          <a href="mailto:admin@scorifygolf.com" className="underline" style={{ color: GREEN }}>admin@scorifygolf.com</a>.
        </p>

        {/* ── 1. Free Trial ── */}
        <Section title="1. Free Trial">
          <Callout>
            All paid plans include a <strong>3-day free trial</strong>. You will not be charged during the trial period.
            You may cancel at any time during the trial at no cost.
          </Callout>
          <p>
            If you do not cancel before the trial ends, your subscription will automatically convert to a paid plan
            and you will be billed at the rate for your selected plan and billing cycle. The trial period is available
            once per organization.
          </p>
        </Section>

        {/* ── 2. Plan Types ── */}
        <Section title="2. Plan Types">
          <p>Scorify Golf offers three billing options:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Monthly subscription</strong> — billed each month on the anniversary of your start date</li>
            <li><strong>Annual subscription</strong> — billed once per year at a discounted rate</li>
            <li><strong>One-time purchase</strong> — a single charge for a specific product or add-on; not a recurring subscription</li>
          </ul>
          <p>
            The terms below apply to each plan type as specified. Where a term does not specify a plan type,
            it applies to all.
          </p>
        </Section>

        {/* ── 3. Cancellation ── */}
        <Section title="3. Cancellation">
          <p>
            You may cancel your subscription at any time through the billing portal in your account settings
            or by contacting us at{' '}
            <a href="mailto:admin@scorifygolf.com" className="underline" style={{ color: GREEN }}>admin@scorifygolf.com</a>.
          </p>
          <p>
            <strong>Upon cancellation:</strong>
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Your account will remain active and fully functional through the end of your current paid billing period.
              No partial refund is issued for the remaining days in your billing period.
            </li>
            <li>
              After your billing period ends, your account will be downgraded. Your data (leagues, players, events,
              scores) is retained and held for reactivation but will <strong>not be accessible</strong> until you
              reactivate an active subscription.
            </li>
            <li>
              One-time purchases are not subject to recurring cancellation and access terms are determined at
              the time of purchase.
            </li>
          </ul>
        </Section>

        {/* ── 4. Refunds ── */}
        <Section title="4. Refunds">

          <p className="font-semibold" style={{ color: INK }}>4a. Accidental Purchase — 24-Hour Window</p>
          <p>
            If you were charged in error or did not intend to start a subscription, you may request a full refund
            within <strong>24 hours</strong> of the charge. Contact us at{' '}
            <a href="mailto:admin@scorifygolf.com" className="underline" style={{ color: GREEN }}>admin@scorifygolf.com</a>{' '}
            with your account email and the date of the charge. Refunds requested after 24 hours are subject to the
            terms below.
          </p>

          <p className="font-semibold mt-4" style={{ color: INK }}>4b. Monthly Subscriptions</p>
          <p>
            Monthly subscriptions are generally non-refundable once a billing cycle has begun. Exceptions are made
            in cases where the Service did not perform as documented — see Section 5.
          </p>

          <p className="font-semibold mt-4" style={{ color: INK }}>4c. Annual Subscriptions — Prorated Refund Within 3 Months</p>
          <p>
            If you subscribed to an annual plan and wish to cancel within the first <strong>3 months</strong> of
            your subscription (not counting any trial period), you may request a prorated refund calculated as follows:
          </p>
          <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#e5e7eb' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th className="text-left px-4 py-2.5 font-semibold" style={{ color: INK }}>Time Since Annual Charge</th>
                  <th className="text-left px-4 py-2.5 font-semibold" style={{ color: INK }}>Refund Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#f3f4f6' }}>
                <tr>
                  <td className="px-4 py-2.5">Within 24 hours</td>
                  <td className="px-4 py-2.5 font-semibold" style={{ color: GREEN }}>100% (accidental purchase)</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5">24 hours – 3 months</td>
                  <td className="px-4 py-2.5 font-semibold" style={{ color: GREEN }}>50% of annual price paid</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5">After 3 months</td>
                  <td className="px-4 py-2.5 text-gray-500">No refund</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Upon a prorated refund, your subscription will be cancelled immediately and your data will be held
            in an inactive state (see Section 3). No further charges will be made.
          </p>

          <p className="font-semibold mt-4" style={{ color: INK }}>4d. One-Time Purchases</p>
          <p>
            One-time purchases are non-refundable except within the 24-hour accidental purchase window (Section 4a)
            or in cases where the Service did not perform as documented (Section 5).
          </p>
        </Section>

        {/* ── 5. Software Performance ── */}
        <Section title="5. Refunds for Software Issues or Outages">
          <p>
            We stand behind our product. If Scorify Golf does not perform as documented — including significant
            bugs, data errors, or service outages — you may be eligible for a refund or account credit regardless
            of the standard terms above.
          </p>
          <p>
            <strong>How we evaluate these requests:</strong> All refund requests related to software performance
            are reviewed against our internal audit logs, which record system activity, error events, security logs,
            and usage data. This allows us to verify whether a reported issue occurred, its scope, and its impact
            on your account.
          </p>
          <p>
            We do not issue refunds for issues that our audit logs show did not occur, for user error, or for
            features that are not part of your subscribed plan.
          </p>
          <p>
            <strong>To request a performance-related refund:</strong> Email{' '}
            <a href="mailto:admin@scorifygolf.com" className="underline" style={{ color: GREEN }}>admin@scorifygolf.com</a>{' '}
            with:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Your account email</li>
            <li>A description of the issue, including the date(s) it occurred</li>
            <li>Any screenshots or details that help identify the problem</li>
          </ul>
          <p>
            We will review the request against our audit records and respond within <strong>5 business days</strong>.
            Approved refunds are issued to the original payment method within 5–10 business days depending on your bank.
          </p>
        </Section>

        {/* ── 6. Chargebacks ── */}
        <Section title="6. Payment Disputes and Chargebacks">
          <p>
            A chargeback is a reversal of a charge initiated by your bank or credit card issuer, bypassing our
            refund process. Before initiating a chargeback, we strongly encourage you to contact us directly at{' '}
            <a href="mailto:admin@scorifygolf.com" className="underline" style={{ color: GREEN }}>admin@scorifygolf.com</a>{' '}
            so we can resolve the issue promptly — most disputes are resolved faster this way.
          </p>
          <p>
            <strong>For chargebacks filed with your bank:</strong> We will respond to all disputes with documented
            evidence including transaction records, account activity logs, service delivery confirmation, and
            this published refund policy. Our evidence is drawn from verified system audit logs.
          </p>
          <p>
            If a chargeback is filed for a charge that falls within our refund policy terms above, we will
            accept the reversal. If a chargeback is filed for a legitimate charge not covered by our refund
            policy, we will contest it with the above evidence.
          </p>
          <p>
            Accounts with an open chargeback dispute may have access suspended pending resolution.
          </p>
        </Section>

        {/* ── 7. How to Request ── */}
        <Section title="7. How to Request a Refund">
          <p>All refund requests must be submitted by email to:</p>
          <div className="rounded-xl px-4 py-3 not-italic text-sm leading-relaxed" style={{ background: '#f9fafb', border: '1px solid #e5e7eb', color: '#374151' }}>
            <strong>Scorify Golf — Billing Support</strong><br />
            <a href="mailto:admin@scorifygolf.com" className="underline" style={{ color: GREEN }}>admin@scorifygolf.com</a>
          </div>
          <p>Please include your account email, the charge date, and the reason for your request. We respond to
          all billing inquiries within <strong>2 business days</strong>.</p>
        </Section>

        {/* ── 8. Changes ── */}
        <Section title="8. Changes to This Policy">
          <p>
            We may update this Refund Policy from time to time. When we do, we will update the "Last updated"
            date at the top of this page. Changes apply to purchases made after the effective date.
            Purchases made before a policy change are governed by the policy in effect at the time of purchase.
          </p>
        </Section>

        <div className="mt-12 pt-8 border-t text-xs" style={{ color: '#9ca3af', borderColor: '#e5e7eb' }}>
          <Link to="/privacy" className="underline mr-4" style={{ color: '#9ca3af' }}>Privacy Policy</Link>
          <Link to="/faq"     className="underline mr-4" style={{ color: '#9ca3af' }}>FAQ</Link>
          <a href="mailto:admin@scorifygolf.com" className="underline" style={{ color: '#9ca3af' }}>Contact</a>
        </div>
      </main>

      <Footer />
    </>
  )
}
