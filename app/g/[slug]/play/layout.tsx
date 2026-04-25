const PLAY_LAYOUT_MODULE_LOADED_AT = Date.now();

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  console.info("[play/layout][timing]", {
    segment: "render",
    moduleLoadAgeMs: Date.now() - PLAY_LAYOUT_MODULE_LOADED_AT,
  });
  return <>{children}</>;
}
