-- Create notes_reminders table for general notes and reminders (not tied to leads)
CREATE TABLE public.notes_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'note' CHECK (type IN ('note', 'reminder')),
  content TEXT NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notes_reminders ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own notes and reminders"
ON public.notes_reminders FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notes and reminders"
ON public.notes_reminders FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes and reminders"
ON public.notes_reminders FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes and reminders"
ON public.notes_reminders FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_notes_reminders_updated_at
BEFORE UPDATE ON public.notes_reminders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();