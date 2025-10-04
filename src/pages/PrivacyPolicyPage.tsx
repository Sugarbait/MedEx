/**
 * Privacy Policy Page
 * HIPAA & PIPEDA Compliant Privacy Policy
 */

import React from 'react'
import { ShieldCheckIcon } from 'lucide-react'

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8">
          {/* Header */}
          <div className="flex items-center mb-8">
            <ShieldCheckIcon className="w-12 h-12 text-blue-600 mr-4" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Privacy Policy</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Last Updated: {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Introduction */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">1. Introduction</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              MedEx Healthcare CRM ("we," "our," or "us") is committed to protecting your privacy and ensuring the security
              of your Protected Health Information (PHI). This Privacy Policy describes how we collect, use, disclose, and
              safeguard your information in compliance with:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 ml-4">
              <li><strong>HIPAA</strong> (Health Insurance Portability and Accountability Act) - United States</li>
              <li><strong>PIPEDA</strong> (Personal Information Protection and Electronic Documents Act) - Canada</li>
              <li><strong>HITRUST CSF</strong> (Health Information Trust Alliance Common Security Framework)</li>
            </ul>
          </section>

          {/* Information We Collect */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">2. Information We Collect</h2>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-4">2.1 Personal Information</h3>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 ml-4">
              <li>Name, email address, phone number</li>
              <li>Department and professional role</li>
              <li>Authentication credentials (encrypted)</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-4">2.2 Protected Health Information (PHI)</h3>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 ml-4">
              <li>Voice call recordings and transcripts</li>
              <li>SMS/text message conversations</li>
              <li>Patient interaction data</li>
              <li>Healthcare service usage information</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-4">2.3 Technical Information</h3>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 ml-4">
              <li>Device and browser information</li>
              <li>IP address and location data</li>
              <li>Usage analytics and audit logs</li>
            </ul>
          </section>

          {/* How We Use Your Information */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">3. How We Use Your Information</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We use your information only for legitimate healthcare purposes:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 ml-4">
              <li>Providing healthcare communication services</li>
              <li>Maintaining patient care records</li>
              <li>Ensuring HIPAA compliance and audit trails</li>
              <li>Improving service quality and user experience</li>
              <li>Meeting legal and regulatory requirements</li>
            </ul>
          </section>

          {/* Data Security */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">4. Data Security</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We implement comprehensive security measures to protect your PHI:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 ml-4">
              <li><strong>Encryption at Rest:</strong> AES-256-GCM encryption for all stored PHI</li>
              <li><strong>Encryption in Transit:</strong> TLS 1.2+ for all data transmission</li>
              <li><strong>Access Control:</strong> Role-based access with multi-factor authentication</li>
              <li><strong>Audit Logging:</strong> Comprehensive HIPAA-compliant audit trails (6-year retention)</li>
              <li><strong>Session Management:</strong> Configurable timeouts and emergency logout</li>
            </ul>
          </section>

          {/* Your Rights (PIPEDA) */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">5. Your Privacy Rights (PIPEDA)</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Under PIPEDA, you have the following rights:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 ml-4">
              <li><strong>Right to Access:</strong> Request a copy of your personal information</li>
              <li><strong>Right to Correction:</strong> Request correction of inaccurate information</li>
              <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time (subject to legal restrictions)</li>
              <li><strong>Right to File a Complaint:</strong> Contact the Privacy Commissioner of Canada</li>
            </ul>
          </section>

          {/* Your Rights (HIPAA) */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">6. Your HIPAA Rights</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Under HIPAA, you have the following rights regarding your PHI:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 ml-4">
              <li><strong>Right to Access:</strong> Inspect and obtain copies of your PHI</li>
              <li><strong>Right to Amend:</strong> Request amendments to your PHI</li>
              <li><strong>Right to Accounting:</strong> Receive an accounting of PHI disclosures</li>
              <li><strong>Right to Request Restrictions:</strong> Request limits on uses/disclosures of PHI</li>
              <li><strong>Right to Confidential Communications:</strong> Request communications via specific means</li>
            </ul>
          </section>

          {/* Data Retention */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">7. Data Retention</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We retain your information in accordance with legal requirements:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 ml-4">
              <li><strong>PHI:</strong> Minimum 6 years as required by HIPAA</li>
              <li><strong>Audit Logs:</strong> 6 years for HIPAA compliance</li>
              <li><strong>Personal Information:</strong> As long as necessary for legitimate purposes</li>
            </ul>
          </section>

          {/* Third-Party Services */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">8. Third-Party Services</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              We work with HIPAA-compliant Business Associates:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 ml-4">
              <li><strong>Retell AI:</strong> Voice call processing (BAA in place)</li>
              <li><strong>Twilio:</strong> SMS messaging (BAA in place)</li>
              <li><strong>Supabase:</strong> Database services (BAA in place)</li>
              <li><strong>Microsoft Azure:</strong> Cloud hosting (BAA in place)</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mt-4">
              All Business Associates have signed HIPAA Business Associate Agreements (BAAs) and comply with HIPAA requirements.
            </p>
          </section>

          {/* Breach Notification */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">9. Data Breach Notification</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              In the event of a data breach involving your PHI, we will:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 ml-4">
              <li>Notify affected individuals within 60 days (HIPAA requirement)</li>
              <li>Notify the HHS Secretary if breach affects 500+ individuals</li>
              <li>Notify the Privacy Commissioner of Canada if required by PIPEDA</li>
              <li>Provide information about the breach and mitigation steps</li>
            </ul>
          </section>

          {/* Contact Information */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">10. Contact Us</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              For privacy questions, concerns, or to exercise your rights:
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <p className="text-gray-700 dark:text-gray-300">
                <strong>Privacy Officer</strong><br />
                MedEx Healthcare CRM<br />
                Email: privacy@medex.com<br />
                Phone: 1-800-MEDEX-PRIVACY
              </p>
            </div>
          </section>

          {/* Changes to Policy */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">11. Changes to This Policy</h2>
            <p className="text-gray-700 dark:text-gray-300">
              We may update this Privacy Policy periodically. We will notify you of material changes by:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 ml-4 mt-4">
              <li>Posting the updated policy with a new "Last Updated" date</li>
              <li>Sending email notifications for significant changes</li>
              <li>Displaying prominent notices in the application</li>
            </ul>
          </section>

          {/* Compliance Certifications */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">12. Compliance & Certifications</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4 text-center">
                <p className="font-semibold text-green-800 dark:text-green-300">HIPAA</p>
                <p className="text-sm text-green-700 dark:text-green-400 mt-1">Security & Privacy Rules</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4 text-center">
                <p className="font-semibold text-green-800 dark:text-green-300">PIPEDA</p>
                <p className="text-sm text-green-700 dark:text-green-400 mt-1">10 Fair Information Principles</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4 text-center">
                <p className="font-semibold text-green-800 dark:text-green-300">HITRUST CSF</p>
                <p className="text-sm text-green-700 dark:text-green-400 mt-1">Common Security Framework</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
