 import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
 } from "@/components/ui/dialog";
 import { ImageUpload } from "./ImageUpload";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
 import { 
   Instagram, 
   Linkedin, 
   Facebook, 
   Calendar as CalendarIcon,
   Hash,
   X,
   Loader2,
   Save
 } from "lucide-react";
import { format, isBefore, startOfDay } from "date-fns";
import { pt } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface SocialPost {
  id: string;
  caption: string;
  platform: string;
  status: string;
  image_url: string | null;
  hashtags: string[] | null;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  error_log: string | null;
}

interface EditPostModalProps {
  post: SocialPost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (postId: string, data: {
    caption: string;
    platform: string;
    image_url: string | null;
    hashtags: string[];
    scheduled_at: string | null;
  }) => Promise<void>;
}

export function EditPostModal({ post, open, onOpenChange, onSave }: EditPostModalProps) {
  const [caption, setCaption] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [imageUrl, setImageUrl] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [scheduleTime, setScheduleTime] = useState("10:00");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (post) {
      setCaption(post.caption);
      setPlatform(post.platform);
      setImageUrl(post.image_url || "");
      setHashtags(post.hashtags || []);
      if (post.scheduled_at) {
        const date = new Date(post.scheduled_at);
        setScheduleDate(date);
        setScheduleTime(format(date, "HH:mm"));
      } else {
        setScheduleDate(undefined);
        setScheduleTime("10:00");
      }
    }
  }, [post]);

  const handleAddHashtag = () => {
    if (hashtagInput.trim()) {
      const tag = hashtagInput.trim().replace(/^#/, "");
      if (tag && !hashtags.includes(tag)) {
        setHashtags([...hashtags, tag]);
      }
      setHashtagInput("");
    }
  };

  const handleRemoveHashtag = (tag: string) => {
    setHashtags(hashtags.filter(t => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddHashtag();
    }
  };

  const getScheduledDateTime = (): string | null => {
    if (!scheduleDate) return null;
    const [hours, minutes] = scheduleTime.split(":").map(Number);
    const combined = new Date(scheduleDate);
    combined.setHours(hours, minutes, 0, 0);
    return combined.toISOString();
  };

  const handleSave = async () => {
    if (!post) return;
    
    setSaving(true);
    try {
      await onSave(post.id, {
        caption,
        platform,
        image_url: imageUrl.trim() || null,
        hashtags,
        scheduled_at: getScheduledDateTime(),
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const getPlatformIcon = (p: string) => {
    switch (p.toLowerCase()) {
      case "instagram":
        return <Instagram className="h-4 w-4 text-pink-500" />;
      case "linkedin":
        return <Linkedin className="h-4 w-4 text-blue-600" />;
      case "facebook":
        return <Facebook className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const characterCount = caption.length;
  const maxCharacters = platform === "linkedin" ? 3000 : platform === "facebook" ? 2200 : 2200;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {post && getPlatformIcon(post.platform)}
            Editar Post
          </DialogTitle>
          <DialogDescription>
            Edita todos os detalhes do teu post antes de publicar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Platform Selector */}
          <div className="space-y-2">
            <Label htmlFor="platform">Plataforma</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger id="platform">
                <SelectValue placeholder="Seleciona a plataforma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instagram">
                  <div className="flex items-center gap-2">
                    <Instagram className="h-4 w-4 text-pink-500" />
                    Instagram
                  </div>
                </SelectItem>
                <SelectItem value="facebook">
                  <div className="flex items-center gap-2">
                    <Facebook className="h-4 w-4 text-blue-500" />
                    Facebook
                  </div>
                </SelectItem>
                <SelectItem value="linkedin">
                  <div className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4 text-blue-600" />
                    LinkedIn
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

           {/* Image Upload */}
           <ImageUpload
             value={imageUrl}
             onChange={setImageUrl}
             disabled={saving}
            />

          {/* Caption */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="caption">Legenda</Label>
              <span className={cn(
                "text-xs",
                characterCount > maxCharacters ? "text-destructive" : "text-muted-foreground"
              )}>
                {characterCount}/{maxCharacters}
              </span>
            </div>
            <Textarea
              id="caption"
              placeholder="Escreve a legenda do teu post..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="min-h-[120px] resize-none"
            />
          </div>

          {/* Hashtags */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Hashtags
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Adiciona hashtags (pressiona Enter)"
                value={hashtagInput}
                onChange={(e) => setHashtagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
              />
              <Button 
                type="button" 
                variant="secondary" 
                onClick={handleAddHashtag}
              >
                Adicionar
              </Button>
            </div>
            {hashtags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {hashtags.map((tag) => (
                  <Badge 
                    key={tag} 
                    variant="secondary"
                    className="flex items-center gap-1 px-2 py-1"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveHashtag(tag)}
                      className="ml-1 hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Schedule Date/Time */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Agendar Publicação (opcional)
            </Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !scheduleDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduleDate 
                      ? format(scheduleDate, "d 'de' MMMM, yyyy", { locale: pt })
                      : "Selecionar data"
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduleDate}
                    onSelect={setScheduleDate}
                    disabled={(date) => isBefore(date, startOfDay(new Date()))}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <Input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-28"
              />
              {scheduleDate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setScheduleDate(undefined)}
                  title="Remover agendamento"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !caption.trim()}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                A guardar...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Guardar Alterações
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
