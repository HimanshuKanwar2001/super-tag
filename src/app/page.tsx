
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Zap, ShieldCheck } from 'lucide-react';

export default function RootPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
      {/* Header section removed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full mt-12"> {/* Added mt-12 for some top spacing */}
        <div className="bg-card p-8 rounded-xl shadow-xl flex flex-col items-center text-center">
          <ShieldCheck className="h-16 w-16 text-primary mb-6" />
          <h2 className="text-3xl font-semibold mb-3">Standard Access</h2>
          <p className="text-muted-foreground mb-8">
            Get 5 free keyword generations daily, with an option for bonus generations. Perfect for regular use.
          </p>
          <Link href="/limit" legacyBehavior passHref>
            <Button size="lg" className="w-full">
              Go to Standard Version
            </Button>
          </Link>
        </div>

        <div className="bg-card p-8 rounded-xl shadow-xl flex flex-col items-center text-center">
          <Zap className="h-16 w-16 text-accent mb-6" />
          <h2 className="text-3xl font-semibold mb-3">Unlimited Access</h2>
          <p className="text-muted-foreground mb-8">
            Enjoy unlimited keyword generations. Ideal for extensive research and power users.
          </p>
          <Link href="/free" legacyBehavior passHref>
            <Button size="lg" variant="outline" className="w-full border-accent text-accent hover:bg-accent/10">
              Go to Unlimited Version
            </Button>
          </Link>
        </div>
      </div>

      <footer className="mt-16 text-center text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} ReelRank Keywords. All rights reserved.</p>
        <p className="mt-1">
          <Link href="/privacy-policy" className="underline hover:text-primary">Privacy Policy</Link>
        </p>
      </footer>
    </div>
  );
}
