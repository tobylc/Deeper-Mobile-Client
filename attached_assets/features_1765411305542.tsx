import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, MessageCircle, Lightbulb, History, Mail, Users, Star, Globe, Shield, CheckCircle, Clock, Target, Zap, Eye } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import DeeperLogo from "@/components/deeper-logo";

export default function Features() {
  const [activeIcon, setActiveIcon] = useState<string>('users');
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 z-50 glass-nav">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/">
              <div className="flex items-center space-x-2 cursor-pointer">
                <DeeperLogo size="header" />
              </div>
            </Link>
            <div className="hidden md:flex items-center space-x-8">
              <Link href="/" className="text-white/80 hover:text-white transition-colors font-inter font-medium">
                Home
              </Link>
              <Link href="/features" className="text-white font-inter font-medium">
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
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-2 bg-background">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 text-center">
          <div className="mb-8">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">What Makes Us Different</Badge>
            <h1 className="text-4xl lg:text-6xl font-inter font-bold text-foreground mb-6 leading-tight">
              Built for <span className="text-primary">meaningful connection</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Unlike social media or group chats, Deeper creates intimate spaces for two people to build deeper understanding through structured, thoughtful dialogue.
            </p>
          </div>
        </div>
      </section>

      {/* Core Differentiators */}
      <section className="pb-8 bg-card">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
          </div>

          <div className="grid lg:grid-cols-3 gap-8 mb-8">
            {/* Exclusive Two-Person Focus */}
            <Card className="border-2 border-gray-600 rounded-xl shadow-lg bg-primary/5">
              <CardContent className="p-8 text-center">
                <div 
                  className={`w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-6 transition-all duration-300 hover:scale-110 cursor-pointer ${
                    activeIcon === 'users' 
                      ? 'bg-primary shadow-lg' 
                      : 'bg-primary/20 hover:bg-primary'
                  }`}
                  onClick={() => setActiveIcon('users')}
                >
                  <Users className={`w-8 h-8 transition-colors duration-300 ${
                    activeIcon === 'users' 
                      ? 'text-white' 
                      : 'text-primary hover:text-white'
                  }`} />
                </div>
                <h3 className="text-2xl font-inter font-bold text-foreground mb-4">Exclusively Two People</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  No groups, no audiences, no distractions. Just you and one other person in a private space designed for intimate conversation.
                </p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center justify-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span>Private invitation-only spaces</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span>No public profiles or feeds</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span>Complete privacy and intimacy</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Turn-Based Structure */}
            <Card className="border-2 border-gray-600 rounded-xl shadow-lg bg-secondary/5">
              <CardContent className="p-8 text-center">
                <div 
                  className={`w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-6 transition-all duration-300 hover:scale-110 cursor-pointer ${
                    activeIcon === 'clock' 
                      ? 'bg-primary shadow-lg' 
                      : 'bg-secondary/20 hover:bg-primary'
                  }`}
                  onClick={() => setActiveIcon('clock')}
                >
                  <Clock className={`w-8 h-8 transition-colors duration-300 ${
                    activeIcon === 'clock' 
                      ? 'text-white' 
                      : 'text-primary hover:text-white'
                  }`} />
                </div>
                <h3 className="text-2xl font-inter font-bold text-foreground mb-4">Turn-Based Dialogue</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  One person asks, the other responds. This structure ensures balanced conversation and gives time for thoughtful responses.
                </p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center justify-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-secondary-foreground" />
                    <span>Prevents conversation dominance</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-secondary-foreground" />
                    <span>Encourages thoughtful responses</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-secondary-foreground" />
                    <span>Creates anticipation and engagement</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Curated Questions */}
            <Card className="border-2 border-gray-600 rounded-xl shadow-lg bg-accent/5">
              <CardContent className="p-8 text-center">
                <div 
                  className={`w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-6 transition-all duration-300 hover:scale-110 cursor-pointer ${
                    activeIcon === 'lightbulb' 
                      ? 'bg-primary shadow-lg' 
                      : 'bg-accent/20 hover:bg-primary'
                  }`}
                  onClick={() => setActiveIcon('lightbulb')}
                >
                  <Lightbulb className={`w-8 h-8 transition-colors duration-300 ${
                    activeIcon === 'lightbulb' 
                      ? 'text-white' 
                      : 'text-primary hover:text-white'
                  }`} />
                </div>
                <h3 className="text-2xl font-inter font-bold text-foreground mb-4">Expertly Curated Questions</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Thoughtfully crafted questions designed by relationship experts for different relationship types and conversation depths.
                </p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center justify-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-accent-foreground" />
                    <span>Relationship-specific question pools</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-accent-foreground" />
                    <span>Progressive depth levels</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-accent-foreground" />
                    <span>Scientifically-backed prompts</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Detailed Features */}
      <section className="pt-8 pb-16 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-inter font-bold text-foreground mb-4">
              Complete feature overview
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Email-Based Connection */}
            <div className="flex items-start space-x-4 p-6 bg-card rounded-xl shadow-lg border-2 border-gray-600">
              <div 
                className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 hover:scale-110 cursor-pointer ${
                  activeIcon === 'mail' 
                    ? 'bg-primary shadow-lg' 
                    : 'bg-primary/10 hover:bg-primary'
                }`}
                onClick={() => setActiveIcon('mail')}
              >
                <Mail className={`w-6 h-6 transition-colors duration-300 ${
                  activeIcon === 'mail' 
                    ? 'text-white' 
                    : 'text-primary hover:text-white'
                }`} />
              </div>
              <div>
                <h3 className="text-xl font-inter font-semibold text-foreground mb-2">Mutual Consent System</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Both people must agree before a conversation space is created. No unwanted connections or spam.
                </p>
              </div>
            </div>

            {/* Conversation Timeline */}
            <div className="flex items-start space-x-4 p-6 bg-card rounded-xl shadow-lg border-2 border-gray-600">
              <div 
                className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 hover:scale-110 cursor-pointer ${
                  activeIcon === 'history' 
                    ? 'bg-primary shadow-lg' 
                    : 'bg-secondary/10 hover:bg-primary'
                }`}
                onClick={() => setActiveIcon('history')}
              >
                <History className={`w-6 h-6 transition-colors duration-300 ${
                  activeIcon === 'history' 
                    ? 'text-white' 
                    : 'text-secondary-foreground hover:text-white'
                }`} />
              </div>
              <div>
                <h3 className="text-xl font-inter font-semibold text-foreground mb-2">Conversation Timeline</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Your entire dialogue history preserved in a beautiful timeline that you can revisit and reflect upon.
                </p>
              </div>
            </div>

            {/* Relationship Categories */}
            <div className="flex items-start space-x-4 p-6 bg-card rounded-xl shadow-lg border-2 border-gray-600">
              <div 
                className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 hover:scale-110 cursor-pointer p-2 ${
                  activeIcon === 'heart' 
                    ? 'bg-primary shadow-lg' 
                    : 'bg-accent/10 hover:bg-primary'
                }`}
                onClick={() => setActiveIcon('heart')}
              >
                <DeeperLogo size="sm" className={`transition-all duration-300 ${
                  activeIcon === 'heart' 
                    ? 'brightness-0 invert' 
                    : 'hover:brightness-0 hover:invert'
                }`} />
              </div>
              <div>
                <h3 className="text-xl font-inter font-semibold text-foreground mb-2">Relationship-Specific Design</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Whether parent-child, romantic partners, friends, or siblings - tools designed for different relationship dynamics.
                </p>
              </div>
            </div>

            {/* Privacy Focus */}
            <div className="flex items-start space-x-4 p-6 bg-card rounded-xl shadow-lg border-2 border-gray-600">
              <div 
                className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 hover:scale-110 cursor-pointer ${
                  activeIcon === 'shield' 
                    ? 'bg-primary shadow-lg' 
                    : 'bg-success/10 hover:bg-primary'
                }`}
                onClick={() => setActiveIcon('shield')}
              >
                <Shield className={`w-6 h-6 transition-colors duration-300 ${
                  activeIcon === 'shield' 
                    ? 'text-white' 
                    : 'text-success hover:text-white'
                }`} />
              </div>
              <div>
                <h3 className="text-xl font-inter font-semibold text-foreground mb-2">Privacy by Design</h3>
                <p className="text-muted-foreground leading-relaxed">
                  No public profiles, no social feeds, no advertising. Your conversations remain completely private.
                </p>
              </div>
            </div>

            {/* Thoughtful Pacing */}
            <div className="flex items-start space-x-4 p-6 bg-card rounded-xl shadow-lg border-2 border-gray-600">
              <div 
                className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 hover:scale-110 cursor-pointer ${
                  activeIcon === 'target' 
                    ? 'bg-primary shadow-lg' 
                    : 'bg-primary/10 hover:bg-primary'
                }`}
                onClick={() => setActiveIcon('target')}
              >
                <Target className={`w-6 h-6 transition-colors duration-300 ${
                  activeIcon === 'target' 
                    ? 'text-white' 
                    : 'text-primary hover:text-white'
                }`} />
              </div>
              <div>
                <h3 className="text-xl font-inter font-semibold text-foreground mb-2">Intentional Pacing</h3>
                <p className="text-muted-foreground leading-relaxed">
                  No pressure for instant responses. Take time to reflect and give thoughtful answers that matter.
                </p>
              </div>
            </div>

            {/* Question Intelligence */}
            <div className="flex items-start space-x-4 p-6 bg-card rounded-xl shadow-lg border-2 border-gray-600">
              <div 
                className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 hover:scale-110 cursor-pointer ${
                  activeIcon === 'zap' 
                    ? 'bg-primary shadow-lg' 
                    : 'bg-secondary/10 hover:bg-primary'
                }`}
                onClick={() => setActiveIcon('zap')}
              >
                <Zap className={`w-6 h-6 transition-colors duration-300 ${
                  activeIcon === 'zap' 
                    ? 'text-white' 
                    : 'text-secondary-foreground hover:text-white'
                }`} />
              </div>
              <div>
                <h3 className="text-xl font-inter font-semibold text-foreground mb-2">Smart Question Suggestions</h3>
                <p className="text-muted-foreground leading-relaxed">
                  AI-powered recommendations based on your relationship type, conversation history, and comfort level.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why It Matters */}
      <section className="py-16 bg-card">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-inter font-bold text-foreground mb-8">
            Why meaningful conversation matters
          </h2>
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div>
              <div className="text-4xl font-bold text-primary mb-2">73%</div>
              <p className="text-muted-foreground">of people feel lonely despite being connected online</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">89%</div>
              <p className="text-muted-foreground">crave deeper, more meaningful relationships</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">2x</div>
              <p className="text-muted-foreground">stronger bonds form through structured dialogue</p>
            </div>
          </div>
          <p className="text-lg text-muted-foreground leading-relaxed mb-8">
            In a world of surface-level interactions and endless distractions, Deeper creates space for the conversations that actually matter. 
            Research shows that structured, intentional dialogue builds stronger emotional bonds than casual chat.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16" style={{ background: 'var(--nav-gray)' }}>
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-inter font-bold text-white mb-6">
            Ready to experience deeper connection?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Start your first meaningful conversation today
          </p>
          <div className="flex flex-col gap-4 justify-center items-center">
            <Link href="/checkout/basic">
              <Button size="lg" className="btn-ocean px-8 flex flex-col gap-1 h-auto py-4">
                <span className="text-lg font-semibold">60 Day Free Trial</span>
                <span className="text-sm font-normal opacity-90">No Credit Card Required</span>
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="border-white bg-transparent text-white hover:bg-white hover:text-gray-900 px-8">
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}