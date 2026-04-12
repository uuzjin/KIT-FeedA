"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { getUserProfile, updateUserProfile, UserProfile } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EditProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditProfileModal({
  open,
  onOpenChange,
  onSuccess,
}: EditProfileModalProps) {
  const { user, supabaseUser } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    title: "",
    profileImage: null as File | null,
    previewUrl: "",
  });

  useEffect(() => {
    if (open && supabaseUser) {
      fetchProfile();
    }
  }, [open, supabaseUser]);

  const fetchProfile = async () => {
    if (!supabaseUser) return;

    setIsFetching(true);
    try {
      const data = await getUserProfile(supabaseUser.id);
      setProfile(data);
      setFormData({
        name: data.name,
        title: data.title || "",
        profileImage: null,
        previewUrl: data.profileImageUrl || "",
      });
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      setError("프로필 정보를 불러올 수 없습니다.");
    } finally {
      setIsFetching(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        profileImage: file,
        previewUrl: URL.createObjectURL(file),
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUser) return;

    setError("");
    setIsLoading(true);

    try {
      await updateUserProfile(supabaseUser.id, {
        name: formData.name,
        title: formData.title,
        profileImage: formData.profileImage || undefined,
      });

      toast({
        title: "프로필이 업데이트되었습니다.",
        description: "변경 사항이 저장되었습니다.",
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "프로필 업데이트에 실패했습니다.";
      setError(errorMessage);
      toast({
        title: "오류",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>프로필 설정</DialogTitle>
          <DialogDescription>
            프로필 정보를 수정할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        {isFetching ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin size-8 text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 프로필 이미지 */}
            <div className="flex justify-center">
              <label className="cursor-pointer">
                <div className="relative">
                  <Avatar className="size-24">
                    <AvatarImage
                      src={formData.previewUrl}
                      alt="프로필 미리보기"
                    />
                    <AvatarFallback className="bg-primary text-lg font-semibold text-primary-foreground">
                      {formData.name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute bottom-0 right-0 flex size-7 items-center justify-center rounded-full bg-primary hover:bg-primary/90 transition-colors">
                    <Upload className="size-4 text-primary-foreground" />
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">이름</FieldLabel>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="이름을 입력하세요"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="email">이메일</FieldLabel>
                <Input
                  id="email"
                  value={formData.title ? "" : user?.email || ""}
                  disabled
                  placeholder="이메일"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="title">직책</FieldLabel>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="직책을 입력하세요 (선택사항)"
                />
              </Field>
            </FieldGroup>

            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                취소
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  "저장"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
