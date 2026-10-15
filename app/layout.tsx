import {
  ClerkProvider,
  OrganizationSwitcher,
  SignInButton,
  SignUpButton,
  Show,
  UserButton,
} from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { ThemeToggle } from "@/components/theme-toggle";
import "@/lib/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cartograph",
  description: "Codebase dependency map visualizer",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const initialTheme = cookieStore.get("theme")?.value || "system";

  let initialClass = "";
  if (initialTheme === "dark") {
    initialClass = "dark";
  } else if (initialTheme === "light") {
    initialClass = "light";
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${initialClass} h-full antialiased`}
      data-theme={initialTheme}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("cartograph_theme")||"${initialTheme}";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d){document.documentElement.classList.add("dark");document.documentElement.classList.remove("light");}else{document.documentElement.classList.add("light");document.documentElement.classList.remove("dark");}document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground text-sm selection:bg-blue-500 selection:text-white">
        <ClerkProvider>
          <header className="flex h-12 items-center justify-between px-4 border-b border-border bg-surface shrink-0">
            <div className="flex items-center gap-4">
              <span className="font-semibold text-sm tracking-tight font-mono">
                Cartograph
              </span>
              <Show when="signed-in">
                <div className="flex items-center border-l border-border pl-4">
                  <OrganizationSwitcher
                    hidePersonal={true}
                    afterSelectOrganizationUrl="/"
                    afterCreateOrganizationUrl="/"
                    afterLeaveOrganizationUrl="/"
                    appearance={{
                      elements: {
                        rootBox: "flex items-center",
                        organizationSwitcherTrigger:
                          "px-2 py-1 text-xs font-mono font-medium rounded hover:bg-surface-hover text-foreground cursor-pointer transition-colors border border-border",
                        organizationPreviewMainIdentifier:
                          "text-foreground text-xs font-mono font-medium",
                        organizationSwitcherTriggerIcon:
                          "text-foreground opacity-70",
                      },
                    }}
                  />
                </div>
              </Show>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <button className="px-2.5 py-1 text-xs font-medium rounded bg-foreground text-background hover:opacity-90 cursor-pointer">
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="px-2.5 py-1 text-xs font-medium rounded border border-border text-foreground hover:bg-surface-hover cursor-pointer">
                    Sign Up
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "w-7 h-7",
                    },
                  }}
                />
              </Show>
            </div>
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}