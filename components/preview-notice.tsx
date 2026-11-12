import { Eye } from "lucide-react";

export function PreviewNotice() {
  return (
    <aside className="preview-notice" role="status">
      <Eye size={15} aria-hidden="true" />
      <span><strong>Preview mode.</strong> Configure MongoDB, Google sign-in, and Cloudinary to enable live reports.</span>
    </aside>
  );
}
