import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="aurora-wash flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="text-center">
        <p className="font-serif text-4xl tracking-tight text-ink">RelAI</p>
        <p className="mt-1 text-sm text-quiet">
          The agent who never forgets what your client said.
        </p>
      </div>
      <SignUp />
    </div>
  );
}
