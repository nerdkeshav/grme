import React from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../layout/AppLayout';
import { useAuth } from '../../context/AuthContext';

const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  
  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}!</h1>
          <p className="text-muted">Your personal GRME dashboard</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-surface rounded-lg border border-border p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Facial Analysis</h2>
            <p className="text-text/70 mb-4">
              Upload a photo for AI-powered analysis of your facial features and harmony.
            </p>
            <Link to="/face-rating" className="inline-flex items-center text-accent hover:underline">
              Get Started
              <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          
          <div className="bg-surface rounded-lg border border-border p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Progress Tracking</h2>
            <p className="text-text/70 mb-4">
              Monitor your improvements over time with comprehensive tracking tools.
            </p>
            <Link to="/progress" className="inline-flex items-center text-accent hover:underline">
              View Progress
              <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          
          <div className="bg-surface rounded-lg border border-border p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Improvement Tips</h2>
            <p className="text-text/70 mb-4">
              Discover personalized recommendations to enhance your facial harmony.
            </p>
            <Link to="/tips" className="inline-flex items-center text-accent hover:underline">
              Explore Tips
              <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          
          <div className="bg-surface rounded-lg border border-border p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Habits Tracker</h2>
            <p className="text-text/70 mb-4">
              Build healthy habits that support your improvement goals.
            </p>
            <Link to="/habits" className="inline-flex items-center text-accent hover:underline">
              Manage Habits
              <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          
          <div className="bg-surface rounded-lg border border-border p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Community</h2>
            <p className="text-text/70 mb-4">
              Connect with others on similar journeys and share experiences.
            </p>
            <Link to="/leaderboard" className="inline-flex items-center text-accent hover:underline">
              Join Community
              <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          
          {!profile?.is_premium && (
            <div className="bg-accent/10 border border-accent rounded-lg p-6 shadow-sm">
              <h2 className="text-xl font-semibold mb-4">Upgrade to Premium</h2>
              <p className="text-text/70 mb-4">
                Get access to advanced analysis features, unlimited progress tracking, and personalized recommendations.
              </p>
              <Link to="/subscription" className="inline-flex items-center text-accent hover:underline">
                View Plans
                <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard; 