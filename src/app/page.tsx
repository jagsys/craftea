import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-center font-mono text-sm">
        <h1 className="text-4xl font-bold mb-4 text-center">
          Craftea
        </h1>
        <p className="text-xl text-center mb-8 text-gray-400">
          3D Structure Design Tool
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/editor"
            className="rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
          >
            Open Editor
          </Link>
        </div>
      </div>
    </main>
  );
}
