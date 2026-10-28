import { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { useNavigate, Navigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { User, Lock, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';

export default function Login() {
    const { login, currentUser, userMenus } = useStore();
    const navigate = useNavigate();

    const [employeeCode, setEmployeeCode] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    if (currentUser) {
        const targetUrl = (userMenus && userMenus.length > 0 && userMenus[0].frontendUrl) ? userMenus[0].frontendUrl : '/';
        return <Navigate to={targetUrl} replace />;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage('');

        if (!employeeCode.trim()) {
            setErrorMessage('Please enter your Employee Code.');
            return;
        }

        if (!password) {
            setErrorMessage('Please enter your password.');
            return;
        }

        setLoading(true);
        try {
            const res = await login(employeeCode.trim(), password);
            if (res.success) {
                const targetUrl = (res.menus && res.menus.length > 0 && res.menus[0].frontendUrl) ? res.menus[0].frontendUrl : '/';
                navigate(targetUrl);
            } else {
                setErrorMessage(res.message || 'Invalid Employee Code or Password.');
            }
        } catch (err) {
            setErrorMessage(err.message || 'Authentication failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-amber-50/40 via-slate-50 to-slate-50 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                <div className="mx-auto w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 border border-amber-100 ring-1 ring-amber-200/40">
                    <img src="/logo.png" alt="Yelva Honey" className="h-12 w-auto object-contain" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    Yelva Honey ERP
                </h2>
                <p className="mt-1.5 text-sm text-slate-500 font-medium">
                    Sign in to your employee account
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <Card className="shadow-sm border border-slate-200 bg-white">
                    <CardContent className="p-6 sm:p-8">
                        {errorMessage && (
                            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700 animate-fadeIn">
                                <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                                <span className="font-medium">{errorMessage}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                label="Employee Code"
                                placeholder="e.g. EMP023"
                                value={employeeCode}
                                onChange={(e) => setEmployeeCode(e.target.value)}
                                icon={User}
                                autoFocus
                                required
                            />

                            <div className="relative">
                                <Input
                                    label="Password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    icon={Lock}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                                    tabIndex={-1}
                                    aria-label="Toggle password visibility"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>

                            <Button
                                type="submit"
                                className="w-full mt-2 flex items-center justify-center gap-2"
                                size="lg"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>Signing in...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Sign In</span>
                                        <ArrowRight size={16} />
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <p className="mt-6 text-center text-[11px] text-slate-400">
                    © {new Date().getFullYear()} Yelva Honey. All rights reserved.
                </p>
            </div>
        </div>
    );
}