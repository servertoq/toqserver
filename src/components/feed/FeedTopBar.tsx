import { FeedPageGrid } from "./FeedPageGrid";
import { NotificationsBell } from "./NotificationsBell";
import { OnlineFriendsStrip } from "./OnlineFriendsStrip";
import { SearchBar } from "./SearchBar";

export function FeedTopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <FeedPageGrid className="py-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 max-w-md">
            <SearchBar />
          </div>
          <NotificationsBell />
        </div>
      </FeedPageGrid>
      <OnlineFriendsStrip />
    </header>
  );
}
