type Props = {
  src: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  ringClassName?: string;
};

const SIZE_CLASS = {
  sm: "profile-avatar-frame--sm",
  md: "profile-avatar-frame--md",
  lg: "profile-avatar-frame--lg",
} as const;

export function ProfileAvatar({
  src,
  name,
  size = "lg",
  className = "",
  ringClassName = "",
}: Props) {
  const frameClass = `profile-avatar-frame ${SIZE_CLASS[size]} ${ringClassName} ${className}`.trim();

  if (src) {
    return (
      <div className={frameClass}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="profile-avatar-img" />
      </div>
    );
  }

  const initial = name.charAt(0).toUpperCase() || "?";
  return (
    <div
      className={`${frameClass} profile-avatar-frame--fallback flex items-center justify-center bg-[var(--toq-sky)] font-bold text-white`}
    >
      <span className={size === "lg" ? "text-3xl" : size === "md" ? "text-xl" : "text-sm"}>
        {initial}
      </span>
    </div>
  );
}
