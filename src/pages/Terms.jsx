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

export default function Terms() {
  return (
    <>
      <Helmet>
        <title>Terms of Service — Scorify Golf</title>
        <meta name="description" content="Scorify Golf terms of service. Read our terms before using the platform." />
        <link rel="canonical" href="https://www.scorifygolf.com/terms" />
      </Helmet>

      <div className="min-h-screen" style={{ background: '#fbfaf8' }}>
        {/* Nav */}
        <header className="sticky top-0 z-50 border-b" style={{ background: '#fbfaf8', borderColor: '#ebe9e4' }}>
          <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="Scorify Golf" className="w-7 h-7 object-contain" loading="lazy" />
              <span className="font-bold text-sm" style={{ color: INK }}>Scorify Golf</span>
            </Link>
            <Link to="/login" className="text-xs font-semibold px-4 py-2 rounded-lg"
              style={{ background: GREEN, color: '#fff' }}>
              Sign in
            </Link>
          </div>
        </header>

        {/* Body */}
        <main className="max-w-3xl mx-auto px-6 py-14">
          <div className="mb-12">
            <h1 className="text-3xl font-bold mb-3" style={{ color: INK, letterSpacing: '-0.03em' }}>
              Terms of Service
            </h1>
            <p className="text-sm" style={{ color: '#6b7280' }}>Last updated: January 1, 2025</p>
          </div>

          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using Scorify Golf ("the Service"), you agree to be bound by these Terms of
              Service ("Terms"). If you do not agree to these Terms, do not use the Service. These Terms
              apply to all visitors, users, and others who access or use the Service.
            </p>
          </Section>

          <Section title="2. Description of Service">
            <p>
              Scorify Golf provides golf league management software including tools for scheduling events,
              tracking scores, managing handicaps, and publishing leaderboards. The Service is intended for
              golf league administrators and players.
            </p>
            <p>
              Scorify Golf does not process payments on your behalf. Any financial transactions between
              league administrators and players (dues, payouts, etc.) are conducted independently using
              third-party services such as Venmo, PayPal, or cash. Scorify Golf is not a party to those
              transactions and accepts no liability for them.
            </p>
          </Section>

          <Section title="3. Account Registration">
            <p>
              To use certain features of the Service, you must create an account. You agree to provide
              accurate, complete, and current information during registration and to keep that information
              updated. You are responsible for maintaining the confidentiality of your account credentials
              and for all activity that occurs under your account.
            </p>
            <p>
              You must be at least 18 years old to create an account. By registering, you represent that
              you meet this requirement.
            </p>
          </Section>

          <Section title="4. Acceptable Use">
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Use the Service for any unlawful purpose or in violation of any regulations</li>
              <li>Attempt to gain unauthorized access to any portion of the Service or its systems</li>
              <li>Upload or transmit viruses or any other malicious code</li>
              <li>Interfere with or disrupt the integrity or performance of the Service</li>
              <li>Collect or harvest any personally identifiable information from the Service</li>
              <li>Use the Service to send unsolicited communications (spam)</li>
              <li>Impersonate any person or entity or misrepresent your affiliation with any person or entity</li>
            </ul>
          </Section>

          <Section title="5. Subscription Plans and Billing">
            <p>
              Scorify Golf offers free and paid subscription plans. Paid plans are billed on a monthly or
              annual basis as selected at the time of purchase. All fees are in US dollars and are
              non-refundable except as expressly stated in our{' '}
              <Link to="/refund-policy" className="underline" style={{ color: GREEN }}>Refund Policy</Link>.
            </p>
            <p>
              We reserve the right to change pricing at any time. If pricing for your plan changes, we will
              provide at least 30 days' notice before the change takes effect. Continued use of the Service
              after the effective date of a pricing change constitutes your acceptance of the new pricing.
            </p>
          </Section>

          <Section title="6. Data and Privacy">
            <p>
              Your use of the Service is also governed by our{' '}
              <Link to="/privacy" className="underline" style={{ color: GREEN }}>Privacy Policy</Link>,
              which is incorporated into these Terms by reference. By using the Service, you consent to
              the collection and use of information as described in that policy.
            </p>
            <p>
              You retain ownership of all data you input into the Service (player information, scores,
              course data, etc.). You grant Scorify Golf a limited license to store and process that data
              solely to provide the Service to you.
            </p>
          </Section>

          <Section title="7. Intellectual Property">
            <p>
              The Service and its original content, features, and functionality are and will remain the
              exclusive property of Scorify Golf and its licensors. Our trademarks and trade dress may not
              be used in connection with any product or service without prior written consent.
            </p>
          </Section>

          <Section title="8. Disclaimers">
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER
              EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY,
              FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. SCORIFY GOLF DOES NOT WARRANT THAT
              THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE.
            </p>
          </Section>

          <Section title="9. Limitation of Liability">
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, SCORIFY GOLF SHALL NOT BE LIABLE FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA,
              OR GOODWILL, ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE, EVEN IF SCORIFY GOLF
              HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p>
              IN NO EVENT SHALL SCORIFY GOLF'S TOTAL LIABILITY TO YOU EXCEED THE AMOUNT YOU PAID TO
              SCORIFY GOLF IN THE TWELVE MONTHS PRECEDING THE CLAIM.
            </p>
          </Section>

          <Section title="10. Termination">
            <p>
              We may terminate or suspend your account and access to the Service at our sole discretion,
              without notice, for conduct that we believe violates these Terms or is harmful to other users,
              us, third parties, or for any other reason.
            </p>
            <p>
              You may cancel your account at any time from your account settings. Upon termination, your
              right to use the Service will immediately cease.
            </p>
          </Section>

          <Section title="11. Governing Law">
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the United
              States, without regard to its conflict of law provisions. Any disputes arising under these
              Terms shall be resolved through binding arbitration or in the courts of competent jurisdiction.
            </p>
          </Section>

          <Section title="12. Changes to Terms">
            <p>
              We reserve the right to modify these Terms at any time. We will notify you of material
              changes by posting the new Terms on this page and updating the "Last updated" date. Your
              continued use of the Service after the effective date of the revised Terms constitutes
              your acceptance of the changes.
            </p>
          </Section>

          <Section title="13. Contact">
            <p>
              If you have any questions about these Terms, please contact us at{' '}
              <a href="mailto:admin@scorifygolf.com" className="underline" style={{ color: GREEN }}>
                admin@scorifygolf.com
              </a>.
            </p>
          </Section>
        </main>

        <Footer />
      </div>
    </>
  )
}
