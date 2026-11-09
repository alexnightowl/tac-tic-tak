// True on a desktop-wide browser window (real width ≥ 1024): the route
// renders its desktop layout (canvas "Desktop — redesign"). Always false
// in the native app.
export { useWideWeb as useDesktop } from '@/platform/webFrame';
