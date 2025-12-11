import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Phone, Mail, Smartphone, X, RefreshCw } from "lucide-react";
import { formatPhoneNumber, extractDigitsForApi, isValidUSPhoneNumber } from "@/utils/phone-formatter";

interface NotificationPreferencePopupProps {
  conversationId: number;
  currentPreference: "email" | "sms" | "both";
  onPreferenceSet: (preference: "email" | "sms" | "both") => void;
  onDismiss: (type: "never" | "later") => void;
}

export default function NotificationPreferencePopup({
  conversationId,
  currentPreference,
  onPreferenceSet,
  onDismiss
}: NotificationPreferencePopupProps) {
  const [selectedPreference, setSelectedPreference] = useState<"email" | "sms" | "both">(currentPreference);
  const [phoneNumber, setPhoneNumber] = useState("+1");
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const { toast } = useToast();

  const needsPhoneSetup = (selectedPreference === "sms" || selectedPreference === "both");

  // Countdown timer for resend button
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCountdown]);

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    
    // Always use the formatter to handle the input
    const formatted = formatPhoneNumber(input);
    setPhoneNumber(formatted);
  };

  const sendVerificationCode = async (isResend = false) => {
    if (!isValidUSPhoneNumber(phoneNumber)) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid 10-digit US phone number.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const apiPhoneNumber = extractDigitsForApi(phoneNumber);
      console.log('[SMS_DEBUG] Sending verification to:', apiPhoneNumber);
      
      const response = await apiRequest('POST', "/api/users/send-verification", {
        phoneNumber: apiPhoneNumber
      });

      if (response.ok) {
        setCodeSent(true);
        setIsVerifying(true);
        setResendCountdown(60); // 60 second countdown
        toast({
          title: isResend ? "Verification code resent" : "Verification code sent",
          description: "Check your phone for a 6-digit verification code."
        });
      } else {
        const error = await response.json();
        console.error('[SMS_DEBUG] Verification send failed:', error);
        toast({
          title: "Error sending code",
          description: error.message || "Failed to send verification code. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('[SMS_DEBUG] Network error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send verification code. Please check your connection.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendVerificationCode = () => sendVerificationCode(false);
  const handleResendCode = () => sendVerificationCode(true);

  const handleVerifyPhone = async () => {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      toast({
        title: "Invalid code",
        description: "Please enter the 6-digit verification code.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const apiPhoneNumber = extractDigitsForApi(phoneNumber);
      const response = await apiRequest("/api/users/verify-phone", "POST", {
        phoneNumber: apiPhoneNumber,
        code: verificationCode.trim()
      });

      if (response.ok) {
        await handleSetPreference();
      } else {
        const error = await response.json();
        toast({
          title: "Verification failed",
          description: error.message || "Invalid verification code. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to verify phone number. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetPreference = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest("/api/users/notification-preference", "POST", {
        conversationId,
        preference: selectedPreference
      });

      if (response.ok) {
        onPreferenceSet(selectedPreference);
        toast({
          title: "Notification preference saved",
          description: `You'll receive turn notifications via ${selectedPreference === "both" ? "email and text" : selectedPreference}.`
        });
      } else {
        const error = await response.json();
        const errorMessage = error.message || "Failed to save notification preference.";
        
        // Production-ready error handling
        if (response.status === 429) {
          toast({
            title: "Too many requests",
            description: "Please wait a moment before trying again.",
            variant: "destructive"
          });
        } else if (response.status >= 500) {
          toast({
            title: "Service unavailable",
            description: "Notification service temporarily unavailable. Please try again later.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      toast({
        title: "Network error",
        description: "Unable to connect to server. Please check your connection and try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailOnlyPreference = async () => {
    setSelectedPreference("email");
    await handleSetPreference();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="bg-white max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl border-0">
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-gradient-to-br from-[#4FACFE] to-[#00D4FF] rounded-full flex items-center justify-center mx-auto">
                <Smartphone className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800">
                Turn Notifications
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                How would you like to be notified when it's your turn to respond in this conversation?
              </p>
            </div>

            {/* Preference Options */}
            <div className="space-y-3">
              <button
                onClick={() => setSelectedPreference("email")}
                className={`w-full p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                  selectedPreference === "email" 
                    ? "border-[#4FACFE] bg-[#4FACFE]/5" 
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    selectedPreference === "email" ? "bg-[#4FACFE]" : "bg-slate-100"
                  }`}>
                    <Mail className={`w-5 h-5 ${
                      selectedPreference === "email" ? "text-white" : "text-slate-600"
                    }`} />
                  </div>
                  <div>
                    <div className="font-medium text-slate-800">Email Only</div>
                    <div className="text-sm text-slate-600">Continue with email notifications</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSelectedPreference("sms")}
                className={`w-full p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                  selectedPreference === "sms" 
                    ? "border-[#4FACFE] bg-[#4FACFE]/5" 
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    selectedPreference === "sms" ? "bg-[#4FACFE]" : "bg-slate-100"
                  }`}>
                    <Phone className={`w-5 h-5 ${
                      selectedPreference === "sms" ? "text-white" : "text-slate-600"
                    }`} />
                  </div>
                  <div>
                    <div className="font-medium text-slate-800">Text Messages Only</div>
                    <div className="text-sm text-slate-600">Get instant SMS notifications</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSelectedPreference("both")}
                className={`w-full p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                  selectedPreference === "both" 
                    ? "border-[#4FACFE] bg-[#4FACFE]/5" 
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    selectedPreference === "both" ? "bg-[#4FACFE]" : "bg-slate-100"
                  }`}>
                    <div className="flex space-x-0.5">
                      <Mail className={`w-4 h-4 ${
                        selectedPreference === "both" ? "text-white" : "text-slate-600"
                      }`} />
                      <Phone className={`w-4 h-4 ${
                        selectedPreference === "both" ? "text-white" : "text-slate-600"
                      }`} />
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-slate-800">Email + Text</div>
                    <div className="text-sm text-slate-600">Maximum notification coverage</div>
                  </div>
                </div>
              </button>
            </div>

            {/* Phone Setup Section */}
            {needsPhoneSetup && (
              <div className="space-y-4 border-t pt-4">
                <Label className="text-sm font-medium text-slate-700">
                  Phone Number Setup
                </Label>
                
                {!isVerifying ? (
                  <div className="space-y-3">
                    <Input
                      type="tel"
                      placeholder="+1(555)123-4567"
                      value={phoneNumber}
                      onChange={handlePhoneNumberChange}
                      className="border-slate-300 font-mono"
                    />
                    <div className="text-xs text-slate-500">
                      Just type your 10-digit number (e.g., 5551234567)
                    </div>
                    <Button
                      onClick={handleSendVerificationCode}
                      disabled={isLoading || !isValidUSPhoneNumber(phoneNumber)}
                      className="w-full bg-[#4FACFE] hover:bg-[#4FACFE]/90"
                    >
                      {isLoading ? "Sending..." : "Send Verification Code"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-sm text-slate-600">
                      Enter the 6-digit code sent to {phoneNumber}
                    </div>
                    <Input
                      type="text"
                      placeholder="Enter 6-digit code"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="border-slate-300 text-center text-lg tracking-widest"
                      maxLength={6}
                    />
                    <div className="flex space-x-2">
                      <Button
                        onClick={handleVerifyPhone}
                        disabled={isLoading || verificationCode.length !== 6}
                        className="flex-1 bg-[#4FACFE] hover:bg-[#4FACFE]/90"
                      >
                        {isLoading ? "Verifying..." : "Verify & Continue"}
                      </Button>
                      <Button
                        onClick={() => {
                          setIsVerifying(false);
                          setCodeSent(false);
                          setVerificationCode("");
                          setResendCountdown(0);
                        }}
                        variant="outline"
                        disabled={isLoading}
                      >
                        Back
                      </Button>
                    </div>
                    
                    {/* Resend Code Button */}
                    <div className="text-center">
                      {resendCountdown > 0 ? (
                        <div className="text-sm text-slate-500">
                          Resend code in {resendCountdown}s
                        </div>
                      ) : (
                        <Button
                          onClick={handleResendCode}
                          disabled={isLoading}
                          variant="ghost"
                          size="sm"
                          className="text-[#4FACFE] hover:text-[#4FACFE]/80 hover:bg-[#4FACFE]/10"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Resend Code
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            {!needsPhoneSetup && (
              <Button
                onClick={handleEmailOnlyPreference}
                disabled={isLoading}
                className="w-full bg-[#4FACFE] hover:bg-[#4FACFE]/90"
              >
                {isLoading ? "Saving..." : "Save Preference"}
              </Button>
            )}

            {/* Dismiss Options */}
            <div className="flex justify-between text-sm border-t pt-4">
              <button
                onClick={() => onDismiss("later")}
                className="text-slate-600 hover:text-slate-800 transition-colors"
              >
                Remind me later
              </button>
              <button
                onClick={() => onDismiss("never")}
                className="text-slate-600 hover:text-slate-800 transition-colors"
              >
                Never show this again
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}