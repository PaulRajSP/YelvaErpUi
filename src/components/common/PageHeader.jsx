export default function PageHeader({ title, subtitle, rightContent }) {
    return (
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
            <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h2>
                {subtitle && (
                    <p className="text-slate-500 text-sm font-medium mt-0.5">{subtitle}</p>
                )}
            </div>
            {rightContent && (
                <div className="flex flex-wrap items-center gap-3">
                    {rightContent}
                </div>
            )}
        </div>
    );
}
