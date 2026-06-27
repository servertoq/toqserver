import { feedPageContainerClass, feedPageGridClass } from "@/lib/layout";

type Props = {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  className?: string;
  alignSidebar?: boolean;
  /** Mantém a coluna de publicidade fixa ao rolar (só na home) */
  pinSidebar?: boolean;
};

export function FeedPageGrid({
  children,
  sidebar,
  className = "",
  alignSidebar = true,
  pinSidebar = false,
}: Props) {
  return (
    <div className={`${feedPageContainerClass} ${className}`.trim()}>
      <div className={feedPageGridClass}>
        <div className="min-w-0">{children}</div>
        {alignSidebar ? (
          <aside
            className={
              pinSidebar
                ? "w-full lg:w-[280px] lg:shrink-0"
                : "lg:sticky lg:top-28 lg:self-start"
            }
          >
            {sidebar ? (
              pinSidebar ? (
                <div className="feed-ad-sidebar-slot">{sidebar}</div>
              ) : (
                sidebar
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
