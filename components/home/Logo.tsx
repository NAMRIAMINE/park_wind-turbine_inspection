import { Wind, Camera } from "lucide-react";

export function Logo() {
  return (
    <div className="relative">
      <Wind className="h-8 w-8 text-primary" />
      <Camera className="absolute -bottom-1 -right-1 h-4 w-4 text-primary-foreground bg-primary rounded-full p-0.5" />
    </div>
  );
}
