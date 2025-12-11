import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileAvatarProps {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showOnlineIndicator?: boolean;
  isOnline?: boolean;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10", 
  lg: "h-12 w-12",
  xl: "h-16 w-16"
};

const iconSizes = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6", 
  xl: "h-8 w-8"
};

export default function ProfileAvatar({ 
  email, 
  firstName, 
  lastName, 
  profileImageUrl, 
  size = "md",
  className,
  showOnlineIndicator = false,
  isOnline = false
}: ProfileAvatarProps) {
  // Generate initials from name or email
  const getInitials = () => {
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }
    if (firstName) {
      return firstName.charAt(0).toUpperCase();
    }
    if (email) {
      return email.charAt(0).toUpperCase();
    }
    return "U";
  };

  // Generate a consistent color based on email
  const getBackgroundColor = () => {
    if (!email) return "bg-slate-500";
    
    const colors = [
      "bg-blue-500", "bg-purple-500", "bg-green-500", "bg-yellow-500",
      "bg-pink-500", "bg-indigo-500", "bg-teal-500", "bg-orange-500"
    ];
    
    const index = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  return (
    <div className="relative">
      <Avatar className={cn(sizeClasses[size], className)}>
        {profileImageUrl ? (
          <AvatarImage 
            src={profileImageUrl} 
            alt={`${firstName || email} avatar`}
            className="object-cover"
          />
        ) : null}
        <AvatarFallback className={cn(
          "text-white font-semibold",
          getBackgroundColor()
        )}>
          {profileImageUrl ? (
            <User className={iconSizes[size]} />
          ) : (
            getInitials()
          )}
        </AvatarFallback>
      </Avatar>
      
      {showOnlineIndicator && (
        <div className={cn(
          "absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white",
          isOnline ? "bg-green-500" : "bg-gray-400",
          size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"
        )} />
      )}
    </div>
  );
}