import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Lightbulb, Shuffle, Sparkles, ArrowRight, MessageCircle, Wand2, Clock, Plus } from "lucide-react";
import DeeperLogo from "@/components/deeper-logo";
import QuotesIcon from "@/components/quotes-icon";
import { UserDisplayName } from "@/hooks/useUserDisplayName";
import { getQuestionsByCategory } from "@/lib/questions";
import { getRoleSpecificQuestions, getGeneralRelationshipQuestions } from "@shared/role-specific-questions";
import { getRoleDisplayInfo } from "@shared/role-display-utils";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import ExchangeRequiredPopup from "@/components/exchange-required-popup";
import TrialExpirationPopup from "@/components/trial-expiration-popup";
import { HypnoticOrbs } from "@/components/hypnotic-orbs";

interface QuestionSuggestionsProps {
  relationshipType: string;
  userRole: string;
  otherUserRole: string;
  isMyTurn: boolean;
  otherParticipant: string;
  connectionId: number;
  onNewThreadCreated: (conversationId: number) => void;
  canUseRightColumn: boolean;
  canCreateNewThread: boolean;
  nextMessageType: 'question' | 'response';
  onQuestionSelect: (question: string) => void;
}

export default function QuestionSuggestions({ relationshipType, userRole, otherUserRole, isMyTurn, otherParticipant, connectionId, onNewThreadCreated, canUseRightColumn, canCreateNewThread, nextMessageType, onQuestionSelect }: QuestionSuggestionsProps) {
  const [currentSet, setCurrentSet] = useState(0);
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showNewQuestionDialog, setShowNewQuestionDialog] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [shownQuestions, setShownQuestions] = useState<Set<string>>(new Set());
  const [availableQuestions, setAvailableQuestions] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [customAiQuestions, setCustomAiQuestions] = useState<string[]>([]);
  const [isGeneratingCustomAI, setIsGeneratingCustomAI] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showExchangeRequiredPopup, setShowExchangeRequiredPopup] = useState(false);
  const [showTrialExpirationPopup, setShowTrialExpirationPopup] = useState(false);
  
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Create new thread mutation for question suggestions
  const createNewThreadMutation = useMutation({
    mutationFn: async (question: string) => {
      const response = await apiRequest("POST", `/api/connections/${connectionId}/conversations/with-question`, {
        question: question.trim()
      });
      return response.json();
    },
    onSuccess: (data) => {
      console.log('[QUESTION_SUGGESTIONS] New thread created successfully:', data);
      const conversationId = data.conversation?.id;
      if (conversationId) {
        onNewThreadCreated(conversationId);
        setNewQuestionText("");
        setShowNewQuestionDialog(false);
        toast({
          title: "New conversation started!",
          description: "Your question has started a new conversation thread",
        });
      } else {
        console.error('[QUESTION_SUGGESTIONS] No conversation ID in response:', data);
        toast({
          title: "Error creating conversation",
          description: "Please try again",
        });
      }
    },
    onError: (error) => {
      console.error('[QUESTION_SUGGESTIONS] Failed to create new thread:', error);
      
      // Parse error response to check for trial expiration
      let errorData;
      try {
        // Handle cases where error message includes HTTP status code prefix (e.g., "403: {json}")
        let errorMessage = error.message || "";
        
        // Extract JSON part if there's a status code prefix
        const jsonMatch = errorMessage.match(/\d{3}:\s*(\{.*\})/);
        if (jsonMatch) {
          errorMessage = jsonMatch[1];
        }
        
        errorData = JSON.parse(errorMessage);
      } catch {
        // If JSON parsing fails, check if the raw message contains trial expiration indicators
        const errorMessage = error.message || "";
        errorData = { 
          message: errorMessage,
          type: errorMessage.includes("TRIAL_EXPIRED") ? "TRIAL_EXPIRED" : undefined
        };
      }
      
      // Show trial expiration popup for trial expired errors
      if (errorData.type === "TRIAL_EXPIRED" || (errorData.message && errorData.message.includes("trial has expired"))) {
        console.log('[QUESTION_SUGGESTIONS] Showing trial expiration popup');
        setShowTrialExpirationPopup(true);
        return;
      }
      
      // Show trial expiration popup for subscription canceled errors
      if (errorData.type === "SUBSCRIPTION_CANCELED" || (errorData.message && errorData.message.includes("subscription has been canceled"))) {
        console.log('[QUESTION_SUGGESTIONS] Showing trial expiration popup for canceled subscription');
        setShowTrialExpirationPopup(true); // Reuse the same popup for upgrade flow
        return;
      }
      
      // For other errors, show a nicer toast (not destructive red)
      toast({
        title: "Unable to start new conversation",
        description: errorData.message || "Please try again",
      });
    }
  });

  // Handle custom question text by creating new thread
  const handleCreateNewThread = () => {
    if (!newQuestionText.trim()) {
      return;
    }
    
    createNewThreadMutation.mutate(newQuestionText.trim());
  };



  // Populate text input with selected question for editing
  const handleQuestionSelect = (question: string) => {
    try {
      // Validate question content
      if (!question || !question.trim()) {

        return;
      }
      
      // Check if user can use right column
      if (!canUseRightColumn) {
        setShowExchangeRequiredPopup(true);
        return;
      }
      
      // Populate the text input with the selected question for editing
      onQuestionSelect(question.trim());
      
      // Mark this question as shown to prevent duplicate suggestions
      setShownQuestions(prev => new Set([...Array.from(prev), question]));
      
    } catch (error) {

      toast({
        title: "Unable to select question",
        description: "An unexpected error occurred. Please try again.",
      });
    }
  };
  
  // Initialize available questions and track shown ones
  useEffect(() => {
    const roleSpecificQuestions = getRoleSpecificQuestions(relationshipType, userRole);
    const fallbackQuestions = getGeneralRelationshipQuestions(relationshipType);
    const allQuestions = roleSpecificQuestions.length > 0 ? roleSpecificQuestions : fallbackQuestions;
    
    console.log('[QUESTION_DEBUG] Initializing questions for:', { relationshipType, userRole });
    console.log('[QUESTION_DEBUG] Role specific questions found:', roleSpecificQuestions.length);
    console.log('[QUESTION_DEBUG] Total available questions:', allQuestions.length);
    console.log('[QUESTION_DEBUG] First 3 questions:', allQuestions.slice(0, 3));
    
    // Always shuffle questions for randomness - each page load shows different questions
    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
    setAvailableQuestions(shuffled);
    
    // Reset shown questions when relationship type or role changes
    setShownQuestions(new Set());
    setCurrentQuestions([]);
  }, [relationshipType, userRole]);

  // Fresh shuffle on every page load/refresh - ensures new questions every time
  useEffect(() => {
    // Add a secondary shuffle effect that runs on component mount to ensure fresh questions
    const performFreshShuffle = () => {
      const roleSpecificQuestions = getRoleSpecificQuestions(relationshipType, userRole);
      const fallbackQuestions = getGeneralRelationshipQuestions(relationshipType);
      const allQuestions = roleSpecificQuestions.length > 0 ? roleSpecificQuestions : fallbackQuestions;
      
      if (allQuestions.length > 0) {
        // Use timestamp as additional randomization factor
        const timestamp = Date.now();
        const extraRandomized = [...allQuestions].sort(() => {
          // Use timestamp + random for better randomization
          return (Math.random() + (timestamp % 1000) / 1000) - 0.5;
        });
        
        setAvailableQuestions(extraRandomized);
        setShownQuestions(new Set());
        setCurrentQuestions([]);
      }
    };

    // Run fresh shuffle on component mount
    performFreshShuffle();
  }, []); // Empty dependency array to run only on mount

  // Get next set of questions that haven't been shown - ENHANCED for maximum variety
  const getNextQuestions = (count: number = 5): string[] => {
    const unshownQuestions = availableQuestions.filter(q => !shownQuestions.has(q));
    
    // If we have enough unshown questions, use them with additional randomization
    if (unshownQuestions.length >= count) {
      // Extra shuffle for variety
      const extraShuffled = [...unshownQuestions].sort(() => Math.random() - 0.5);
      const nextQuestions = extraShuffled.slice(0, count);
      setShownQuestions(prev => new Set([...Array.from(prev), ...nextQuestions]));
      return nextQuestions;
    }
    
    // If we're running low on unshown questions, implement smart rotation
    if (unshownQuestions.length < count && availableQuestions.length >= count) {
      // Reset and reshuffle all questions with enhanced randomization
      const timestamp = Date.now();
      const reshuffled = [...availableQuestions].sort(() => {
        // Use multiple randomization factors for better variety
        const factor1 = Math.random();
        const factor2 = (timestamp % 10000) / 10000;
        const factor3 = Math.sin(timestamp) * 0.5;
        return (factor1 + factor2 + factor3) - 0.5;
      });
      
      setAvailableQuestions(reshuffled);
      setShownQuestions(new Set());
      
      const nextQuestions = reshuffled.slice(0, count);
      setShownQuestions(prev => new Set([...Array.from(prev), ...nextQuestions]));
      return nextQuestions;
    }
    
    // Return what we have with maximum randomization
    const shuffledRemaining = [...unshownQuestions].sort(() => Math.random() - 0.5);
    const nextQuestions = shuffledRemaining.slice(0, Math.min(count, shuffledRemaining.length));
    setShownQuestions(prev => new Set([...Array.from(prev), ...nextQuestions]));
    return nextQuestions;
  };

  const [currentQuestions, setCurrentQuestions] = useState<string[]>([]);
  
  // Load initial questions
  useEffect(() => {
    if (availableQuestions.length > 0 && currentQuestions.length === 0) {
      setCurrentQuestions(getNextQuestions(5));
    }
  }, [availableQuestions]);
  
  const shuffleQuestions = () => {
    // Enhanced shuffle with time-based variation to ensure different questions every time
    const timestamp = Date.now();
    const roleSpecificQuestions = getRoleSpecificQuestions(relationshipType, userRole);
    const fallbackQuestions = getGeneralRelationshipQuestions(relationshipType);
    const allQuestions = roleSpecificQuestions.length > 0 ? roleSpecificQuestions : fallbackQuestions;
    
    // Apply fresh randomization with timestamp
    const freshlyShuffled = [...allQuestions].sort(() => {
      const base = Math.random();
      const timeVariation = (timestamp % 7919) / 7919; // Use prime number for better distribution
      return (base + timeVariation) - 0.5;
    });
    
    setAvailableQuestions(freshlyShuffled);
    setShownQuestions(new Set()); // Reset shown questions for fresh start
    
    const newQuestions = getNextQuestions(5);
    setCurrentQuestions(newQuestions);
  };

  const generateAIQuestions = async () => {
    setIsGeneratingAI(true);
    try {
      const response = await fetch('/api/ai/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          relationshipType, 
          userRole,
          otherUserRole,
          count: 5,
          excludeQuestions: Array.from(shownQuestions)
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setAiQuestions(data.questions || []);
        setShowAI(true);
      }
    } catch (error) {
      console.error('Failed to generate AI questions:', error);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const generateCustomAIQuestions = async () => {
    if (!customPrompt.trim()) return;
    
    setIsGeneratingCustomAI(true);
    try {
      const response = await fetch('/api/ai/generate-custom-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          relationshipType, 
          userRole,
          otherUserRole,
          customPrompt: customPrompt.trim(),
          count: 5
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setCustomAiQuestions(data.questions || []);
        setShowCustomModal(true);
      }
    } catch (error) {
      console.error('Failed to generate custom AI questions:', error);
    } finally {
      setIsGeneratingCustomAI(false);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4 overflow-hidden">
      {/* Show waiting state when it's not the user's turn */}
      {!isMyTurn ? (
        <div className="bg-white border border-slate-200/60 shadow-sm rounded-lg flex-shrink-0">
          <div className="p-6 text-center">
            <div className="flex flex-col items-center space-y-3">
              <Clock className="w-8 h-8 text-slate-400" />
              <div>
                <h3 className="text-sm font-medium text-slate-700">Their Turn</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Take time to reflect while they craft their thoughtful response
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* New Question Button - Fixed at top */}
          <Dialog open={showNewQuestionDialog} onOpenChange={setShowNewQuestionDialog}>
            <DialogTrigger asChild>
              <Button 
                className="w-full bg-gradient-to-r from-ocean to-teal text-white hover:from-ocean/90 hover:to-teal/90 transition-all duration-200 shadow-lg hover:shadow-xl flex-shrink-0"
                disabled={!canCreateNewThread}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Question
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <QuotesIcon size="sm" />
                  <span>Ask a New Question</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-600 mb-4">
                    Starting a new question will automatically save your current conversation and create a new thread.
                  </p>
                  <Textarea
                    placeholder="What would you like to ask or explore together?"
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowNewQuestionDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateNewThread}
                    disabled={!newQuestionText.trim()}
                    className="bg-ocean text-white hover:bg-ocean/90"
                  >
                    Use This Question
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Header Card - Fixed at top */}
          <Card className="bg-white border border-slate-200/60 shadow-sm flex-shrink-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="bg-gradient-to-br from-ocean to-amber p-2 rounded-lg">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold text-slate-800">
                      Question Inspiration
                    </CardTitle>
                    <p className="text-xs text-slate-600">
                      Thoughtfully curated for deeper connection
                    </p>
                  </div>
                </div>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={shuffleQuestions}
                  className="h-8 px-2 hover:bg-ocean/10 text-xs"
                >
                  <Shuffle className="w-3 h-3 mr-1" />
                  More
                </Button>
              </div>
              
              <Badge 
                variant="secondary" 
                className="w-fit bg-amber/10 text-amber-800 border-amber/30 text-xs"
              >
                <QuotesIcon size="xs" className="mr-1" />
                {userRole && otherUserRole ? `${userRole} - ${otherUserRole}` : relationshipType}
              </Badge>
            </CardHeader>
          </Card>

          {/* Toggle Buttons - Fixed at top */}
          <div className="flex space-x-2 flex-shrink-0">
            <Button
              variant={!showAI ? "default" : "outline"}
              size="sm"
              onClick={() => setShowAI(false)}
              className={cn(
                "flex-1 text-xs h-8",
                !showAI 
                  ? "bg-ocean text-white hover:bg-ocean/90" 
                  : "border-ocean/30 text-ocean hover:bg-ocean/10"
              )}
            >
              <MessageCircle className="w-3 h-3 mr-1" />
              Curated
            </Button>
            <Button
              variant={showAI ? "default" : "outline"}
              size="sm"
              onClick={() => {
                if (!showAI && aiQuestions.length === 0) {
                  generateAIQuestions();
                } else {
                  setShowAI(true);
                }
              }}
              disabled={isGeneratingAI}
              className={cn(
                "flex-1 text-xs h-8",
                showAI 
                  ? "bg-amber text-white hover:bg-amber/90" 
                  : "border-slate-300 text-slate-700 hover:bg-slate-50"
              )}
            >
              {isGeneratingAI ? (
                <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin mr-1" />
              ) : (
                <Wand2 className="w-3 h-3 mr-1" />
              )}
              AI Generated
            </Button>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto space-y-4 pb-4">
            {/* Questions List */}
            <div className="space-y-2">
              {(showAI ? aiQuestions : currentQuestions).map((question, index) => (
                <div
                  key={index}
                  onClick={() => handleQuestionSelect(question)}
                  className={cn(
                    "group cursor-pointer transition-all duration-200 p-3 rounded-xl border",
                    "hover:shadow-md hover:scale-[1.01]",
                    showAI 
                      ? "bg-gradient-to-br from-amber/5 to-amber/10 border-amber/20 hover:border-amber/40 hover:bg-amber/15"
                      : "bg-gradient-to-br from-ocean/5 to-ocean/10 border-ocean/20 hover:border-ocean/40 hover:bg-ocean/15"
                  )}
                >
                  <div className="flex items-start space-x-2">
                    <div className="flex-shrink-0 mt-0.5">
                      <MessageCircle className={cn(
                        "w-3 h-3",
                        showAI ? "text-amber-600" : "text-ocean"
                      )} />
                    </div>
                    
                    <div className="flex-1">
                      <div className="text-sm leading-relaxed text-slate-700 group-hover:text-slate-900">
                        "{question}"
                      </div>
                      
                      <div className="flex items-center mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <span className={cn(
                          "text-xs font-medium mr-1",
                          showAI ? "text-amber-600" : "text-ocean"
                        )}>
                          Click to use
                        </span>
                        <ArrowRight className={cn(
                          "w-2 h-2",
                          showAI ? "text-amber-600" : "text-ocean"
                        )} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* More Button */}
            <div className="text-center">
              <button
                onClick={showAI ? generateAIQuestions : shuffleQuestions}
                disabled={showAI ? isGeneratingAI : false}
                className={cn(
                  "text-xs font-medium px-4 py-2 rounded-lg border transition-all duration-200",
                  "hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed",
                  showAI 
                    ? "text-amber-700 border-amber/30 bg-amber/10 hover:bg-amber/20"
                    : "text-ocean border-ocean/30 bg-ocean/10 hover:bg-ocean/20"
                )}
              >
                {showAI && isGeneratingAI ? "Generating..." : "More"}
              </button>
            </div>

            {/* Custom AI Prompt */}
            {showAI && (
              <div className="pt-3 border-t border-amber/20">
                <div className="text-xs font-medium text-amber-700 mb-2">Ask AI about a specific topic or situation:</div>
                <div className="space-y-2">
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Describe what you want to talk about or explore with your partner..."
                    className="w-full text-xs p-2 rounded-lg border border-amber/30 bg-amber/5 resize-none focus:outline-none focus:ring-2 focus:ring-amber/50 focus:border-amber/50"
                    rows={2}
                  />
                  <button
                    onClick={generateCustomAIQuestions}
                    disabled={!customPrompt.trim() || isGeneratingCustomAI}
                    className="w-full text-xs font-medium px-3 py-1.5 rounded-lg border bg-amber/10 border-amber/30 text-amber-700 hover:bg-amber/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {isGeneratingCustomAI ? "Generating..." : "Generate Custom Questions"}
                  </button>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="text-center">
              <div className="text-xs text-slate-600">
                {showAI ? (
                  aiQuestions.length > 0 ? `${aiQuestions.length} AI-generated questions` : 'Generate personalized questions'
                ) : (
                  `${currentQuestions.length} curated questions available`
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Custom AI Questions Modal */}
      <Dialog open={showCustomModal} onOpenChange={setShowCustomModal}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium text-amber-700">
              Custom Question Suggestions
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {customAiQuestions.map((question, index) => (
              <div
                key={`modal-custom-${index}`}
                onClick={() => {
                  handleQuestionSelect(question);
                  setShowCustomModal(false);
                  setCustomPrompt("");
                  setCustomAiQuestions([]);
                }}
                className="group cursor-pointer transition-all duration-200 p-3 rounded-xl border bg-gradient-to-br from-amber/10 to-amber/15 border-amber/30 hover:border-amber/50 hover:bg-amber/20 hover:shadow-md hover:scale-[1.01]"
              >
                <div className="flex items-start space-x-2">
                  <div className="flex-shrink-0 mt-0.5">
                    <MessageCircle className="w-3 h-3 text-amber-600" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="text-sm leading-relaxed text-slate-700 group-hover:text-slate-900">
                      "{question}"
                    </div>
                    
                    <div className="flex items-center mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <span className="text-xs font-medium mr-1 text-amber-600">
                        Click to use
                      </span>
                      <ArrowRight className="w-2 h-2 text-amber-600" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Beautiful Exchange Required Popup */}
      <ExchangeRequiredPopup
        isOpen={showExchangeRequiredPopup}
        onClose={() => setShowExchangeRequiredPopup(false)}
        nextMessageType={nextMessageType}
        relationshipType={relationshipType}
      />

      {/* Trial Expiration Popup */}
      <TrialExpirationPopup
        isOpen={showTrialExpirationPopup}
        onClose={() => setShowTrialExpirationPopup(false)}
        action="create_conversation"
      />
    </div>
  );
}
