import DeeperLogo from "@/components/deeper-logo";

export function SmsOptInPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-center mb-8">
          <DeeperLogo className="h-12 w-auto" />
        </div>

        {/* Main Content */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20">
          <h1 className="text-3xl font-bold text-white mb-6 text-center">
            SMS Notification Opt-In Policy
          </h1>

          <div className="space-y-6 text-white/90">
            {/* Opt-In Process */}
            <section>
              <h2 className="text-xl font-semibold text-white mb-3">How You Opt In to SMS Notifications</h2>
              <div className="bg-blue-500/20 rounded-xl p-4 border border-blue-400/30">
                <p className="mb-3">You can opt in to SMS notifications in the following ways:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Account Settings:</strong> Navigate to your notification preferences in your Deeper account settings and select "SMS" as your preferred notification method.</li>
                  <li><strong>During Registration:</strong> When creating your account, you can choose SMS notifications as your communication preference.</li>
                  <li><strong>Connection Setup:</strong> When setting up a new conversation connection, you'll be asked about your notification preferences.</li>
                </ul>
              </div>
            </section>

            {/* What Messages You'll Receive */}
            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Types of SMS Messages You'll Receive</h2>
              <div className="bg-amber-500/20 rounded-xl p-4 border border-amber-400/30">
                <p className="mb-3">When you opt in to SMS notifications, you may receive the following types of messages:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Turn Reminders:</strong> Gentle reminders when it's your turn to respond in a conversation</li>
                  <li><strong>New Message Alerts:</strong> Notifications when your conversation partner sends you a new message or question</li>
                  <li><strong>Connection Invitations:</strong> Alerts when someone invites you to start a new conversation</li>
                  <li><strong>System Updates:</strong> Important account or service-related notifications</li>
                </ul>
                <p className="mt-3 text-sm text-white/70">
                  <strong>Frequency:</strong> You may receive 1-5 messages per week depending on your conversation activity.
                </p>
              </div>
            </section>

            {/* Example Messages */}
            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Example SMS Messages</h2>
              <div className="bg-green-500/20 rounded-xl p-4 border border-green-400/30">
                <div className="space-y-3">
                  <div className="bg-white/10 p-3 rounded-lg">
                    <p className="text-sm font-mono">"Hi [Name], it's your turn to respond to [Partner] in your Deeper conversation. Login at joindeeper.com to continue your dialogue."</p>
                  </div>
                  <div className="bg-white/10 p-3 rounded-lg">
                    <p className="text-sm font-mono">"[Partner] sent you a new question in Deeper. Take your time crafting a thoughtful response. Visit joindeeper.com"</p>
                  </div>
                  <div className="bg-white/10 p-3 rounded-lg">
                    <p className="text-sm font-mono">"You have a new connection invitation on Deeper from [Name]. Accept at joindeeper.com/invitations"</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Opt-Out Instructions */}
            <section>
              <h2 className="text-xl font-semibold text-white mb-3">How to Opt Out</h2>
              <div className="bg-red-500/20 rounded-xl p-4 border border-red-400/30">
                <p className="mb-3">You can stop receiving SMS notifications at any time:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Reply STOP:</strong> Simply reply "STOP" to any SMS message to immediately unsubscribe</li>
                  <li><strong>Account Settings:</strong> Change your notification preference to "Email Only" in your account settings</li>
                  <li><strong>Contact Support:</strong> Email support@joindeeper.com to opt out</li>
                </ul>
                <p className="mt-3 text-sm text-white/70">
                  Once you opt out, you will no longer receive SMS messages, but you can still receive email notifications if preferred.
                </p>
              </div>
            </section>

            {/* Contact Information */}
            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Contact Information</h2>
              <div className="bg-purple-500/20 rounded-xl p-4 border border-purple-400/30">
                <p className="mb-2"><strong>Service Provider:</strong> Deeper Communications</p>
                <p className="mb-2"><strong>Website:</strong> joindeeper.com</p>
                <p className="mb-2"><strong>Support Email:</strong> support@joindeeper.com</p>
                <p className="mb-2"><strong>Service Type:</strong> Relationship communication platform with SMS notifications</p>
                <p className="text-sm text-white/70 mt-3">
                  Standard message and data rates may apply. We use SMS responsibly and only send messages relevant to your Deeper conversations.
                </p>
              </div>
            </section>

            {/* Terms Agreement */}
            <section>
              <h2 className="text-xl font-semibold text-white mb-3">Agreement to Terms</h2>
              <div className="bg-slate-500/20 rounded-xl p-4 border border-slate-400/30">
                <p className="text-sm">
                  By opting in to SMS notifications, you agree to receive text messages from Deeper at the phone number you provide. 
                  You understand that consent is not required to use our service, and you can opt out at any time by replying STOP. 
                  Message frequency varies based on your conversation activity. Standard message and data rates apply.
                </p>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-white/20 text-center">
            <p className="text-white/60 text-sm">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}