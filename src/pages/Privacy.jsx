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

function SubSection({ title, children }) {
  return (
    <div className="mt-4">
      <h3 className="font-semibold mb-1" style={{ color: INK }}>{title}</h3>
      {children}
    </div>
  )
}

export default function Privacy() {
  return (
    <>
      <Helmet>
        <title>Privacy Policy — Scorify Golf</title>
        <meta name="description" content="Scorify Golf privacy policy — how we collect, use, and protect your personal information under CCPA, CPRA, and applicable US state laws." />
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
        <h1 className="text-4xl font-bold mb-3" style={{ letterSpacing: '-0.03em' }}>Privacy Policy</h1>
        <p className="text-sm opacity-70">Effective date: July 20, 2026 &nbsp;·&nbsp; Last updated: July 20, 2026</p>
      </div>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-14">

        <p className="text-sm leading-relaxed mb-10" style={{ color: '#374151' }}>
          Scorify Golf ("we," "us," or "our") operates the Scorify Golf web application at{' '}
          <a href="https://scorifygolf.com" className="underline" style={{ color: GREEN }}>scorifygolf.com</a>{' '}
          (the "Service"). This Privacy Policy describes how we collect, use, disclose, and protect personal
          information, and explains your rights under the California Consumer Privacy Act (CCPA), the
          California Privacy Rights Act (CPRA), and other applicable U.S. state privacy laws.
        </p>

        {/* ── 1. Scope ── */}
        <Section title="1. Scope and Who This Policy Applies To">
          <p>
            This Policy applies to all visitors, administrators, players, and any other individuals whose
            personal information is processed through the Service, regardless of where they are located.
            Scorify Golf is operated from California, United States.
          </p>
          <p>
            The Service is not directed at children under 13. We do not knowingly collect personal information
            from children under 13. If you believe we have inadvertently collected such information, contact
            us at{' '}
            <a href="mailto:admin@scorifygolf.com" className="underline" style={{ color: GREEN }}>admin@scorifygolf.com</a>{' '}
            and we will delete it promptly.
          </p>
        </Section>

        {/* ── 2. Categories of PI collected ── */}
        <Section title="2. Personal Information We Collect">
          <p>
            We collect the following categories of personal information, as defined under the CCPA/CPRA.
            Each category is listed with the specific data points we collect in practice:
          </p>

          <SubSection title="A. Identifiers">
            <ul className="list-disc pl-5 space-y-1">
              <li>Name (first and last)</li>
              <li>Email address</li>
              <li>Account username / user ID</li>
              <li>Internet Protocol (IP) address (collected in security logs)</li>
              <li>GHIN number (Golf Handicap and Information Network identifier, if provided)</li>
              <li>Stripe customer ID (assigned when you subscribe)</li>
            </ul>
          </SubSection>

          <SubSection title="B. Account / Commercial Information">
            <ul className="list-disc pl-5 space-y-1">
              <li>Organization name and subscription tier (Free, Pro, or Club)</li>
              <li>Billing plan selections and subscription history</li>
              <li>Payment records (billing amount, date, status — stored by Stripe, not Scorify Golf)</li>
            </ul>
          </SubSection>

          <SubSection title="C. Internet or Other Electronic Network Activity">
            <ul className="list-disc pl-5 space-y-1">
              <li>Authentication session token (stored in browser localStorage — necessary for login)</li>
              <li>Temporary access-code attempt records (stored in browser sessionStorage during a session to prevent brute-force entry)</li>
              <li>Server request logs: IP address, browser user-agent, pages visited, timestamps (retained for security monitoring)</li>
            </ul>
          </SubSection>

          <SubSection title="D. Sport / Activity Data">
            <ul className="list-disc pl-5 space-y-1">
              <li>Golf handicap index and course handicap</li>
              <li>Hole-by-hole gross and net scores per event</li>
              <li>Event pairings, flight assignments, and team selections</li>
              <li>Season standings, leaderboard results, and payout records</li>
            </ul>
          </SubSection>

          <SubSection title="E. Registration and Event Inquiry Data (Public Registration Form)">
            <p>
              When a player or guest self-registers for an event through our public registration page
              (no account required), we collect:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>First and last name</li>
              <li>Email address (optional)</li>
              <li>Guest interest indicator and any notes submitted with the registration</li>
            </ul>
          </SubSection>

          <SubSection title="F. Sensitive Personal Information">
            <p>
              Under CPRA, account login credentials (username + password) qualify as sensitive personal
              information. We do not collect government IDs, financial account numbers, precise geolocation,
              health data, racial or ethnic origin, religious beliefs, or the contents of private communications.
              We do not use sensitive personal information for any purpose other than to provide the Service
              you requested.
            </p>
          </SubSection>

          <SubSection title="G. How We Collect This Information">
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Directly from you:</strong> when you create an account, register for an event, manage your league, or contact us</li>
              <li><strong>From league administrators:</strong> admins may enter player names, email addresses, and handicap data on behalf of their organization</li>
              <li><strong>Automatically:</strong> IP addresses and browser activity are captured in server security logs</li>
              <li><strong>From Stripe:</strong> customer ID and subscription status returned after payment processing</li>
            </ul>
          </SubSection>
        </Section>

        {/* ── 3. Purposes / Use ── */}
        <Section title="3. How We Use Personal Information">
          <p>We collect and use personal information only for the following business purposes:</p>
          <table className="w-full text-xs mt-3 border-collapse">
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                <th className="text-left p-2 border font-semibold" style={{ borderColor: '#e5e7eb' }}>Purpose</th>
                <th className="text-left p-2 border font-semibold" style={{ borderColor: '#e5e7eb' }}>Categories Used</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Provide and operate the Service (scoring, leaderboards, standings, handicaps)', 'Identifiers, Sport/Activity Data'],
                ['Authenticate users and maintain secure login sessions', 'Identifiers, Sensitive PI (credentials), Network Activity'],
                ['Process subscription billing via Stripe', 'Identifiers, Commercial Information'],
                ['Send transactional emails (registration confirmations, daily digest summaries)', 'Identifiers, Registration Data'],
                ['Notify administrators of new player registrations', 'Identifiers, Registration Data'],
                ['Security monitoring: detect abuse, rate-limit sensitive endpoints, investigate anomalies', 'Identifiers, Network Activity'],
                ['Respond to support and privacy requests', 'Identifiers'],
                ['Comply with legal obligations and enforce our Terms', 'Identifiers, Commercial Information'],
              ].map(([purpose, cats]) => (
                <tr key={purpose}>
                  <td className="p-2 border align-top" style={{ borderColor: '#e5e7eb' }}>{purpose}</td>
                  <td className="p-2 border align-top" style={{ borderColor: '#e5e7eb', color: '#6b7280' }}>{cats}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3">
            <strong>We do not sell your personal information.</strong> We do not share your personal information
            with third parties for cross-context behavioral advertising.
          </p>
        </Section>

        {/* ── 4. Disclosure / Sharing ── */}
        <Section title="4. Disclosure of Personal Information">
          <p>
            We disclose personal information only to the following categories of recipients, and only to
            the extent necessary for the stated purpose:
          </p>

          <SubSection title="Service Providers (Sub-processors)">
            <p>These parties process data on our behalf under written data protection agreements:</p>
            <table className="w-full text-xs mt-2 border-collapse">
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th className="text-left p-2 border font-semibold" style={{ borderColor: '#e5e7eb' }}>Provider</th>
                  <th className="text-left p-2 border font-semibold" style={{ borderColor: '#e5e7eb' }}>Purpose</th>
                  <th className="text-left p-2 border font-semibold" style={{ borderColor: '#e5e7eb' }}>Data Shared</th>
                  <th className="text-left p-2 border font-semibold" style={{ borderColor: '#e5e7eb' }}>Region</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Supabase', 'Database hosting & authentication', 'All stored data', 'AWS us-east-1 (USA)'],
                  ['Stripe', 'Payment processing & subscription management', 'Email, org ID; payment card data handled by Stripe directly', 'USA'],
                  ['Resend', 'Transactional email delivery', 'Recipient name, email address, event details', 'USA'],
                  ['Vercel', 'Web application hosting & CDN', 'Request logs (IP, browser)', 'USA / Global CDN'],
                ].map(([p, pu, d, r]) => (
                  <tr key={p}>
                    <td className="p-2 border font-medium align-top" style={{ borderColor: '#e5e7eb' }}>{p}</td>
                    <td className="p-2 border align-top" style={{ borderColor: '#e5e7eb' }}>{pu}</td>
                    <td className="p-2 border align-top" style={{ borderColor: '#e5e7eb', color: '#6b7280' }}>{d}</td>
                    <td className="p-2 border align-top" style={{ borderColor: '#e5e7eb', color: '#6b7280' }}>{r}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SubSection>

          <SubSection title="Public Event Pages">
            <p>
              Leaderboards, standings, and scorecard pages are publicly accessible via shareable links.
              Player names and scores displayed on these pages are visible to anyone with the link.
              League administrators control which events are published and which links are shared.
            </p>
          </SubSection>

          <SubSection title="Within Your Organization">
            <p>
              League administrators within your golf organization can view all player data, scores,
              registrations, and handicaps associated with their organization. Your data is isolated from
              all other organizations on the platform through row-level security controls.
            </p>
          </SubSection>

          <SubSection title="Legal Requirements">
            <p>
              We may disclose personal information if required by law, regulation, court order, or
              governmental authority, or if we believe disclosure is necessary to protect the rights,
              safety, or property of Scorify Golf or others.
            </p>
          </SubSection>

          <SubSection title="Business Transfers">
            <p>
              If Scorify Golf is involved in a merger, acquisition, or asset sale, personal information
              may be transferred as a business asset. We will notify you via email or a prominent notice
              on the Service before your data is transferred and becomes subject to a different privacy policy.
            </p>
          </SubSection>
        </Section>

        {/* ── 5. Cookies ── */}
        <Section title="5. Cookies, Local Storage, and Do Not Track">
          <p>
            <strong>localStorage:</strong> We store your authentication session token in browser localStorage.
            This is strictly necessary for the Service to function (keeping you logged in) and does not
            require your consent.
          </p>
          <p>
            <strong>sessionStorage:</strong> We temporarily store access-code attempt counts in sessionStorage
            during an active browser session to prevent brute-force abuse on event join pages. This data
            is automatically cleared when you close the browser tab.
          </p>
          <p>
            <strong>No advertising or analytics cookies:</strong> We do not use Google Analytics, Facebook
            Pixel, Mixpanel, Hotjar, or any other third-party tracking technology. We do not set advertising
            cookies or track users across other websites.
          </p>
          <p>
            <strong>Do Not Track (DNT):</strong> Some browsers offer a "Do Not Track" signal. Because we
            do not track users across websites for advertising purposes, DNT signals do not change how the
            Service operates for you.
          </p>
        </Section>

        {/* ── 6. Retention ── */}
        <Section title="6. Data Retention">
          <p>
            We retain personal information for as long as your account is active or as needed to provide
            the Service. Specific retention periods:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Account and league data:</strong> Retained while your account is active. Deleted within 30 days of a verified deletion request.</li>
            <li><strong>Billing records:</strong> Retained for 7 years as required by U.S. tax law, even after account deletion.</li>
            <li><strong>Security logs (IP addresses, event logs):</strong> Retained for up to 90 days for security monitoring, then deleted.</li>
            <li><strong>Server access logs:</strong> Retained by Vercel per their data retention policy.</li>
            <li><strong>Public registration submissions:</strong> Retained until the associated event is deleted by the league administrator.</li>
          </ul>
        </Section>

        {/* ── 7. Security ── */}
        <Section title="7. Security">
          <p>We implement the following technical safeguards:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>HTTPS/TLS encryption for all data in transit</li>
            <li>Row-level security (RLS) on all database tables — each organization can only access its own data</li>
            <li>Rate limiting on all sensitive endpoints (login creation, email invites, course search)</li>
            <li>Security event logging to detect unusual patterns (rate limit violations, API errors, authentication failures)</li>
            <li>Passwords are never stored in plaintext — authentication is managed by Supabase with bcrypt hashing</li>
            <li>API keys and secrets are stored server-side only; no credentials are exposed to the browser</li>
          </ul>
          <p>
            No method of transmission or storage is 100% secure. If you believe your account has been
            compromised, contact us immediately at{' '}
            <a href="mailto:admin@scorifygolf.com" className="underline" style={{ color: GREEN }}>admin@scorifygolf.com</a>.
          </p>
        </Section>

        {/* ── 8. California Rights ── */}
        <Section title="8. California Privacy Rights (CCPA / CPRA)">
          <p>
            If you are a California resident, the CCPA and CPRA grant you the following rights with
            respect to your personal information:
          </p>

          <SubSection title="Right to Know">
            <p>
              You have the right to request that we disclose: (a) the categories and specific pieces of
              personal information we have collected about you; (b) the categories of sources from which
              we collected it; (c) the business or commercial purpose for collecting it; and (d) the
              categories of third parties with whom we share it.
            </p>
          </SubSection>

          <SubSection title="Right to Delete">
            <p>
              You have the right to request deletion of personal information we have collected about you,
              subject to certain exceptions (e.g., information needed to complete a transaction, detect
              security incidents, or comply with legal obligations).
            </p>
          </SubSection>

          <SubSection title="Right to Correct">
            <p>
              You have the right to request correction of inaccurate personal information we maintain
              about you. You may also correct most of your own data directly within the Service
              (account settings, player profile).
            </p>
          </SubSection>

          <SubSection title="Right to Opt Out of Sale or Sharing">
            <p>
              <strong>We do not sell your personal information.</strong> We do not share personal
              information with third parties for cross-context behavioral advertising. Therefore,
              there is no sale or sharing to opt out of.
            </p>
          </SubSection>

          <SubSection title="Right to Limit Use of Sensitive Personal Information">
            <p>
              You have the right to limit our use of sensitive personal information (such as your login
              credentials) to what is necessary to perform the Service. We already limit our use of
              sensitive personal information to these purposes and do not use it for any other reason.
            </p>
          </SubSection>

          <SubSection title="Right to Non-Discrimination">
            <p>
              We will not discriminate against you for exercising any of these rights. We will not deny
              you service, charge different prices, or provide a different quality of service because
              you exercised your privacy rights.
            </p>
          </SubSection>

          <SubSection title="How to Submit a Request">
            <p>
              To exercise any of the above rights, submit a verifiable consumer request by:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Email: <a href="mailto:admin@scorifygolf.com" className="underline" style={{ color: GREEN }}>admin@scorifygolf.com</a></li>
            </ul>
            <p className="mt-2">
              We will verify your identity before processing your request. You may submit requests on
              behalf of your minor child. We will respond within <strong>45 days</strong> of receipt.
              If we require additional time (up to 90 days total), we will notify you of the extension
              within the initial 45-day period. We will not charge a fee unless the request is excessive
              or repetitive.
            </p>
            <p>
              You may designate an authorized agent to make a request on your behalf. We will require
              written authorization from you or proof of power of attorney.
            </p>
          </SubSection>

          <SubSection title="Categories of Personal Information Collected in the Past 12 Months">
            <p>For CCPA disclosure purposes, in the past 12 months we have collected:</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Identifiers (name, email, IP address, user ID, GHIN number)</li>
              <li>Commercial information (subscription tier, billing history via Stripe)</li>
              <li>Internet or other electronic network activity (session tokens, server logs)</li>
              <li>Sport and activity data (scores, handicaps, standings)</li>
              <li>Sensitive personal information (account credentials)</li>
            </ul>
            <p className="mt-2">
              We have not sold or shared any of these categories with third parties for commercial
              or advertising purposes.
            </p>
          </SubSection>
        </Section>

        {/* ── 9. Other US States ── */}
        <Section title="9. Other U.S. State Privacy Rights">
          <p>
            Residents of certain U.S. states have privacy rights similar to those described above for
            California residents. The following states have enacted comprehensive consumer privacy laws
            that may apply to you:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Virginia</strong> (VCDPA, effective Jan 1, 2023)</li>
            <li><strong>Colorado</strong> (CPA, effective July 1, 2023)</li>
            <li><strong>Connecticut</strong> (CTDPA, effective July 1, 2023)</li>
            <li><strong>Texas</strong> (TDPSA, effective July 1, 2024)</li>
            <li><strong>Oregon</strong> (OCPA, effective July 1, 2024)</li>
            <li><strong>Montana</strong> (MCDPA, effective Oct 1, 2024)</li>
          </ul>
          <p>
            If you reside in one of these states, you generally have the right to access, correct,
            delete, and obtain a portable copy of your personal data, as well as the right to opt out
            of the sale of your data (which we do not conduct). To exercise these rights, contact us at{' '}
            <a href="mailto:admin@scorifygolf.com" className="underline" style={{ color: GREEN }}>admin@scorifygolf.com</a>.
            We will respond within the timeframe required by your state's law.
          </p>
          <p>
            If we deny your request, you may appeal by contacting us at the same address with the subject
            line "Privacy Request Appeal." We will respond within 60 days.
          </p>
        </Section>

        {/* ── 10. CalOPPA ── */}
        <Section title="10. California Online Privacy Protection Act (CalOPPA)">
          <p>
            In accordance with CalOPPA, we post this Privacy Policy conspicuously and make it accessible
            from all pages of the Service via the footer link. We will notify users of material changes
            to this policy by updating the "Last updated" date.
          </p>
          <p>
            Users may review and update their account information at any time by logging in to the
            Service. To request correction or deletion of personal information, contact us at{' '}
            <a href="mailto:admin@scorifygolf.com" className="underline" style={{ color: GREEN }}>admin@scorifygolf.com</a>.
          </p>
        </Section>

        {/* ── 11. Data of Minors ── */}
        <Section title="11. Children's Privacy (COPPA)">
          <p>
            The Service is not directed at children under 13 years of age, and we do not knowingly
            collect personal information from children under 13. The Service is intended for adult
            golf league administrators and adult players. If you believe a child under 13 has provided
            us with personal information without parental consent, please contact us at{' '}
            <a href="mailto:admin@scorifygolf.com" className="underline" style={{ color: GREEN }}>admin@scorifygolf.com</a>{' '}
            and we will delete it promptly.
          </p>
        </Section>

        {/* ── 12. Changes ── */}
        <Section title="12. Changes to This Policy">
          <p>
            We may update this Privacy Policy periodically to reflect changes in our practices, the
            Service, or applicable law. When we make material changes, we will update the "Last updated"
            date at the top of this page and, where required by law, notify you by email or in-app notice
            at least 30 days before the change takes effect.
          </p>
          <p>
            Continued use of the Service after the effective date of any changes constitutes your
            acceptance of the revised policy.
          </p>
        </Section>

        {/* ── 13. Contact ── */}
        <Section title="13. Contact Us">
          <p>
            For privacy-related questions, requests, or complaints, contact our privacy team:
          </p>
          <address className="not-italic mt-3 text-sm leading-relaxed p-4 rounded-lg" style={{ color: '#374151', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
            <strong>Scorify Golf — Privacy</strong><br />
            Email: <a href="mailto:admin@scorifygolf.com" className="underline" style={{ color: GREEN }}>admin@scorifygolf.com</a>
          </address>
          <p className="mt-3">
            We will acknowledge your request within 10 business days and complete our response within
            the timeframe required by applicable law.
          </p>
        </Section>

        <div className="mt-12 pt-8 border-t text-xs" style={{ color: '#9ca3af', borderColor: '#e5e7eb' }}>
          <Link to="/home" className="underline mr-4" style={{ color: '#9ca3af' }}>Home</Link>
          <Link to="/faq"  className="underline mr-4" style={{ color: '#9ca3af' }}>FAQ</Link>
          <a href="mailto:admin@scorifygolf.com" className="underline" style={{ color: '#9ca3af' }}>Privacy Contact</a>
        </div>
      </main>

      <Footer />
    </>
  )
}
