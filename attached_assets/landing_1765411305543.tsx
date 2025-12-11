import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MessageSquare, HelpCircle, Shield, X } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import DeeperLogo from "@/components/deeper-logo";

export default function Landing() {
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [activeStep, setActiveStep] = useState(1);

  const stepDetails = {
    1: {
      title: "Invite someone special",
      description: "Send a private invitation to someone you want to connect with more deeply",
      detailedExplanation: "Creating meaningful connections starts with a simple, thoughtful invitation. You can invite anyone - a family member, romantic partner, close friend, or colleague. The invitation process is designed to be warm and personal, allowing you to choose the type of relationship and include a heartfelt message explaining why you'd like to deepen your connection. Your invitation creates a private, secure space that only you and your invited person can access, ensuring complete privacy and intimacy in your conversations."
    },
    2: {
      title: "Choose your journey",
      description: "Select relationship type and let our curated questions guide meaningful dialogue",
      detailedExplanation: "Every relationship is unique, which is why we offer specialized question sets tailored to different types of connections. Whether you're connecting with a parent, child, romantic partner, sibling, or friend, our expertly curated questions are designed to spark meaningful conversations that go beyond surface-level chat. These questions have been carefully crafted by relationship experts to help you explore shared values, dreams, memories, and perspectives in a way that feels natural and engaging."
    },
    3: {
      title: "Build deeper bonds",
      description: "Take turns asking and answering, creating a beautiful timeline of your connection",
      detailedExplanation: "The magic happens in the exchange. Our turn-based conversation system ensures that both people have equal opportunity to share and listen. As you take turns asking questions and sharing responses, you'll create a beautiful, chronological timeline of your growing connection. Each conversation becomes a treasured record of your relationship's evolution, filled with insights, laughter, and moments of genuine understanding that you can revisit and cherish over time."
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 z-50 glass-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <DeeperLogo size="header" />
            </div>
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <Link href="/" className="text-white/80 hover:text-white transition-colors font-inter font-medium">
                Home
              </Link>
              <Link href="/features" className="text-white/80 hover:text-white transition-colors font-inter font-medium">
                Features
              </Link>
              <Link href="/pricing" className="text-white/80 hover:text-white transition-colors font-inter font-medium">
                Pricing
              </Link>
              <Link href="/auth">
                <Button className="btn-ocean px-6 py-2">
                  Login
                </Button>
              </Link>
            </div>
            
            {/* Mobile Navigation - Login Button Only */}
            <div className="flex md:hidden items-center">
              <Link href="/auth">
                <Button className="btn-ocean px-4 py-2 text-sm">
                  Login
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="mb-16">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-inter font-bold text-foreground mb-8 leading-tight">
              Cultivate meaningful
              <br />
              <span className="text-ocean-blue">connections.</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-12 font-inter max-w-2xl mx-auto leading-relaxed px-4 sm:px-0">
              Create exclusive, private spaces for thoughtful dialogue that deepens relationships over time.
            </p>
            <div className="flex justify-center px-4 sm:px-0">
              <Link href="/checkout/basic">
                <Button size="lg" className="btn-ocean px-6 sm:px-8 flex flex-col gap-1 h-auto py-4 text-center min-w-0">
                  <span className="text-base sm:text-lg font-semibold">60 Day Free Trial</span>
                  <span className="text-xs sm:text-sm font-normal opacity-90">No Credit Card Required</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mt-20 px-4 sm:px-0">
            {/* Structured Conversations */}
            <Card className="bg-card p-6 sm:p-8 text-left smooth-enter border-2 border-gray-600 rounded-xl shadow-lg">
              <CardContent className="p-0">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                  <MessageSquare className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-inter font-semibold text-foreground mb-4">
                  Structured conversations
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Turn-based dialogue system that ensures balanced, thoughtful exchanges between two people.
                </p>
              </CardContent>
            </Card>

            {/* Curated Question Pools */}
            <Card className="bg-card p-6 sm:p-8 text-left smooth-enter border-2 border-gray-600 rounded-xl shadow-lg">
              <CardContent className="p-0">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                  <HelpCircle className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-inter font-semibold text-foreground mb-4">
                  Curated question pools
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Thoughtfully crafted questions designed for different relationship types and conversation depths.
                </p>
              </CardContent>
            </Card>

            {/* Private Communication Spaces */}
            <Card className="bg-card p-6 sm:p-8 text-left smooth-enter border-2 border-gray-600 rounded-xl shadow-lg">
              <CardContent className="p-0">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-inter font-semibold text-foreground mb-4">
                  Private communication spaces
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Exclusive two-person spaces that create intimate environments for meaningful connection.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 sm:py-24 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-inter font-bold text-foreground mb-12 sm:mb-16">
            Simple steps to deeper connection
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
            {[1, 2, 3].map((stepNumber) => (
              <div key={stepNumber} className="smooth-enter">
                <div 
                  className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 cursor-pointer transition-all duration-300 hover:scale-110 ${
                    activeStep === stepNumber 
                      ? 'bg-primary shadow-lg' 
                      : 'bg-secondary hover:bg-primary hover:shadow-md'
                  }`}
                  onClick={() => {
                    setActiveStep(stepNumber);
                    setSelectedStep(stepNumber);
                  }}
                >
                  <span className={`text-2xl font-bold transition-colors duration-300 ${
                    activeStep === stepNumber 
                      ? 'text-primary-foreground' 
                      : 'text-secondary-foreground hover:text-primary-foreground'
                  }`}>
                    {stepNumber}
                  </span>
                </div>
                <h3 className="text-xl font-inter font-semibold text-foreground mb-4">
                  {stepDetails[stepNumber as keyof typeof stepDetails].title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {stepDetails[stepNumber as keyof typeof stepDetails].description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Step Detail Modal */}
        <Dialog open={selectedStep !== null} onOpenChange={() => setSelectedStep(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-inter font-bold text-foreground flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold">{selectedStep}</span>
                </div>
                {selectedStep && stepDetails[selectedStep as keyof typeof stepDetails].title}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Detailed explanation of step {selectedStep}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-6">
              <p className="text-muted-foreground leading-relaxed text-lg">
                {selectedStep && stepDetails[selectedStep as keyof typeof stepDetails].detailedExplanation}
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16" style={{ background: 'var(--nav-gray)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-inter font-bold text-white mb-6">
            Ready to cultivate meaningful connections?
          </h2>
          <p className="text-lg sm:text-xl text-white/90 mb-8 px-4 sm:px-0">
            Join thousands discovering the power of structured, intentional dialogue
          </p>
          <div className="flex flex-col gap-4 justify-center items-center px-4 sm:px-0">
            <Link href="/checkout/basic">
              <Button size="lg" className="btn-ocean px-6 sm:px-8 flex flex-col gap-1 h-auto py-4 text-center min-w-0">
                <span className="text-base sm:text-lg font-semibold">60 Day Free Trial</span>
                <span className="text-xs sm:text-sm font-normal opacity-90">No Credit Card Required</span>
              </Button>
            </Link>
            <Link href="/features">
              <Button size="lg" variant="outline" className="border-white bg-transparent text-white hover:bg-white hover:text-gray-900 px-6 sm:px-8">
                Learn more
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}