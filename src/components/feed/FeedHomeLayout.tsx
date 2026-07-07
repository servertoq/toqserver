"use client";

import { useEffect, useState } from "react";
import { feedPageContainerClass } from "@/lib/layout";
import { FeedAdCarousel } from "./FeedAdCarousel";
import { FeedFriendSuggestions } from "./FeedFriendSuggestions";
import { FeedPeopleSearch } from "./FeedPeopleSearch";
import { NotificationsBell } from "./NotificationsBell";
import { OnlineFriendsStrip } from "./OnlineFriendsStrip";

type Props = {
  children: React.ReactNode;
  onOpenCreatePost?: () => void;
};

export function FeedHomeLayout({ children, onOpenCreatePost }: Props) {
  const [friendsHidden, setFriendsHidden] = useState(false);

  useEffect(() => {
    const scrollRoot = document.querySelector(".feed-layout-main");
    if (!scrollRoot) return;

    const onScroll = () => {
      setFriendsHidden(scrollRoot.scrollTop > 72);
    };

    onScroll();
    scrollRoot.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollRoot.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`${feedPageContainerClass} feed-home-grid py-4 md:py-6 ${
        friendsHidden ? "feed-home-friends-hidden" : ""
      }`}
    >
      <div className="feed-home-left-col min-w-0">
        <div
          className={`feed-home-friends overflow-hidden transition-all duration-300 ease-out ${
            friendsHidden ? "max-h-0 opacity-0" : "max-h-48 opacity-100"
          }`}
        >
          <OnlineFriendsStrip embedded edgeToEdge onOpenCreatePost={onOpenCreatePost} />
        </div>
        <main className="feed-home-main-col">{children}</main>
      </div>

      <aside className="feed-home-rail-col hidden lg:block" aria-label="Busca, sugestões e publicidade">
        <div className="feed-home-rail-sticky">
          <div className="feed-home-rail-toolbar">
            <FeedPeopleSearch />
            <NotificationsBell compact />
          </div>
          <FeedFriendSuggestions />
          <div className="feed-home-ad-slot">
            <FeedAdCarousel />
          </div>
        </div>
      </aside>
    </div>
  );
}
