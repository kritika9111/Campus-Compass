import Link from "next/link";
import Image from "next/image";
import { Building2, MapPin, Clock3, ArrowUpRight } from "lucide-react";
import { formatCampusDate } from "@/lib/datetime";
import type { ItemReport } from "@/lib/types";
export function ItemCard({ item }: { item: ItemReport }) {
  const date = formatCampusDate(item.created_at, { day: "numeric", month: "short" });
  return <Link href={`/items/${item.id}`} className="item-card"><div className={`item-visual ${item.kind}`}>{item.photo_url && <Image className="card-photo" src={item.photo_url} alt="" fill sizes="(max-width: 650px) 50vw, 25vw" unoptimized />}<span className="status-chip">{item.kind === "lost" ? "Lost item" : "Found item"}</span>{item.kind === "found" && item.dropped_off_desk && <span className="desk-chip"><Building2 size={10} /> At campus desk</span>}{!item.photo_url && <span className="item-monogram">{item.title.slice(0, 1).toUpperCase()}</span>}<span className="visual-caption">{item.category}</span></div><div className="item-info"><div className="item-title-row"><h3>{item.title}</h3><ArrowUpRight size={17} /></div><p className="item-location"><MapPin size={14} />{item.location}</p><div className="item-meta"><span><Clock3 size={13} />{date}</span><span>{item.category}</span></div></div></Link>;
}
