import { FullScreenMessage } from "./components/FullScreenMessage";

/** Shown to whoever opened a share link, usually not a VeriWorkly user, so no workspace links. */
const ShareNotFound = () => (
  <FullScreenMessage
    title="This link doesn't exist"
    description="It may have been removed or mistyped. Ask the person who shared it for a new link."
  />
);

export default ShareNotFound;
