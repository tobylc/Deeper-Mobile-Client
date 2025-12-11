import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, Camera, Download, Loader2, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ProfileImageUploadProps {
  currentImageUrl?: string;
  userEmail?: string;
  hasGoogleLinked?: boolean;

  onImageUpdate?: (newImageUrl: string) => void;
}

export default function ProfileImageUpload({ 
  currentImageUrl, 
  userEmail, 
  hasGoogleLinked = false, 

  onImageUpdate 
}: ProfileImageUploadProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      
      // Get credentials with session cookie
      const response = await fetch('/api/users/profile-image/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include', // Include session cookies
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Profile image uploaded successfully",
      });
      setPreviewUrl(null);
      onImageUpdate?.(data.profileImageUrl);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload image",
        variant: "destructive",
      });
      setPreviewUrl(null);
    },
  });

  const importMutation = useMutation({
    mutationFn: async (provider: 'google') => {
      const response = await fetch('/api/users/profile-image/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider }),
        credentials: 'include', // Include session cookies
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Import failed');
      }
      
      return await response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Success",
        description: `Profile image imported from ${data.provider} successfully`,
      });
      onImageUpdate?.(data.profileImageUrl);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import profile image",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (file: File) => {
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select an image smaller than 5MB",
          variant: "destructive",
        });
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Upload the file
      uploadMutation.mutate(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const isLoading = uploadMutation.isPending || importMutation.isPending;

  return (
    <Card className="bg-card/50 border-border backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground font-inter">
          <Camera className="w-5 h-5 text-ocean" />
          Profile Image
        </CardTitle>
        <CardDescription className="text-muted-foreground font-inter">
          Upload a new profile image or import from your connected accounts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Profile Image Preview */}
        <div className="flex items-center justify-center">
          <div className="relative">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-border bg-card/50">
              {previewUrl ? (
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="w-full h-full object-cover"
                />
              ) : currentImageUrl ? (
                <img 
                  src={currentImageUrl} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <User className="w-12 h-12 text-muted-foreground" />
                </div>
              )}
            </div>
            {isLoading && (
              <div className="absolute inset-0 bg-background/80 rounded-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-ocean" />
              </div>
            )}
          </div>
        </div>

        {/* File Upload Area */}
        <div
          className={`
            border-2 border-dashed rounded-2xl p-6 text-center transition-colors cursor-pointer
            ${isDragging 
              ? 'border-ocean bg-ocean/10' 
              : 'border-border hover:border-ocean/50 hover:bg-card/30'
            }
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground font-inter mb-1">
            Click to upload or drag and drop
          </p>
          <p className="text-xs text-muted-foreground">
            PNG, JPG, GIF or WebP (max 5MB)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
            disabled={isLoading}
          />
        </div>

        {/* Quick Upload Button */}
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="w-full btn-ocean font-inter rounded-2xl"
        >
          {uploadMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Choose File
            </>
          )}
        </Button>

        {/* OAuth Import Options */}
        {hasGoogleLinked && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border"></div>
              <span className="text-xs text-muted-foreground font-inter">or import from</span>
              <div className="flex-1 h-px bg-border"></div>
            </div>

            <div className="grid gap-2">
              {hasGoogleLinked && (
                <Button
                  onClick={() => importMutation.mutate('google')}
                  disabled={isLoading}
                  variant="outline"
                  className="w-full justify-start rounded-2xl border-border hover:bg-card/50 font-inter"
                >
                  {importMutation.isPending && importMutation.variables === 'google' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Import from Google
                </Button>
              )}


            </div>
          </div>
        )}

        {/* Help Text */}
        <div className="text-xs text-muted-foreground text-center font-inter">
          Your profile image will be automatically resized to 400x400 pixels and optimized for fast loading.
        </div>
      </CardContent>
    </Card>
  );
}