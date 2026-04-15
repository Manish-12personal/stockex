import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

/**
 * LoginAs Page - Handles superadmin login-as functionality
 * Receives token and user data via URL params, sets localStorage, and redirects
 */
const LoginAs = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    const type = searchParams.get('type'); // 'admin' or 'user'
    const data = searchParams.get('data');
    const redirect = searchParams.get('redirect') || '/dashboard';

    if (token && data) {
      try {
        const parsedData = JSON.parse(decodeURIComponent(data));
        
        if (type === 'admin') {
          // Clear any existing user session
          localStorage.removeItem('user');
          // Clear existing admin session first
          localStorage.removeItem('admin');
          // Set admin session with the correct key used by AuthContext
          localStorage.setItem('admin', JSON.stringify(parsedData));
          localStorage.setItem('isSuperAdminLogin', 'true');
        } else {
          // Clear any existing admin session
          localStorage.removeItem('admin');
          // Clear existing user session first
          localStorage.removeItem('user');
          // Set user session with the correct key used by AuthContext
          localStorage.setItem('user', JSON.stringify(parsedData));
          localStorage.setItem('isSuperAdminLogin', 'true');
        }
        
        // Redirect to the appropriate dashboard
        window.location.href = redirect;
      } catch (error) {
        console.error('Error parsing login-as data:', error);
        navigate('/');
      }
    } else {
      navigate('/');
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500 mx-auto mb-4"></div>
        <h2 className="text-xl text-white font-semibold">Logging in...</h2>
        <p className="text-gray-400 mt-2">Please wait while we set up your session</p>
      </div>
    </div>
  );
};

export default LoginAs;
