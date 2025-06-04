
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
            console.log('[IFRAME SCRIPT] Message listener attempting to load.');
            window.addEventListener("message", function (event) {
              console.log('[IFRAME SCRIPT] Message received:', event);
              // IMPORTANT: Always verify the origin of the message for security.
              if (event.origin !== "https://superprofile.bio") {
                console.warn("[IFRAME SCRIPT] Blocked message from unexpected origin:", event.origin);
                return;
              }

              console.log("[IFRAME SCRIPT] Message accepted from origin:", event.origin);
              console.log("[IFRAME SCRIPT] Received message data in iframe:", event.data);

              const { referralCode, cookies } = event.data;

              if (referralCode) {
                console.log("[IFRAME SCRIPT] Referral code received via postMessage:", referralCode);
                localStorage.setItem("referralCode", referralCode); // Stored as a simple string
                console.log("[IFRAME SCRIPT] Referral code stored in localStorage under 'referralCode'.");
                // Dispatch an event so page.tsx can react and re-load data
                window.dispatchEvent(new CustomEvent('referralCodeUpdated', { detail: { referralCode } }));
                console.log("[IFRAME SCRIPT] Dispatched 'referralCodeUpdated' event.");
              } else {
                console.log("[IFRAME SCRIPT] No referralCode property in message data or referralCode is null/empty.");
              }

              if (cookies) {
                console.log("[IFRAME SCRIPT] Cookies received via postMessage:", cookies);
                localStorage.setItem("cookiesFromParent", cookies);
                console.log("[IFRAME SCRIPT] Cookies stored in localStorage under 'cookiesFromParent'.");
              } else {
                console.log("[IFRAME SCRIPT] No cookies property in message data or cookies are null/empty.");
              }
            });
            console.log('[IFRAME SCRIPT] Message listener loaded and attached.');
          `}
        </Script>
      </body>
    </html>
  );
}
