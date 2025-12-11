import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminNavLink() {
  const { user } = useAuth();
  
  // Check if user is admin
  const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || '').split(',').map(email => email.trim());
  const isAdmin = user?.email && adminEmails.includes(user.email);

  if (!isAdmin) return null;

  return (
    <Link href="/admin">
      <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-700">
        <Settings className="h-4 w-4 mr-2" />
        Admin
      </Button>
    </Link>
  );
}