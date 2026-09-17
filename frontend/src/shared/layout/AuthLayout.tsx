import type { ReactNode } from 'react';
import { useState } from 'react';

/**
 * Split auth screen: form on the left, indigo blob + 3D illustration on the right.
 * Matches the login / forgot-password / OTP / reset-password frames.
 *
 * The 3D character is a bitmap that lives in the Figma file only — drop the export at
 * `public/illustrations/person-3d.png` and it appears automatically (see the README there).
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  const [showArt, setShowArt] = useState(true);

  return (
    <div className="flex min-h-screen bg-surface-auth">
      <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-16 lg:px-24">
        <div className="w-full max-w-[420px]">{children}</div>
      </div>

      <div className="relative hidden w-[42%] max-w-[620px] overflow-hidden lg:block">
        {/* Organic blob anchored to the right edge */}
        <svg
          className="absolute inset-y-0 right-0 h-full w-full text-brand-blob"
          viewBox="0 0 620 900"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            fill="currentColor"
            d="M300 0h320v900H300c60-140 150-210 150-410S330 170 300 0Z"
          />
        </svg>
        {showArt && (
          <img
            src="/illustrations/person-3d.png"
            alt=""
            onError={() => setShowArt(false)}
            className="absolute left-1/2 top-1/2 w-[62%] -translate-x-[46%] -translate-y-1/2 drop-shadow-xl"
          />
        )}
      </div>
    </div>
  );
}
