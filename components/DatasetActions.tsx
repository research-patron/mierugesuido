"use client";
import { useEffect,useRef } from "react";
import { emitUsage, type UsageEventName } from "@/lib/telemetry";

export function DataViewEvent({name,properties,identity,selector,expectedQuery}:{name:UsageEventName;properties:Record<string,string|number>;identity:string;selector?:string;expectedQuery?:string}) {
  const ref=useRef<HTMLSpanElement>(null);
  const signature=JSON.stringify(properties);
  useEffect(()=>{
    if(expectedQuery!==undefined && new URLSearchParams(window.location.search).toString()!==expectedQuery)return;
    const parent=ref.current?.parentElement;
    const element=selector ? parent?.querySelector(selector) : parent;
    if(!element)return;
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting))emitUsage(name,JSON.parse(signature),identity);
    });
    observer.observe(element);return()=>observer.disconnect();
  },[name,signature,identity,selector,expectedQuery]);
  return <span ref={ref} aria-hidden="true" />;
}
export function DatasetDownload({productId,fileType,href,children}:{productId:string;fileType:string;href:string;children:React.ReactNode}) {
  return <a className="button-secondary" href={href} download onClick={()=>emitUsage("sample_download_click",{productId,fileType,placement:"dataset"})}>{children}</a>;
}
export function NotePurchaseLink({productId,href}:{productId:string;href:string}) {
  return <a className="button-primary" href={href} rel="noopener noreferrer" onClick={()=>emitUsage("note_outbound_click",{productId,placement:"dataset"})}>noteで購入する（外部サイト）</a>;
}
