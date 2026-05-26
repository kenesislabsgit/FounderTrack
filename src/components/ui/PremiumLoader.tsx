import { LoaderThree } from './loader';

interface PremiumLoaderProps {
  fullscreen?: boolean;
}

export default function PremiumLoader({ fullscreen = true }: PremiumLoaderProps) {
  const loaderContent = (
    <div className="flex items-center justify-center p-4">
      <LoaderThree />
    </div>
  );

  if (fullscreen) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[hsl(var(--bg-primary))] overflow-hidden select-none">
        {loaderContent}
      </div>
    );
  }

  return loaderContent;
}
