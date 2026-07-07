"use client";

import { useEffect, useState } from "react";
import { OnlineFriendsStrip } from "./OnlineFriendsStrip";
import { FeedPageGrid } from "./FeedPageGrid";
import { FeedPeopleSearch } from "./FeedPeopleSearch";
import { NotificationsBell } from "./NotificationsBell";
import { SearchBar } from "./SearchBar";

type Props = {
  showOnlineFriends?: boolean;
  collapseFriendsOnScroll?: boolean;
};

export function FeedTopBar({ showOnlineFriends = false, collapseFriendsOnScroll = false }: Props) {
  const [friendsHidden, setFriendsHidden] = useState(false);

  useEffect(() => {
    if (!showOnlineFriends || !collapseFriendsOnScroll) return;

    const scrollRoot = document.querySelector(".feed-layout-main");
    if (!scrollRoot) return;

    const onScroll = () => {
      const y = scrollRoot.scrollTop;
      setFriendsHidden(y > 72);
    };

    onScroll();
    scrollRoot.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollRoot.removeEventListener("scroll", onScroll);
  }, [showOnlineFriends, collapseFriendsOnScroll]);

  useEffect(() => {
    if (!showOnlineFriends || !collapseFriendsOnScroll) return;

    const scrollRoot = document.querySelector(".feed-layout-main");
    if (!scrollRoot) return;

    scrollRoot.classList.toggle("feed-home-friends-hidden", friendsHidden);
    return () => scrollRoot.classList.remove("feed-home-friends-hidden");
  }, [friendsHidden, showOnlineFriends, collapseFriendsOnScroll]);

  return (
    <header
      className={`sticky top-0 z-30 toq-topbar backdrop-blur-md ${
        showOnlineFriends ? "toq-topbar--feed-home" : ""
      }`}
    >
      {!showOnlineFriends && (
        <div className="hidden md:block">
          <FeedPageGrid className="py-3">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1 max-w-md">
                <SearchBar />
              </div>
              <NotificationsBell />
            </div>
          </FeedPageGrid>
        </div>
      )}

      {showOnlineFriends && (
        <div className="feed-friends-strip">
          <FeedPageGrid
            className={`feed-home-top-grid py-0 ${friendsHidden ? "feed-home-top-grid--friends-hidden" : ""}`}
            sidebar={<FeedPeopleSearch />}
            sidebarSticky={false}
          >
            <div
              className={`feed-friends-collapsible overflow-hidden transition-all duration-300 ease-out ${
                friendsHidden ? "max-h-0 opacity-0" : "max-h-48 opacity-100"
              }`}
            >
              <OnlineFriendsStrip embedded edgeToEdge={collapseFriendsOnScroll} />
            </div>
          </FeedPageGrid>
        </div>
      )}
    </header>
  );
}
