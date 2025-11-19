export default function PageLoader() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="h-2 w-2 rounded-full bg-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="h-2 w-2 rounded-full bg-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}
