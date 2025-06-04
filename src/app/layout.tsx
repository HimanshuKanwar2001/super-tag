
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

            console.log('[IFRAME SCRIPT] Message listener loaded.');

            window.addEventListener("message", function (event) {
              console.log('[IFRAME SCRIPT] Message received:', event);
              // IMPORTANT: Always verify the origin of the message for security.
              if (event.origin !== "https://superprofile.bio") {
                console.warn("[IFRAME SCRIPT] Blocked message from unexpected origin:", event.origin);
                return;
              }

              console.log("[IFRAME SCRIPT] Message accepted from origin:", event.origin);
              console.log("[IFRAME SCRIPT] Message data:", event.data);

              if (event.data && typeof event.data === 'object') {
                const { referralCode } = event.data; // Assuming referralCode is directly in event.data
                if (referralCode) {
                  console.log("[IFRAME SCRIPT] Referral code received via postMessage:", referralCode);

                  const newReferralData = {
                    code: referralCode,
                    expiresAt: Date.now() + REFERRAL_CODE_EXPIRY_DAYS_SCRIPT * ONE_DAY_MS_SCRIPT,
                  };
                  localStorage.setItem(REFERRAL_CODE_STORAGE_KEY_SCRIPT, JSON.stringify(newReferralData));
                  console.log("[IFRAME SCRIPT] Referral code stored in localStorage:", newReferralData);

                  // Dispatch a custom event so the application can react
                  window.dispatchEvent(new CustomEvent('referralCodeUpdated', { detail: { referralCode } }));
                  console.log("[IFRAME SCRIPT] Dispatched 'referralCodeUpdated' event.");
                } else {
                  console.log("[IFRAME SCRIPT] No referralCode property in message data or referralCode is null/empty.");
                }
              } else {
                console.log("[IFRAME SCRIPT] Message data is not an object or is null.");
              }
            });
          `}
        </Script>
      </body>
    </html>
  );
}
