import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Simple icon components
const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
);

const CameraIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
    <circle cx="12" cy="13" r="4"></circle>
  </svg>
);

const BarChartIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="20" x2="12" y2="10"></line>
    <line x1="18" y1="20" x2="18" y2="4"></line>
    <line x1="6" y1="20" x2="6" y2="16"></line>
  </svg>
);

const TipsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="16" x2="12" y2="12"></line>
    <line x1="12" y1="8" x2="12.01" y2="8"></line>
  </svg>
);

const ShieldIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
  </svg>
);

const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const Landing: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const { user } = useAuth();
  const navigate = useNavigate();

  // Only show navigation options to dashboard if logged in, but don't force redirect
  // This allows users to still view the landing page even when logged in
  const showDashboardOptions = !!user;

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const features = [
    {
      title: "Facial Analysis",
      description: "Get detailed analysis of your facial features with AI-powered precision.",
      icon: <CameraIcon />,
    },
    {
      title: "Progress Tracking",
      description: "Monitor your improvements over time with comprehensive progress tracking.",
      icon: <BarChartIcon />,
    },
    {
      title: "Expert Tips",
      description: "Receive personalized recommendations and tips for improvement.",
      icon: <TipsIcon />,
    },
    {
      title: "Privacy Protection",
      description: "Your data is securely stored with end-to-end encryption for total privacy.",
      icon: <ShieldIcon />,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className={`sticky top-0 z-50 w-full backdrop-blur-lg transition-all duration-300 ${
          isScrolled ? "bg-surface/80 shadow-sm" : "bg-transparent"
        }`}
      >
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2 font-bold">
            <img src="/logo512.png" alt="GRME Logo" className="h-8 w-8 rounded-lg" />
            <span>GRME</span>
          </div>
          <nav className="hidden md:flex gap-8">
            <a href="#features" className="text-sm font-medium text-muted transition-colors hover:text-text">
              Features
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-muted transition-colors hover:text-text">
              How It Works
            </a>
            <a href="#pricing" className="text-sm font-medium text-muted transition-colors hover:text-text">
              Pricing
            </a>
          </nav>
          <div className="hidden md:flex gap-4 items-center">
            {!showDashboardOptions ? (
              <>
                <Link to="/login" className="text-sm font-medium text-muted transition-colors hover:text-text">
                  Log in
                </Link>
                <Link to="/register" className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-buttonText hover:bg-accent/90">
                  Get Started
                  <ChevronRightIcon />
                </Link>
              </>
            ) : (
              <Link to="/face-rating" className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-buttonText hover:bg-accent/90">
                Dashboard
              </Link>
            )}
          </div>
          <div className="flex items-center md:hidden">
            <button
              className="rounded-md p-2 text-text"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-16 inset-x-0 bg-surface border-b border-accent/20">
            <div className="container mx-auto py-4 flex flex-col gap-4 px-4">
              <a href="#features" className="py-2 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>
                Features
              </a>
              <a href="#how-it-works" className="py-2 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>
                How It Works
              </a>
              <a href="#pricing" className="py-2 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>
                Pricing
              </a>
              <div className="flex flex-col gap-2 pt-2 border-t border-accent/20">
                {!showDashboardOptions ? (
                  <>
                    <Link to="/login" className="py-2 text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>
                      Log in
                    </Link>
                    <Link to="/register" className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-buttonText">
                      Get Started
                    </Link>
                  </>
                ) : (
                  <Link to="/face-rating" className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-buttonText">
                    Dashboard
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full py-20 md:py-32 relative overflow-hidden">
          <div className="container mx-auto px-4 relative">
            <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#1a1a1a_1px,transparent_1px),linear-gradient(to_bottom,#1a1a1a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]"></div>
            
            <div className="text-center max-w-3xl mx-auto mb-12 animate-fadeIn">
              <div className="mb-4 rounded-full bg-accent/10 px-4 py-1.5 text-sm font-medium inline-block animate-slideDown">
                Facial Harmony Analysis
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 animate-slideUp">
                Discover Your Facial Harmony
              </h1>
              <p className="text-lg md:text-xl text-muted mb-8 max-w-2xl mx-auto animate-fadeIn animation-delay-300">
                The advanced AI-powered facial analysis platform to understand your unique
                features, track progress, and receive personalized recommendations.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fadeIn animation-delay-500">
                {!showDashboardOptions ? (
                  <>
                    <Link
                      to="/register"
                      className="rounded-full bg-accent hover:bg-accent/90 px-6 py-3 text-buttonText font-medium transition-transform hover:scale-105"
                    >
                      Get Started
                    </Link>
                    <Link
                      to="/login"
                      className="rounded-full border border-accent/30 hover:bg-surface px-6 py-3 font-medium transition-transform hover:scale-105"
                    >
                      Log In
                    </Link>
                  </>
                ) : (
                  <Link
                    to="/face-rating"
                    className="rounded-full bg-accent hover:bg-accent/90 px-6 py-3 text-buttonText font-medium transition-transform hover:scale-105"
                  >
                    Go to Dashboard
                  </Link>
                )}
              </div>
              <div className="flex items-center justify-center gap-4 mt-6 text-sm text-muted flex-wrap animate-fadeIn animation-delay-700">
                <div className="flex items-center gap-1">
                  <CheckIcon />
                  <span>No credit card</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckIcon />
                  <span>AI-powered</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckIcon />
                  <span>Privacy Protection</span>
                </div>
              </div>
            </div>

            <div className="relative mx-auto max-w-5xl animate-floatUp">
              <div className="rounded-xl overflow-hidden shadow-2xl border border-accent/20 bg-gradient-to-b from-background to-surface transition-all duration-500 hover:shadow-accent/20 hover:shadow-lg">
                <img
                  src="/images/bg_login2.jpg"
                  alt="GRME dashboard"
                  className="w-full h-auto"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = "https://placehold.co/1280x720/121212/8E8E8E?text=GRME+Dashboard";
                  }}
                />
                <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-black/10"></div>
              </div>
              <div className="absolute -bottom-6 -right-6 -z-10 h-[300px] w-[300px] rounded-full bg-accent/5 blur-3xl animate-pulse"></div>
              <div className="absolute -top-6 -left-6 -z-10 h-[300px] w-[300px] rounded-full bg-accent/5 blur-3xl animate-pulse animation-delay-300"></div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="w-full py-20 md:py-28">
          <div className="container mx-auto px-4">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12 animate-fadeIn">
              <div className="rounded-full bg-accent/10 px-4 py-1.5 text-sm font-medium inline-block">
                Features
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Key Features</h2>
              <p className="max-w-[800px] text-muted md:text-lg">
                Our comprehensive platform provides all the tools you need to analyze, track, and improve your facial harmony.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature, i) => (
                <div key={i} className={`h-full animate-fadeIn animation-delay-${i * 200}`}>
                  <div className="h-full overflow-hidden border border-accent/20 bg-surface hover:bg-hover transition-all hover:shadow-md rounded-lg p-6 hover:-translate-y-1 duration-300">
                    <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center text-accent mb-4">
                      {feature.icon}
                    </div>
                    <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                    <p className="text-muted">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="w-full py-20 md:py-28 bg-surface/50 relative overflow-hidden">
          <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#1a1a1a_1px,transparent_1px),linear-gradient(to_bottom,#1a1a1a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_40%,transparent_100%)]"></div>

          <div className="container mx-auto px-4 relative">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-16 animate-fadeIn">
              <div className="rounded-full bg-accent/10 px-4 py-1.5 text-sm font-medium inline-block">
                How It Works
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Simple Process, Powerful Results</h2>
              <p className="max-w-[800px] text-muted md:text-lg">
                Get started in minutes and see the difference our platform can make for your facial harmony.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 md:gap-12 relative">
              <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent/20 to-transparent -translate-y-1/2 z-0"></div>

              {[
                {
                  step: "01",
                  title: "Upload Photos",
                  description: "Submit clear front-facing and profile photos for analysis.",
                },
                {
                  step: "02",
                  title: "Receive Analysis",
                  description: "Get a comprehensive report on your facial features and harmony.",
                },
                {
                  step: "03",
                  title: "Track Progress",
                  description: "Follow recommendations and document improvements over time.",
                },
              ].map((step, i) => (
                <div
                  key={i}
                  className={`relative z-10 flex flex-col items-center text-center space-y-4 animate-fadeIn animation-delay-${i * 300}`}
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-buttonText text-xl font-bold shadow-lg transition-transform hover:scale-110 duration-300">
                    {step.step}
                  </div>
                  <h3 className="text-xl font-bold">{step.title}</h3>
                  <p className="text-muted">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="w-full py-20 md:py-28">
          <div className="container mx-auto px-4">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12 animate-fadeIn">
              <div className="rounded-full bg-accent/10 px-4 py-1.5 text-sm font-medium inline-block">
                Pricing
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Simple, Transparent Pricing</h2>
              <p className="max-w-[800px] text-muted md:text-lg">
                Choose the plan that's right for you.
              </p>
              
              {/* Billing cycle selector */}
              <div className="flex items-center mt-6 p-1 bg-surface/80 border border-accent/20 rounded-full">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
                    billingCycle === 'monthly' 
                      ? 'bg-accent text-buttonText' 
                      : 'hover:bg-surface/80'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle('yearly')}
                  className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
                    billingCycle === 'yearly' 
                      ? 'bg-accent text-buttonText' 
                      : 'hover:bg-surface/80'
                  }`}
                >
                  Yearly <span className="text-xs ml-1 text-accent/80">(Save 17%)</span>
                </button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2 lg:gap-8 max-w-4xl mx-auto">
              <div className="border border-accent/20 rounded-lg overflow-hidden bg-surface backdrop-blur transition-all hover:shadow-md p-6 animate-slideInLeft">
                <h3 className="text-2xl font-bold">Free</h3>
                <div className="flex items-baseline mt-4">
                  <span className="text-4xl font-bold">$0</span>
                </div>
                <p className="text-muted mt-2">Basic facial analysis to get you started.</p>
                <ul className="space-y-3 my-6">
                  <li className="flex items-center">
                    <CheckIcon />
                    <span className="ml-2">Basic facial analysis</span>
                  </li>
                  <li className="flex items-center">
                    <CheckIcon />
                    <span className="ml-2">Limited progress tracking</span>
                  </li>
                  <li className="flex items-center">
                    <CheckIcon />
                    <span className="ml-2">Standard tips</span>
                  </li>
                </ul>
                {!showDashboardOptions ? (
                  <Link
                    to="/register"
                    className="w-full block text-center rounded-full border border-accent px-6 py-3 font-medium hover:bg-accent/10 transition-transform hover:scale-105"
                  >
                    Get Started
                  </Link>
                ) : (
                  <Link
                    to="/face-rating"
                    className="w-full block text-center rounded-full border border-accent px-6 py-3 font-medium hover:bg-accent/10 transition-transform hover:scale-105"
                  >
                    Dashboard
                  </Link>
                )}
              </div>

              <div className="border border-accent rounded-lg overflow-hidden bg-surface backdrop-blur transition-all shadow-lg p-6 relative animate-slideInRight">
                <div className="absolute top-0 right-0 bg-accent text-buttonText px-3 py-1 text-xs rounded-bl-lg">
                  Popular
                </div>
                <h3 className="text-2xl font-bold">Premium</h3>
                <div className="flex items-baseline mt-4">
                  <span className="text-4xl font-bold">${billingCycle === 'monthly' ? '2.99' : '2.49'}</span>
                  <span className="text-muted ml-1">/month</span>
                </div>
                {billingCycle === 'yearly' && (
                  <div className="text-xs text-muted mt-1">
                    Billed annually (${(2.49 * 12).toFixed(2)}/year)
                  </div>
                )}
                <p className="text-muted mt-2">Enhanced analysis with advanced features.</p>
                <ul className="space-y-3 my-6">
                  <li className="flex items-center">
                    <CheckIcon />
                    <span className="ml-2">Advanced AI facial analysis</span>
                  </li>
                  <li className="flex items-center">
                    <CheckIcon />
                    <span className="ml-2">Unlimited progress tracking</span>
                  </li>
                  <li className="flex items-center">
                    <CheckIcon />
                    <span className="ml-2">Personalized improvement tips</span>
                  </li>
                  <li className="flex items-center">
                    <CheckIcon />
                    <span className="ml-2">Custom personal routines</span>
                  </li>
                  <li className="flex items-center">
                    <CheckIcon />
                    <span className="ml-2">Premium badge</span>
                  </li>
                </ul>
                {!showDashboardOptions ? (
                  <Link
                    to={`/register?plan=premium&billing=${billingCycle}`}
                    className="w-full block text-center rounded-full bg-accent px-6 py-3 font-medium text-buttonText hover:bg-accent/90 transition-transform hover:scale-105"
                  >
                    Start Premium
                  </Link>
                ) : (
                  <Link
                    to={`/subscription?billing=${billingCycle}`}
                    className="w-full block text-center rounded-full bg-accent px-6 py-3 font-medium text-buttonText hover:bg-accent/90 transition-transform hover:scale-105"
                  >
                    Upgrade to Premium
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="w-full py-20 md:py-28 bg-accent/90 text-buttonText relative overflow-hidden animate-fadeIn">
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#ffffff10_1px,transparent_1px),linear-gradient(to_bottom,#ffffff10_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse animation-delay-500"></div>

          <div className="container mx-auto px-4 relative">
            <div className="flex flex-col items-center justify-center space-y-6 text-center">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight animate-slideUp">
                Ready to Transform Your Facial Harmony?
              </h2>
              <p className="mx-auto max-w-[700px] text-buttonText/90 md:text-xl animate-fadeIn animation-delay-300">
                Join thousands of satisfied users who have improved their facial features and boosted their confidence.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mt-4 animate-fadeIn animation-delay-500">
                {!showDashboardOptions ? (
                  <>
                    <Link
                      to="/register"
                      className="rounded-full bg-buttonText text-background hover:bg-buttonText/90 px-8 py-3 font-medium transition-transform hover:scale-105"
                    >
                      Get Started
                    </Link>
                    <Link
                      to="/login"
                      className="rounded-full border border-buttonText text-buttonText hover:bg-buttonText/10 px-8 py-3 font-medium transition-transform hover:scale-105"
                    >
                      Log In
                    </Link>
                  </>
                ) : (
                  <Link
                    to="/face-rating"
                    className="rounded-full bg-buttonText text-background hover:bg-buttonText/90 px-8 py-3 font-medium transition-transform hover:scale-105"
                  >
                    Go to Dashboard
                  </Link>
                )}
              </div>
              <p className="text-sm text-buttonText/80 mt-4 animate-fadeIn animation-delay-700">
                No credit card required. Cancel anytime.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full border-t border-accent/20 bg-background">
        <div className="container mx-auto flex flex-col gap-8 px-4 py-10 md:py-16">
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3">
            <div className="space-y-4">
              <div className="flex items-center gap-2 font-bold">
                <img src="/logo512.png" alt="GRME Logo" className="h-8 w-8 rounded-lg" />
                <span>GRME</span>
              </div>
              <p className="text-sm text-muted">
                The advanced AI-powered facial analysis platform to understand your unique features.
              </p>
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-bold">Product</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#features" className="text-muted hover:text-text transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="text-muted hover:text-text transition-colors">
                    Pricing
                  </a>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-bold">Company</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/privacy-policy" className="text-muted hover:text-text transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms-of-service" className="text-muted hover:text-text transition-colors">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row justify-between items-center border-t border-accent/20 pt-8">
            <p className="text-xs text-muted">
              &copy; {new Date().getFullYear()} GRME. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing; 