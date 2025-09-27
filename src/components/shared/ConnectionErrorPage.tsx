import React, { useState, useEffect } from 'react';
import { checkDatabaseHealth, cleanAndRotateAuthStorage, forceCleanAllTokens } from '../../utils/supabaseClient';
import { checkConnection } from '../../utils/connectionManager';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../utils/supabaseClient';

interface ConnectionErrorPageProps {
  onRetry?: () => void;
  onConnectionRestored?: () => void;
  onSessionReset?: () => void;
}

const ConnectionErrorPage: React.FC<ConnectionErrorPageProps> = ({ onRetry, onConnectionRestored, onSessionReset }) => {
  // Return null to not render anything
  return null;
};

export default ConnectionErrorPage; 