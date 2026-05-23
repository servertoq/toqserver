import { feedPageContainerClass, feedPageGridClass } from "@/lib/layout";

type Props = {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  className?: string;
  alignSidebar?: boolean;
};

export function FeedPageGrid({
  children,
  sidebar,
  className = "",
  alignSidebar = true,
}: Props) {
  return (
    <div className={`${feedPageContainerClass} ${className}`.trim()}>
      <div className={feedPageGridClass}>
        <div className="min-w-0">{children}</div>
        {alignSidebar ? (
          <aside className="lg:sticky lg:top-28 lg:self-start">
            {sidebar ?? <span className="block" aria-hidden />}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
