import type {Metadata} from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import Script from 'next/script';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: 'ReelRank Keywords',
  description: 'Suggests trending keywords for reels and shorts to boost your content.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="antialiased">
        {children}
        <Toaster />
        <Script id="superprofile-message-listener" strategy="afterInteractive">
          {`
            const REFERRAL_CODE_STORAGE_KEY_SCRIPT = 'referralCodeData';
            const REFERRAL_CODE_EXPIRY_DAYS_SCRIPT = 30;
            const ONE_DAY_MS_SCRIPT = 24 * 60 * 60 * 1000;

            window.addEventListener("message", function (event) {
              if (event.origin !== "https://superprofile.bio") {
                console.warn("Blocked message from unknown origin:", event.origin);
                return;
              }

              const { referralCode } = event.data;
              if (referralCode) {
                console.log("Referral code received via postMessage:", referralCode);

                const newReferralData = {
                  code: referralCode,
                  expiresAt: Date.now() + REFERRAL_CODE_EXPIRY_DAYS_SCRIPT * ONE_DAY_MS_SCRIPT,
                };
                localStorage.setItem(REFERRAL_CODE_STORAGE_KEY_SCRIPT, JSON.stringify(newReferralData));

                // Dispatch a custom event so the application can react
                window.dispatchEvent(new CustomEvent('referralCodeUpdated', { detail: { referralCode } }));
              }
            });
          `}
        </Script>
      </body>
    </html>
  );
}
