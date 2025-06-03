
'use client';

import type React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Captions, FileText, Film, Instagram, Linkedin, Loader2, Type, Youtube } from 'lucide-react';
import type { SuggestKeywordsInput } from '@/ai/flows/suggest-keywords';

const formSchema = z.object({
  inputMethod: z.enum(['caption', 'script', 'title'], {
    required_error: 'Please select a content type.',
  }),
  platform: z.enum(['youtube shorts', 'instagram reels', 'tiktok', 'linkedin video'], {
    required_error: 'Please select a platform.',
  }),
  inputText: z.string().min(10, {
    message: 'Input text must be at least 10 characters.',
  }).max(2000, {
    message: 'Input text must not exceed 2000 characters.'
  }),
});

type KeywordFormValues = z.infer<typeof formSchema>;

interface KeywordFormProps {
  onSubmit: (values: SuggestKeywordsInput) => Promise<void>;
  isLoading: boolean; // True when the form submission is in progress
}

const contentTypeOptions = [
  { value: 'caption', label: 'Caption', icon: <Captions className="mr-2 h-4 w-4" /> },
  { value: 'script', label: 'Video Script', icon: <FileText className="mr-2 h-4 w-4" /> },
  { value: 'title', label: 'Video Title', icon: <Type className="mr-2 h-4 w-4" /> },
];

const platformOptions = [
  { value: 'youtube shorts', label: 'YouTube Shorts', icon: <Youtube className="mr-2 h-4 w-4" /> },
  { value: 'instagram reels', label: 'Instagram Reels', icon: <Instagram className="mr-2 h-4 w-4" /> },
  { value: 'tiktok', label: 'TikTok', icon: <Film className="mr-2 h-4 w-4" /> },
  { value: 'linkedin video', label: 'LinkedIn Video', icon: <Linkedin className="mr-2 h-4 w-4" /> },
];

export function KeywordForm({ onSubmit, isLoading }: KeywordFormProps) {
  const form = useForm<KeywordFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      inputText: '',
    },
  });

  const handleSubmit = async (values: KeywordFormValues) => {
    await onSubmit(values as SuggestKeywordsInput);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="inputMethod"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Content Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select content type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {contentTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center">
                          {option.icon}
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  What type of content are you providing for analysis?
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="platform"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Platform</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a platform" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {platformOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center">
                          {option.icon}
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Which platform is your content for?
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="inputText"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your Content</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter your caption, script, or title here..."
                  className="min-h-[150px] resize-y"
                  {...field}
                  disabled={isLoading}
                />
              </FormControl>
              <FormDescription>
                Provide the text based on your selected content type.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            'Suggest Keywords'
          )}
        </Button>
      </form>
    </Form>
  );
}
