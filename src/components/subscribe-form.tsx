
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
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Mail, Phone } from 'lucide-react';
import Link from 'next/link';

const subscribeFormSchema = z.object({
  email: z.string().email({
    message: 'Please enter a valid email address.',
  }),
  phone: z.string().optional(),
  consent: z.boolean().refine(val => val === true, {
    message: 'You must agree to the terms to subscribe.',
  }),
});

export type SubscribeFormValues = z.infer<typeof subscribeFormSchema>;

interface SubscribeFormProps {
  onSubmit: (values: SubscribeFormValues) => Promise<void>;
  isLoading: boolean;
  privacyPolicyUrl: string;
}

export function SubscribeForm({ onSubmit, isLoading, privacyPolicyUrl }: SubscribeFormProps) {
  const form = useForm<SubscribeFormValues>({
    resolver: zodResolver(subscribeFormSchema),
    defaultValues: {
      email: '',
      phone: '',
      consent: false,
    },
  });

  const handleSubmit = async (values: SubscribeFormValues) => {
    await onSubmit(values);
    if (!isLoading) { // Reset form only if not loading (e.g. successful submission)
        // form.reset(); // Or conditionally reset based on submission success in parent
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <FormControl>
                  <Input 
                    type="email" 
                    placeholder="you@example.com" 
                    {...field} 
                    disabled={isLoading}
                    className="pl-10"
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number (Optional)</FormLabel>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <FormControl>
                  <Input 
                    type="tel" 
                    placeholder="+1 555-123-4567" 
                    {...field} 
                    disabled={isLoading} 
                    className="pl-10"
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="consent"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isLoading}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>
                  I agree to the <Link href={privacyPolicyUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-4 hover:text-primary/90">Privacy Policy</Link>.
                </FormLabel>
                <FormDescription>
                  You must agree to our terms and conditions to subscribe.
                </FormDescription>
                 <FormMessage />
              </div>
            </FormItem>
          )}
        />
        

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Subscribing...
            </>
          ) : (
            'Subscribe Now'
          )}
        </Button>
      </form>
    </Form>
  );
}
