import { SearchBar } from "./SearchBar";

export function FeedTopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto max-w-2xl px-4 py-3 md:max-w-3xl md:px-6">
        <SearchBar />
      </div>
    </header>
  );
}
