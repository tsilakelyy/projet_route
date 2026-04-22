import { useRef, useEffect } from 'react';

interface ScreenshotCaptureProps {
  children: React.ReactNode;
  onCapture?: (dataUrl: string) => void;
  className?: string;
}

const ScreenshotCapture = ({ children, onCapture, className = '' }: ScreenshotCaptureProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const captureScreenshot = async () => {
    console.warn("Capture d'écran désactivée - html2canvas non disponible");
    // Vous pouvez ici implémenter une alternative plus simple si nécessaire
  };

  useEffect(() => {
    if (containerRef.current) {
      (containerRef.current as any).captureScreenshot = captureScreenshot;
    }
  }, []);

  return (
    <div ref={containerRef} className={`screenshot-capture ${className}`}>
      {children}
    </div>
  );
};

export default ScreenshotCapture;
