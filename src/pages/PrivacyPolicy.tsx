import React from 'react';
import { Link } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 w-full bg-surface/80 backdrop-blur-lg shadow-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <img src="/logo512.png" alt="GRME Logo" className="h-8 w-8 rounded-lg" />
            <span>GRME</span>
          </Link>
          <Link 
            to="/" 
            className="rounded-full border border-accent/30 hover:bg-surface px-4 py-2 text-sm font-medium"
          >
            Back to Home
          </Link>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 md:py-12 max-w-4xl">
        <h1 className="text-3xl md:text-4xl font-bold mb-8">Privacy Policy</h1>

        <div className="prose prose-invert max-w-none">
          <p className="text-lg text-muted mb-6">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">1. Introduction</h2>
          <p>
            Welcome to GRME ("we," "our," or "us"). We respect your privacy and are committed to protecting your personal data. 
            This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our facial analysis 
            application and related services.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">2. Information We Collect</h2>
          <p>We collect several types of information from and about users of our application, including:</p>
          <ul className="list-disc pl-6 space-y-2 mt-4">
            <li>
              <strong>Personal Data:</strong> We may collect personal information that you provide directly to us, such as your name, email address, 
              and payment information when you register or subscribe to our services.
            </li>
            <li>
              <strong>Facial Images:</strong> Our application collects and processes facial images that you choose to upload for analysis. 
              These images are used solely for the purpose of providing our facial analysis services.
            </li>
            <li>
              <strong>Usage Data:</strong> We collect information about how you interact with our application, including the features you use, 
              the time spent on the application, and other diagnostic data.
            </li>
            <li>
              <strong>Device Information:</strong> We collect information about the device you use to access our application, including the 
              hardware model, operating system, unique device identifiers, and mobile network information.
            </li>
          </ul>

          <h2 className="text-xl font-semibold mt-8 mb-4">3. How We Use Your Information</h2>
          <p>We use the information we collect for various purposes, including to:</p>
          <ul className="list-disc pl-6 space-y-2 mt-4">
            <li>Provide, maintain, and improve our services</li>
            <li>Process and complete transactions</li>
            <li>Perform facial analysis and provide you with results and recommendations</li>
            <li>Send you technical notices, updates, security alerts, and support messages</li>
            <li>Respond to your comments, questions, and customer service requests</li>
            <li>Monitor and analyze trends, usage, and activities in connection with our services</li>
            <li>Detect, investigate, and prevent fraudulent transactions and other illegal activities</li>
            <li>Personalize your experience and provide content relevant to your interests</li>
          </ul>

          <h2 className="text-xl font-semibold mt-8 mb-4">4. Data Security</h2>
          <p>
            We have implemented appropriate technical and organizational measures to secure your personal data from accidental loss 
            and unauthorized access, use, alteration, or disclosure. All information you provide to us is stored on secure servers, 
            and any payment transactions will be encrypted using industry-standard technology.
          </p>
          <p className="mt-4">
            However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to use commercially 
            acceptable means to protect your personal data, we cannot guarantee its absolute security.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">5. Data Retention</h2>
          <p>
            We will retain your personal data only for as long as necessary to fulfill the purposes for which we collected it, 
            including for the purposes of satisfying any legal, accounting, or reporting requirements. To determine the appropriate 
            retention period, we consider the amount, nature, and sensitivity of the personal data, the potential risk of harm from 
            unauthorized use or disclosure, and applicable legal requirements.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">6. Your Data Protection Rights</h2>
          <p>Depending on your location, you may have the following rights regarding your personal data:</p>
          <ul className="list-disc pl-6 space-y-2 mt-4">
            <li>The right to access, update, or delete your information</li>
            <li>The right to rectification (to correct inaccurate or incomplete data)</li>
            <li>The right to object to our processing of your personal data</li>
            <li>The right to restriction (to request that we restrict the processing of your personal data)</li>
            <li>The right to data portability (to receive a copy of your data in a structured, machine-readable format)</li>
            <li>The right to withdraw consent at any time where we relied on your consent to process your personal data</li>
          </ul>

          <h2 className="text-xl font-semibold mt-8 mb-4">7. Children's Privacy</h2>
          <p>
            Our service is not intended for individuals under the age of 16. We do not knowingly collect personal data from children under 16. 
            If we become aware that we have collected personal data from a child under 16 without verification of parental consent, 
            we take steps to remove that information from our servers.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">8. Changes to This Privacy Policy</h2>
          <p>
            We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy 
            on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">9. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us at:
          </p>
          <p className="mt-2">
            <strong>Email:</strong> privacy@GRME.app
          </p>
        </div>
      </main>

      <footer className="w-full border-t border-accent/20 bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col gap-4 sm:flex-row justify-between items-center">
            <p className="text-xs text-muted">
              &copy; {new Date().getFullYear()} GRME. All rights reserved.
            </p>
            <div className="flex gap-4 text-xs text-muted">
              <Link to="/privacy-policy" className="hover:text-text">Privacy Policy</Link>
              <Link to="/terms-of-service" className="hover:text-text">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PrivacyPolicy; 