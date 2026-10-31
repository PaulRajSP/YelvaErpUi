import { useLayoutEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    Home, ShoppingCart, Users, Package, FileText, BarChart3, Bell,
    Truck, PackageOpen, Activity, Wallet, Box, Receipt, LogOut, ShieldCheck
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { RoleEnum } from '../../common/roles';

// Icon mapping for navigation links
const NAV_ICONS = {
    '/': Home,
    '/dashboard': Home,
    '/orders': FileText,
    '/new-order': ShoppingCart,
    '/customers': Users,
    '/products': Package,
    '/materials': Package,
    '/purchases': PackageOpen,
    '/production': Activity,
    '/packing': Box,
    '/logistics': Truck,
    '/couriers': Truck,
    '/accounts': Wallet,
    '/expenses': Receipt,
    '/employees': ShieldCheck,
    '/sales': BarChart3,
};

export default function Layout() {
    const { currentUser, userMenus = [], logout } = useStore();
    const navigate = useNavigate();
    const location = useLocation();
    const [showFirstLoadSkeleton, setShowFirstLoadSkeleton] = useState(false);
    const loadingRequests = useRef(new Map());
    const loadedRoutes = useRef(new Set());
    const activePath = useRef(location.pathname);

    const userRoles = currentUser?.roles || (currentUser?.role ? [currentUser.role] : [RoleEnum.Staff]);
    const userInitial = (currentUser?.name || currentUser?.employeeCode || 'U').charAt(0).toUpperCase();
    const primaryRole = userRoles[0] || 'STAFF';

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    useLayoutEffect(() => {
        activePath.current = location.pathname;
        if (loadedRoutes.current.has(location.pathname)) {
            setShowFirstLoadSkeleton(false);
        }
    }, [location.pathname]);

    useLayoutEffect(() => {
        const handleRequestStart = event => {
            const requestPath = activePath.current;
            loadingRequests.current.set(event.detail.requestId, requestPath);
            if (!loadedRoutes.current.has(requestPath)) {
                setShowFirstLoadSkeleton(true);
            }
        };

        const handleRequestEnd = event => {
            const requestPath = loadingRequests.current.get(event.detail.requestId);
            loadingRequests.current.delete(event.detail.requestId);
            if (!requestPath) return;

            const hasPendingRequests = [...loadingRequests.current.values()].includes(requestPath);
            if (!hasPendingRequests) {
                loadedRoutes.current.add(requestPath);
                if (activePath.current === requestPath) {
                    setShowFirstLoadSkeleton(false);
                }
            }
        };

        window.addEventListener('api:request-start', handleRequestStart);
        window.addEventListener('api:request-end', handleRequestEnd);
        return () => {
            window.removeEventListener('api:request-start', handleRequestStart);
            window.removeEventListener('api:request-end', handleRequestEnd);
        };
    }, []);

    return (
        <div className="flex h-screen bg-[#f4f7f6] font-sans text-slate-800">
            {/* SIDEBAR */}
            <aside className="w-[220px] bg-white border-r border-slate-200 text-slate-700 flex flex-col hidden md:flex z-20 relative">
                {/* Logo */}
                <div className="px-5 py-5 flex items-center gap-3 border-b border-slate-200">
                    <img src="/logo.png" alt="Logo" className="w-9 h-9 object-contain" />
                    <div>
                        <h1 className="text-base font-black text-slate-900 tracking-tight leading-none">Yelva Honey</h1>
                        <p className="text-[9px] text-slate-500 font-bold tracking-widest uppercase mt-0.5">Billing System</p>
                    </div>
                </div>

                {/* Nav - strictly renders only the menus received in login */}
                <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto no-scrollbar">
                    {userMenus && userMenus.length > 0 ? (
                        userMenus.map((menu, index) => {
                            const IconComponent = NAV_ICONS[menu.frontendUrl] || Package;
                            const showHeader = menu.moduleName && (index === 0 || userMenus[index - 1]?.moduleName !== menu.moduleName);
                            const isActive = location.pathname === menu.frontendUrl ||
                                (menu.frontendUrl !== '/' && location.pathname.startsWith(`${menu.frontendUrl}/`));

                            return (
                                <div key={menu.id || menu.frontendUrl || index}>
                                    {showHeader && (
                                        <div className="px-3 pt-3 pb-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{menu.moduleName}</p>
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        aria-current={isActive ? 'page' : undefined}
                                        onClick={() => navigate(menu.frontendUrl)}
                                        className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 ${isActive
                                            ? 'bg-slate-100 text-slate-900 border-l-4 border-slate-900'
                                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                        }`}
                                    >
                                        <IconComponent size={17} strokeWidth={isActive ? 2.5 : 2} />
                                        <span>{menu.menuName}</span>
                                    </button>
                                </div>
                            );
                        })
                    ) : (
                        <div className="px-3 py-4 text-xs text-slate-400">No menus available</div>
                    )}
                </nav>

                {/* Bottom user badge & version */}
                <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <div className="h-7 w-7 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-xs shrink-0">
                            {userInitial}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-xs font-bold text-slate-900 truncate leading-none">
                                {currentUser?.name || currentUser?.employeeCode || 'User'}
                            </p>
                            <p className="text-[10px] text-slate-500 font-medium mt-0.5 uppercase tracking-wide truncate">
                                {primaryRole}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="text-slate-400 hover:text-red-600 transition-colors cursor-pointer p-1 rounded hover:bg-white shrink-0"
                        title="Sign Out"
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </aside>

            <main className="flex-1 flex flex-col overflow-hidden relative">
                {/* TOP HEADER */}
                <header className="bg-white py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between px-6 z-10 sticky top-0 border-b border-slate-200 min-h-[72px] gap-4 sm:gap-0">
                    <div className="flex flex-col flex-1">
                        {/* Title or breadcrumb */}
                    </div>

                    <div className="flex items-center gap-4 ml-auto">
                        <button className="relative text-slate-500 hover:text-slate-700 transition-colors cursor-pointer">
                            <Bell size={18} />
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                        </button>

                        <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
                            <div className="h-8 w-8 rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-xs">
                                {userInitial}
                            </div>
                            <div className="hidden sm:block text-left">
                                <p className="text-xs font-bold text-slate-900 leading-none">
                                    {currentUser?.name || currentUser?.employeeCode || 'User'}
                                </p>
                                <span className="text-[10px] px-1.5 py-0.2 rounded font-bold uppercase mt-1 inline-block bg-slate-100 text-slate-600">
                                    {primaryRole}
                                </span>
                            </div>

                            <button
                                onClick={handleLogout}
                                className="ml-2 text-slate-400 hover:text-red-500 transition-colors cursor-pointer p-1.5 rounded-lg hover:bg-slate-50"
                                title="Sign Out"
                            >
                                <LogOut size={16} />
                            </button>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto no-scrollbar p-5 md:p-6 w-full mx-auto">
                    <div className={showFirstLoadSkeleton ? 'hidden' : ''}>
                        <Outlet />
                    </div>
                    {showFirstLoadSkeleton && <PageSkeleton />}
                </div>
            </main>
        </div>
    );
}

function PageSkeleton() {
    return (
        <div aria-hidden="true" className="space-y-6 animate-pulse">
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <div className="h-6 w-48 rounded bg-slate-200" />
                    <div className="h-3 w-64 rounded bg-slate-100" />
                </div>
                <div className="h-9 w-28 rounded-lg bg-slate-200" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }, (_, index) => (
                    <div key={index} className="h-24 rounded-xl border border-slate-200 bg-white p-5">
                        <div className="h-3 w-20 rounded bg-slate-100" />
                        <div className="mt-4 h-6 w-24 rounded bg-slate-200" />
                    </div>
                ))}
            </div>
            <div className="h-72 rounded-xl border border-slate-200 bg-white p-5">
                <div className="h-4 w-36 rounded bg-slate-200" />
                <div className="mt-6 space-y-4">
                    {Array.from({ length: 5 }, (_, index) => (
                        <div key={index} className="h-8 rounded bg-slate-100" />
                    ))}
                </div>
            </div>
        </div>
    );
}
