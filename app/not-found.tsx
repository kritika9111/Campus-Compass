import Link from "next/link";
import { Compass } from "lucide-react";
export default function NotFound(){return <main className="gate-page"><div className="gate-card"><span className="gate-mark"><Compass/></span><span className="eyebrow">This trail ends here</span><h1>We couldn’t find that item.</h1><p>The report may have been closed, removed, or the link might be incomplete.</p><Link className="button button-teal" href="/find">Back to campus reports</Link></div></main>}
