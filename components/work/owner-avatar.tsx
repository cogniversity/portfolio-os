import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";

export function OwnerAvatar({
  name,
  image,
  size = "sm",
  className,
}: {
  name?: string | null;
  image?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeCls =
    size === "lg" ? "h-8 w-8" : size === "md" ? "h-7 w-7" : "h-5 w-5";
  return (
    <Avatar className={cn(sizeCls, className)}>
      {image && <AvatarImage src={image} alt={name ?? ""} />}
      <AvatarFallback className="text-[9px]">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

export function OwnerAvatarStack({
  owners,
  max = 4,
}: {
  owners: Array<{ name?: string | null; image?: string | null }>;
  max?: number;
}) {
  const shown = owners.slice(0, max);
  const extra = owners.length - shown.length;
  return (
    <div className="flex -space-x-1.5">
      {shown.map((o, i) => (
        <OwnerAvatar
          key={i}
          name={o.name}
          image={o.image}
          className="ring-2 ring-background"
        />
      ))}
      {extra > 0 && (
        <div className="z-10 flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[9px] font-medium ring-2 ring-background">
          +{extra}
        </div>
      )}
    </div>
  );
}
