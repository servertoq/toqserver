import { feedPageContainerClass, feedPageGridClass } from "@/lib/layout";

type Props = {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  className?: string;
  alignSidebar?: boolean;
  sidebarSticky?: boolean;
};

export function FeedPageGrid({
  children,
  sidebar,
  className = "",
  alignSidebar = true,
  sidebarSticky = true,
}: Props) {
  return (
    <div className={`${feedPageContainerClass} ${className}`.trim()}>
      <div className={feedPageGridClass}>
        <div className="min-w-0">{children}</div>
        {alignSidebar ? (
          <aside className="feed-sidebar-aside w-full lg:w-[280px] lg:shrink-0">
            {sidebar ? (
              sidebarSticky ? (
                <div className="feed-sidebar-sticky">{sidebar}</div>
              ) : (
                <div className="feed-sidebar-inline">{sidebar}</div>
              )
            ) : (
              <span className="block" aria-hidden />
            )}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
