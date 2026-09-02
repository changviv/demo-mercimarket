/* The pill-shaped control capsule from the menu artifact's control bar.

   Both controls in that bar are the same object: a rounded white capsule with
   a hairline, 48px tall, holding an icon or a label and then the control
   itself. Writing it twice is how the two ended up at different heights in the
   previous build — one was 46px inside an 81px bar, the other 48.

   Called `.ctl`, not `.field`: `.field` is already the checkout and item-sheet
   FORM field — a labelled block with a hint and an error slot and a 16px
   bottom margin. Reusing the name inherited that margin and pushed the control
   bar from 77px to 93px, which is the kind of collision that only shows up as
   "the bar looks a bit tall". */

export default function ControlCapsule({ className = '', children }) {
  return <div className={`ctl ${className}`.trim()}>{children}</div>;
}

export const SearchIcon = () => (
  <svg className="search-ico" width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">
    <circle cx="7.3" cy="7.3" r="5.5" stroke="currentColor" strokeWidth="1.6" />
    <path d="M11.4 11.4L15.5 15.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
