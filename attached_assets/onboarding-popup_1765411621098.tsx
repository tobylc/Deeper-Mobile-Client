import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, ArrowRight, Clock, Heart } from "lucide-react";
import DeeperLogo from "@/components/deeper-logo";
import QuotesIcon from "@/components/quotes-icon";
import { UserDisplayName } from "@/hooks/useUserDisplayName";

interface OnboardingPopupProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: 'questioner' | 'responder';
  otherParticipant: string | null;
  relationshipType: string;
  inviterRole?: string;
  inviteeRole?: string;
  onComplete?: () => void;
}

export default function OnboardingPopup({ 
  isOpen, 
  onClose, 
  userRole, 
  otherParticipant, 
  relationshipType,
  inviterRole,
  inviteeRole,
  onComplete 
}: OnboardingPopupProps) {
  const isQuestioner = userRole === 'questioner';
  
  // Display specific role combination if available, otherwise fall back to relationship type
  const relationshipDisplay = inviterRole && inviteeRole 
    ? `${inviterRole}/${inviteeRole}` 
    : relationshipType;

  const handleClose = () => {
    onClose();
    if (onComplete) {
      onComplete();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-gradient-radial from-slate-900 via-slate-800 to-slate-900 border-2 border-[#4FACFE]/30 backdrop-blur-md">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 z-10 w-8 h-8 rounded-full bg-[#4FACFE]/20 hover:bg-[#4FACFE]/30 flex items-center justify-center text-white/80 hover:text-white transition-all duration-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <DialogHeader className="text-center space-y-4 pt-2">
          <div className="flex justify-center">
            <DeeperLogo size="lg" />
          </div>
          <DialogTitle className="text-2xl font-bold text-white flex items-center justify-center space-x-2">
            <QuotesIcon size="md" className="text-[#4FACFE]" />
            <span>Welcome to Deeper</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Introduction */}
          <Card className="bg-[#1B2137]/90 border-[#4FACFE]/30 backdrop-blur-md shadow-xl">
            <CardContent className="p-6">
              <div className="text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#4FACFE] to-teal flex items-center justify-center mx-auto shadow-lg">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white">
                  {isQuestioner ? "You're about to ask your first question!" : "You're about to share your first response!"}
                </h3>
                <p className="text-slate-200 leading-relaxed">
                  Deeper uses a unique <strong className="text-white">turn-based conversation system</strong> designed to create 
                  more thoughtful, meaningful exchanges between you and{" "}
                  {otherParticipant ? (
                    <span className="text-[#4FACFE] font-medium">
                      <UserDisplayName email={otherParticipant} />
                    </span>
                  ) : (
                    <span className="text-[#4FACFE] font-medium">your conversation partner</span>
                  )}.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* How it works */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-white text-center">How Turn-Based Communication Works</h4>
            
            <div className="grid gap-4">
              {isQuestioner ? (
                <>
                  {/* Step 1 - Ask Question */}
                  <Card className="bg-[#1B2137]/80 border-[#4FACFE]/30 backdrop-blur-md shadow-lg">
                    <CardContent className="p-4 flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-full bg-[#4FACFE] text-white flex items-center justify-center text-sm font-bold shadow-lg">
                        1
                      </div>
                      <div>
                        <h5 className="font-semibold text-white">Ask Your Question</h5>
                        <p className="text-sm text-slate-200">
                          Share your thoughtful question or topic to explore together.
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Step 2 - Wait for Response */}
                  <Card className="bg-[#1B2137]/80 border-[#D7A087]/30 backdrop-blur-md shadow-lg">
                    <CardContent className="p-4 flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-full bg-[#D7A087] text-white flex items-center justify-center text-sm font-bold shadow-lg">
                        2
                      </div>
                      <div>
                        <h5 className="font-semibold text-white">Their Turn to Respond</h5>
                        <p className="text-sm text-slate-200">
                          {otherParticipant ? (
                            <>
                              <UserDisplayName email={otherParticipant} /> will receive an email notification and share their thoughtful response.
                            </>
                          ) : (
                            <>Your conversation partner will receive an email notification and share their thoughtful response.</>
                          )}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Step 3 - Continue Conversation */}
                  <Card className="bg-[#1B2137]/80 border-teal/30 backdrop-blur-md shadow-lg">
                    <CardContent className="p-4 flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center text-sm font-bold shadow-lg">
                        3
                      </div>
                      <div>
                        <h5 className="font-semibold text-white">Continue the Exchange</h5>
                        <p className="text-sm text-slate-200">
                          Once they respond, you can follow up, ask new questions, or start new conversation threads.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <>
                  {/* Step 1 - Question Asked */}
                  <Card className="bg-[#1B2137]/80 border-[#4FACFE]/30 backdrop-blur-md shadow-lg">
                    <CardContent className="p-4 flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-full bg-[#4FACFE] text-white flex items-center justify-center text-sm font-bold shadow-lg">
                        1
                      </div>
                      <div>
                        <h5 className="font-semibold text-white">Question Asked</h5>
                        <p className="text-sm text-slate-200">
                          {otherParticipant ? (
                            <>
                              <UserDisplayName email={otherParticipant} /> has shared a thoughtful question for you to explore.
                            </>
                          ) : (
                            <>Your conversation partner has shared a thoughtful question for you to explore.</>
                          )}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Step 2 - Your Response */}
                  <Card className="bg-[#1B2137]/80 border-[#D7A087]/30 backdrop-blur-md shadow-lg">
                    <CardContent className="p-4 flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-full bg-[#D7A087] text-white flex items-center justify-center text-sm font-bold shadow-lg">
                        2
                      </div>
                      <div>
                        <h5 className="font-semibold text-white">Share Your Response</h5>
                        <p className="text-sm text-slate-200">
                          Take your time to craft a thoughtful, authentic response that deepens your connection.
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Step 3 - Continue Conversation */}
                  <Card className="bg-[#1B2137]/80 border-teal/30 backdrop-blur-md shadow-lg">
                    <CardContent className="p-4 flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center text-sm font-bold shadow-lg">
                        3
                      </div>
                      <div>
                        <h5 className="font-semibold text-white">Turn-Based Exchange</h5>
                        <p className="text-sm text-slate-200">
                          After you respond, they can follow up or ask new questions, creating meaningful dialogue.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>

          {/* The Heart of Deeper - Highlighted Section */}
          <Card className="bg-gradient-to-br from-[#4FACFE]/10 via-white to-[#4FACFE]/5 border-2 border-[#4FACFE] backdrop-blur-md shadow-xl relative overflow-hidden">
            {/* Ocean blue accent stripe */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#4FACFE] to-teal"></div>
            
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-r from-[#4FACFE] to-teal flex items-center justify-center shadow-lg ring-2 ring-[#4FACFE]/20 ring-offset-2">
                    <QuotesIcon size="lg" className="text-white" />
                  </div>
                </div>
                <h5 className="font-bold text-xl text-[#4FACFE] mb-2">The Heart of Deeper</h5>
                <div className="space-y-3 text-slate-700">
                  <p className="leading-relaxed">
                    <strong className="text-[#4FACFE]">Deeper is designed for long-term, thoughtful conversations</strong> that unfold over 
                    months, years, or even decades. This isn't quick texting or email replacement—it's a dedicated space for 
                    meaningful dialogue that might be difficult to have in person.
                  </p>
                  <p className="leading-relaxed">
                    Think of Deeper as your private conversation sanctuary where you can return again and again to explore 
                    <strong className="text-[#4FACFE]"> deeper questions, share authentic thoughts, and strengthen your connection</strong> through 
                    exchanges that simply don't happen anywhere else.
                  </p>
                </div>
              </div>
            </CardContent>
            
            {/* Ocean blue corner accents */}
            <div className="absolute bottom-0 right-0 w-20 h-20 bg-gradient-to-tl from-[#4FACFE]/10 to-transparent rounded-tl-full"></div>
            <div className="absolute top-0 left-0 w-12 h-12 bg-gradient-to-br from-[#4FACFE]/10 to-transparent rounded-br-full"></div>
          </Card>

          {/* Key Benefits */}
          <Card className="bg-[#1B2137]/80 border-[#4FACFE]/30 backdrop-blur-md shadow-lg">
            <CardContent className="p-4">
              <h5 className="font-semibold text-white mb-3 flex items-center">
                <MessageCircle className="w-4 h-4 mr-2 text-[#4FACFE]" />
                Why Turn-Based Communication?
              </h5>
              <ul className="space-y-2 text-sm text-slate-200">
                <li className="flex items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#4FACFE] mt-2 mr-3 flex-shrink-0"></div>
                  <span><strong className="text-white">Thoughtful responses:</strong> Time to reflect before sharing</span>
                </li>
                <li className="flex items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#4FACFE] mt-2 mr-3 flex-shrink-0"></div>
                  <span><strong className="text-white">Ongoing dialogue:</strong> Conversations that continue over time</span>
                </li>
                <li className="flex items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#4FACFE] mt-2 mr-3 flex-shrink-0"></div>
                  <span><strong className="text-white">Deeper connection:</strong> Exchanges that happen nowhere else</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Important Note */}
          <Card className="bg-[#1B2137]/80 border-[#D7A087]/30 backdrop-blur-md shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <Clock className="w-5 h-5 text-[#D7A087] mt-0.5 flex-shrink-0" />
                <div>
                  <h5 className="font-semibold text-white mb-1">Important to Remember</h5>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    Express your thoughts fully while it's your turn—you won't be able to respond again 
                    until <UserDisplayName email={otherParticipant} /> submits their follow-up. This encourages 
                    more complete, meaningful communication.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Button */}
          <div className="text-center pt-4">
            <Button 
              onClick={handleClose}
              className="bg-gradient-to-r from-[#4FACFE] to-teal text-white hover:from-[#4FACFE]/90 hover:to-teal/90 px-8 py-3 text-lg shadow-lg backdrop-blur-sm"
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              {isQuestioner ? "Ask My First Question" : "Share My First Response"}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}