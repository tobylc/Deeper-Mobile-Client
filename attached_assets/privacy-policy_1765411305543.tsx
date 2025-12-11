import DeeperLogo from "@/components/deeper-logo";

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
      {/* Header */}
      <div className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-700">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center">
          <DeeperLogo size="md" />
          <span className="ml-3 text-xl font-semibold text-white">Privacy Policy</span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-slate-800/50 rounded-2xl p-8 backdrop-blur-sm border border-slate-700">
          <h1 className="text-3xl font-bold text-white mb-8">Privacy Policy</h1>
          
          <div className="space-y-8 text-slate-300">
            <section>
              <h2 className="text-xl font-semibold text-white mb-4">Information We Collect</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Information You Provide</h3>
                  <ul className="space-y-2 leading-relaxed">
                    <li>• <strong>Account Information:</strong> Name, email address, password, and profile details</li>
                    <li>• <strong>Contact Information:</strong> Phone number (optional) for SMS notifications and verification</li>
                    <li>• <strong>Communication Content:</strong> Messages, voice recordings, and responses you share in conversations</li>
                    <li>• <strong>Payment Information:</strong> Billing details for subscription services (processed securely through Stripe)</li>
                    <li>• <strong>Relationship Information:</strong> Connection preferences and relationship context you provide</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Information We Collect Automatically</h3>
                  <ul className="space-y-2 leading-relaxed">
                    <li>• <strong>Usage Data:</strong> How you interact with our platform, conversation activity, and feature usage</li>
                    <li>• <strong>Device Information:</strong> Browser type, operating system, and device identifiers</li>
                    <li>• <strong>Log Data:</strong> IP addresses, access times, and pages visited (for security and troubleshooting)</li>
                    <li>• <strong>Session Data:</strong> Authentication tokens and session identifiers for account security</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">How We Use Your Information</h2>
              <ul className="space-y-2 leading-relaxed">
                <li>• To provide and maintain our conversation platform services</li>
                <li>• To send important notifications about your conversations and connections</li>
                <li>• To process payments for premium subscriptions</li>
                <li>• To improve our services and user experience</li>
                <li>• To comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">SMS Communication Consent & Terms</h2>
              <p className="leading-relaxed mb-4">
                By providing your phone number and opting in to SMS notifications through Deeper, you explicitly consent to receive automated text messages from Deeper at the phone number you provided. This includes:
              </p>
              <ul className="space-y-2 leading-relaxed mb-4">
                <li>• Phone number verification codes during account setup</li>
                <li>• Turn-based conversation notifications when it's your time to respond</li>
                <li>• Connection status updates when someone accepts or declines your invitation</li>
                <li>• Important account and service-related notifications</li>
                <li>• Reminder messages for pending conversations (up to 2 per day maximum)</li>
              </ul>
              
              <div className="bg-blue-900/30 p-4 rounded-lg mb-4 border border-blue-700/50">
                <h3 className="text-lg font-semibold text-white mb-2">SMS Terms & Conditions</h3>
                <ul className="space-y-2 text-sm leading-relaxed">
                  <li>• <strong>Consent:</strong> Your consent is not required as a condition of purchase</li>
                  <li>• <strong>Message Frequency:</strong> Message frequency varies based on your conversation activity and preferences</li>
                  <li>• <strong>Carrier Rates:</strong> Message and data rates may apply as charged by your mobile carrier</li>
                  <li>• <strong>Supported Carriers:</strong> Compatible with all major US and Canadian carriers</li>
                  <li>• <strong>Help:</strong> Reply "HELP" to any message for assistance</li>
                </ul>
              </div>

              <div className="bg-red-900/30 p-4 rounded-lg border border-red-700/50">
                <h3 className="text-lg font-semibold text-white mb-2">How to Opt-Out</h3>
                <p className="leading-relaxed mb-2">
                  <strong>To stop receiving SMS messages:</strong> Reply "STOP", "UNSUBSCRIBE", "CANCEL", "END", or "QUIT" to any text message from Deeper. You will receive a confirmation message, and no further messages will be sent to your phone number.
                </p>
                <p className="text-sm leading-relaxed">
                  You can also disable SMS notifications at any time through your account settings within the Deeper application.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">Information Sharing</h2>
              <p className="leading-relaxed">
                Your conversations are private and only shared with the specific person you're connected with. 
                We do not sell, trade, or share your personal information with third parties except as required 
                by law or to provide essential services (payment processing, SMS delivery).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">Data Security</h2>
              <p className="leading-relaxed">
                We implement industry-standard security measures to protect your personal information and conversations. 
                All data is encrypted in transit and at rest. Voice messages are securely stored and automatically 
                transcribed for accessibility.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">Data Retention & Your Rights</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">How Long We Keep Your Data</h3>
                  <ul className="space-y-2 leading-relaxed">
                    <li>• <strong>Account Data:</strong> Retained while your account is active and for 90 days after deletion</li>
                    <li>• <strong>Conversations:</strong> Stored indefinitely while both participants maintain active accounts</li>
                    <li>• <strong>Payment Data:</strong> Billing records kept for 7 years for tax and legal compliance</li>
                    <li>• <strong>SMS Records:</strong> Delivery logs maintained for 12 months for carrier compliance</li>
                    <li>• <strong>Usage Analytics:</strong> Aggregated, anonymized data may be retained indefinitely</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Your Privacy Rights</h3>
                  <ul className="space-y-2 leading-relaxed">
                    <li>• <strong>Access:</strong> Request a copy of your personal data we hold</li>
                    <li>• <strong>Correction:</strong> Update or correct inaccurate personal information</li>
                    <li>• <strong>Deletion:</strong> Request deletion of your account and associated data</li>
                    <li>• <strong>Portability:</strong> Export your conversation data in a readable format</li>
                    <li>• <strong>Opt-out:</strong> Unsubscribe from SMS notifications and marketing communications</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">Third-Party Services</h2>
              <p className="leading-relaxed mb-4">
                Deeper integrates with trusted third-party services to provide our platform functionality. These services have their own privacy policies:
              </p>
              <ul className="space-y-2 leading-relaxed">
                <li>• <strong>Stripe:</strong> Payment processing (see Stripe's Privacy Policy)</li>
                <li>• <strong>Twilio:</strong> SMS message delivery and phone verification</li>
                <li>• <strong>OpenAI:</strong> AI-powered conversation suggestions and content generation</li>
                <li>• <strong>AWS S3:</strong> Secure cloud storage for voice messages and media</li>
                <li>• <strong>Neon:</strong> Database hosting and management services</li>
              </ul>
              <p className="leading-relaxed mt-4">
                We share only the minimum necessary information with these services to provide functionality, and they are contractually obligated to protect your data.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">Cookies and Analytics</h2>
              <p className="leading-relaxed">
                Deeper uses essential cookies for authentication and session management. We may use analytics 
                to understand how our platform is used and to improve the user experience. You can control 
                cookie preferences through your browser settings.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">Children's Privacy (COPPA Compliance)</h2>
              <p className="leading-relaxed mb-4">
                Deeper is not intended for use by children under 13 years of age. We do not knowingly collect, 
                use, or disclose personal information from children under 13 without verifiable parental consent. 
                If you believe we have collected information from a child under 13, please contact us immediately 
                and we will take steps to remove such information.
              </p>
              <p className="leading-relaxed">
                For users aged 13-17, we recommend parental guidance when using our platform, as it involves 
                personal communication and relationship-building features.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">Legal Compliance & Jurisdiction</h2>
              <div className="space-y-4">
                <p className="leading-relaxed">
                  This privacy policy is governed by the laws of the United States. By using Deeper, you consent 
                  to the transfer of your information to the United States and processing in accordance with this policy.
                </p>
                
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Regulatory Compliance</h3>
                  <ul className="space-y-2 leading-relaxed">
                    <li>• <strong>TCPA Compliance:</strong> All SMS communications comply with the Telephone Consumer Protection Act</li>
                    <li>• <strong>CAN-SPAM:</strong> Marketing emails include clear unsubscribe options and sender identification</li>
                    <li>• <strong>CCPA:</strong> California residents have additional rights under the California Consumer Privacy Act</li>
                    <li>• <strong>GDPR:</strong> European users have rights under the General Data Protection Regulation</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">Changes to This Policy</h2>
              <p className="leading-relaxed">
                We may update this privacy policy from time to time. We will notify users of any material changes 
                by email or through the platform. Your continued use of Deeper after such modifications constitutes 
                acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">Contact Us</h2>
              <p className="leading-relaxed mb-4">
                If you have any questions about this privacy policy, our data practices, or need to exercise your privacy rights, please contact us:
              </p>
              <div className="space-y-4">
                <div className="p-4 bg-slate-700/50 rounded-lg">
                  <h3 className="text-white font-semibold mb-2">General Privacy Inquiries</h3>
                  <p className="text-slate-300">Email: privacy@joindeeper.com</p>
                  <p className="text-slate-300">Website: https://joindeeper.com/privacy-policy</p>
                </div>
                
                <div className="p-4 bg-slate-700/50 rounded-lg">
                  <h3 className="text-white font-semibold mb-2">SMS & Communication Support</h3>
                  <p className="text-slate-300">For SMS opt-out assistance or technical issues</p>
                  <p className="text-slate-300">Email: support@joindeeper.com</p>
                  <p className="text-slate-300">Text "HELP" to any message from Deeper</p>
                </div>
                
                <div className="p-4 bg-slate-700/50 rounded-lg">
                  <h3 className="text-white font-semibold mb-2">Data Rights Requests</h3>
                  <p className="text-slate-300">For access, deletion, or correction requests</p>
                  <p className="text-slate-300">Email: dataprotection@joindeeper.com</p>
                  <p className="text-slate-300">Response time: Within 30 days</p>
                </div>
              </div>
            </section>

            <div className="text-sm text-slate-400 mt-12 pt-8 border-t border-slate-700">
              <p>Last updated: July 28, 2025</p>
              <p className="mt-2">Version 2.0 - Enhanced for Twilio SMS compliance and comprehensive privacy coverage</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}