import { useAppContext } from '../context';

export const useAuth = () => {
    const { user, setUser } = useAppContext();
    
    const logout = () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('biashara_auth_token');
            localStorage.removeItem('biashara_user');
        }
        setUser(null);
    };

    return {
        user,
        isAuthenticated: !!user,
        role: user?.role || 'guest',
        logout,
        setUser
    };
};

export default useAuth;

