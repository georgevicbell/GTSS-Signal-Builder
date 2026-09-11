import { useEffect, useRef, useState } from "react";

interface ResizableBlockProps {
  initialHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  children: React.ReactNode;
  onHeightChange?: (h: number) => void;
}

export default function ResizableBlock({
  initialHeight = 288,
  minHeight = 120,
  maxHeight = 800,
  children,
  onHeightChange,
}: ResizableBlockProps) {
  const [height, setHeight] = useState(initialHeight);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHRef = useRef(height);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const dy = (e.clientY || 0) - startYRef.current;
      let next = startHRef.current + dy;
      if (next < minHeight) next = minHeight;
      if (next > maxHeight) next = maxHeight;
      setHeight(next);
      onHeightChange?.(next);
    };

    const onUp = () => {
      draggingRef.current = false;
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [minHeight, maxHeight, onHeightChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    draggingRef.current = true;
    startYRef.current = e.clientY;
    startHRef.current = height;
    document.body.style.userSelect = "none";
  };

  return (
    <div className="w-full">
      <div style={{ height }} className="w-full">
        {children}
      </div>
      <div
        onMouseDown={handleMouseDown}
        className="w-full h-2 cursor-row-resize bg-transparent hover:bg-grey-200 transition-colors"
        title="Drag to resize"
      />
    </div>
  );
}
