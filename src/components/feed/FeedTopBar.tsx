import { appTopBarClass } from "@/lib/layout";
import { NotificationsBell } from "./NotificationsBell";
import { OnlineFriendsStrip } from "./OnlineFriendsStrip";
import { SearchBar } from "./SearchBar";

export function FeedTopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className={`${appTopBarClass} flex items-center gap-3`}>
        <div className="w-1/2 min-w-0 max-w-md shrink-0">
          <SearchBar />
        </div>
        <NotificationsBell />
      </div>
      <OnlineFriendsStrip />
    </header>
  );
}
