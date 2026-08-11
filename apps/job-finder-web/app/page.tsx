import { AuthPanel } from "./auth-panel";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-10 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Job Finder</h1>
        <p className="text-sm text-zinc-500">
          Somewhere to keep the jobs worth applying to. Nothing here does that
          yet — signing in is the only thing wired up.
        </p>
      </div>

      <AuthPanel />
    </main>
  );
}
