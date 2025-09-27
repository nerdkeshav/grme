import React from 'react';
import { Link } from 'react-router-dom';

const TermsOfService: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 w-full bg-surface/80 backdrop-blur-lg shadow-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center text-buttonText">
              G
            </div>
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
        <h1 className="text-3xl md:text-4xl font-bold mb-8">Terms of Service</h1>

        <div className="prose prose-invert max-w-none">
          <p className="text-lg text-muted mb-6">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">1. Introduction</h2>
          <p>
            Welcome to GRME. These Terms of Service ("Terms") govern your access to and use of the GRME application, 
            website, and services (collectively, the "Services"). By accessing or using our Services, you agree to be 
            bound by these Terms and our Privacy Policy.
          </p>
          <p className="mt-4">
            If you do not agree to these Terms, please do not use our Services.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">2. Your Account</h2>
          <p>
            To use certain features of our Services, you may need to create an account. You are responsible for 
            maintaining the confidentiality of your account credentials and for all activities that occur under your account. 
            You agree to:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-4">
            <li>Provide accurate, current, and complete information during the registration process</li>
            <li>Keep your account information updated</li>
            <li>Safeguard your account credentials</li>
            <li>Notify us immediately of any unauthorized use of your account</li>
            <li>Take responsibility for all activities that occur under your account</li>
          </ul>
          <p className="mt-4">
            We reserve the right to suspend or terminate your account if any information provided during the registration 
            process or thereafter proves to be inaccurate, not current, or incomplete.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">3. Subscription and Billing</h2>
          <p>
            Certain features of our Services are available only with a paid subscription. When you purchase a subscription, 
            you agree to the pricing, payment, and billing terms as described at the time of purchase.
          </p>
          <p className="mt-4">
            Subscription fees are billed in advance and are non-refundable, except as required by law or as specifically 
            described in these Terms. Subscriptions automatically renew for additional periods unless canceled before the 
            end of the current period. You can cancel your subscription at any time through your account settings.
          </p>
          <p className="mt-4">
            We reserve the right to change our subscription fees. Any fee changes will take effect at the start of the next 
            subscription period upon notice to you.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">4. User Content</h2>
          <p>
            Our Services allow you to upload, submit, store, send, or receive content, including facial images for analysis. 
            You retain ownership of any intellectual property rights that you hold in that content. When you upload, submit, 
            store, send, or receive content to or through our Services, you give us a worldwide license to use, host, store, 
            reproduce, modify, create derivative works, communicate, publish, publicly perform, publicly display, and distribute 
            such content. This license continues even if you stop using our Services.
          </p>
          <p className="mt-4">
            You represent and warrant that you have the necessary rights to grant us this license for any content you submit 
            to our Services.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">5. Prohibited Uses</h2>
          <p>
            You agree not to use our Services:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-4">
            <li>In any way that violates any applicable federal, state, local, or international law or regulation</li>
            <li>To transmit, or procure the sending of, any advertising or promotional material, including any "junk mail," "chain letter," or "spam"</li>
            <li>To impersonate or attempt to impersonate GRME, a GRME employee, another user, or any other person or entity</li>
            <li>To engage in any other conduct that restricts or inhibits anyone's use or enjoyment of the Services, or which may harm GRME or users of the Services</li>
            <li>To attempt to gain unauthorized access to, interfere with, damage, or disrupt any parts of the Services</li>
            <li>To upload or transmit viruses, Trojan horses, or other material that is malicious or technologically harmful</li>
          </ul>

          <h2 className="text-xl font-semibold mt-8 mb-4">6. Intellectual Property Rights</h2>
          <p>
            The Services and their entire contents, features, and functionality (including but not limited to all information, 
            software, text, images, logos, and designs) are owned by GRME, its licensors, or other providers of such material 
            and are protected by copyright, trademark, patent, trade secret, and other intellectual property or proprietary 
            rights laws.
          </p>
          <p className="mt-4">
            These Terms do not grant you any right, title, or interest in the Services or any content, features, or functionality of the Services.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">7. Disclaimers</h2>
          <p>
            The Services are provided on an "as is" and "as available" basis, without any warranties of any kind, either 
            express or implied. We do not warrant that the Services will be uninterrupted or error-free, that defects will 
            be corrected, or that the Services are free of viruses or other harmful components.
          </p>
          <p className="mt-4">
            While our facial analysis technology uses advanced algorithms, we do not guarantee the accuracy, completeness, 
            or reliability of any analysis or recommendations. The Services are intended for informational and entertainment 
            purposes only and should not be used for medical, diagnostic, or other professional purposes.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">8. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, in no event shall GRME be liable for any indirect, incidental, special, 
            consequential, or punitive damages, including without limitation, loss of profits, data, or goodwill, service 
            interruption, or any other damages or losses arising out of or related to your use or inability to use the Services.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">9. Indemnification</h2>
          <p>
            You agree to defend, indemnify, and hold harmless GRME and its officers, directors, employees, contractors, agents, 
            licensors, and suppliers from and against any claims, liabilities, damages, judgments, awards, losses, costs, expenses, 
            or fees (including reasonable attorneys' fees) arising out of or relating to your violation of these Terms or your use 
            of the Services.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">10. Modifications to the Terms</h2>
          <p>
            We may revise and update these Terms from time to time at our sole discretion. All changes are effective immediately 
            when we post them. Your continued use of the Services following the posting of revised Terms means that you accept and 
            agree to the changes.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">11. Governing Law</h2>
          <p>
            These Terms and any disputes relating to these Terms or the Services shall be governed by and construed in accordance 
            with the laws of the state of California, without regard to its conflict of law provisions.
          </p>

          <h2 className="text-xl font-semibold mt-8 mb-4">12. Contact Information</h2>
          <p>
            Questions or comments about the Services or these Terms may be directed to:
          </p>
          <p className="mt-2">
            <strong>Email:</strong> legal@GRME.app
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

export default TermsOfService; 