import { FeedAdCarousel } from "@/components/feed/FeedAdCarousel";
import { FeedFriendSuggestions } from "@/components/feed/FeedFriendSuggestions";
import { FeedPeopleSearch } from "@/components/feed/FeedPeopleSearch";

export function FeedSidebar() {
  return (
    <div className="feed-sidebar-stack">
      <div className="lg:hidden">
        <FeedPeopleSearch />
      </div>
      <FeedFriendSuggestions />
      <FeedAdCarousel />
    </div>
  );
}
