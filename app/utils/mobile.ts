export function isMobile() {
  // we use sm: as the breakpoint for mobile. it's currently set to 640px
  return globalThis.innerWidth < 640;
}
