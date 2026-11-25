"use client";

import { useState } from "react";
import type { Author } from "@/lib/community";
import Avatar from "./Avatar";
import ProfilePopup from "./ProfilePopup";

export default function ProfileTrigger({
  author,
  size = 28,
}: {
  author: Author | null;
  size?: number;
}) {
  const [open, setOpen] = useState(false);

  if (!author) {
    return <Avatar a={null} size={size} />;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-left hover:text-gold"
      >
        <Avatar a={author} size={size} />
        <b>{author.display_name || author.username}</b>
      </button>

      {open && (
        <ProfilePopup author={author} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
