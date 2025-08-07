export default function Logo({ className }: { className?: string }) {
    return (
        <div className={`logo ${className}`}>
            <img
                className="w-full h-full object-cover"
                src="/logo-rounded.png"
                alt="Logo"
            />
        </div>
    );
}
