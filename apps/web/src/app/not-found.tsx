import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center aurora-wash">
      <div className="flex flex-col items-center gap-4 px-8 py-12 max-w-md text-center">
        <div
          className="w-20 h-20 rounded-full opacity-60"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, var(--aurora-a) 0%, var(--aurora-b) 70%, transparent 100%)",
          }}
          aria-hidden
        />
        <h1 className="font-serif text-4xl text-ink tracking-tight">Not here.</h1>
        <p className="text-quiet text-base leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist. It may have moved, or the link you
          followed may have expired.
        </p>
        <Link
          href="/"
          className="mt-2 px-5 py-2 rounded-md bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}
