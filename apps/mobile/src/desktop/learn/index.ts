// Native: the desktop screens never render (useDesktop() is false), so each
// export is an empty stand-in with the web export's name and props.
export function DxLearn() {
  return null;
}
export function DxCourse(_: { courseId: string }) {
  return null;
}
export function DxChapterIntro(_: { courseId: string; chapter: number }) {
  return null;
}
export function DxBook(_: { bookId: string }) {
  return null;
}
export function DxReview() {
  return null;
}
