export type SourcePlatform = 'douyin'|'xhs'|'tiktok'|'instagram'|'facebook'|'threads'|'youtube'|'lemon8'|'web'
export interface ParsedSourceUrl { url:string|null; platform:SourcePlatform|null }
const trailing=/[),.;!?，。；！？）】》」』]+$/u
const protocolUrl=/https?:\/\/[^\s<>"']+/iu
const domainUrl=/(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:com|net|org|co|my|cn|app|tv|me|io)(?::\d+)?(?:\/[^\s<>"']*)?/iu
export function detectSourcePlatform(value:string):SourcePlatform{
 const host=new URL(value).hostname.toLowerCase().replace(/^www\./,'')
 if(host==='douyin.com'||host.endsWith('.douyin.com'))return'douyin'
 if(host==='xiaohongshu.com'||host.endsWith('.xiaohongshu.com')||host==='xhslink.com'||host.endsWith('.xhslink.com'))return'xhs'
 if(host==='tiktok.com'||host.endsWith('.tiktok.com'))return'tiktok'
 if(host==='instagram.com'||host.endsWith('.instagram.com'))return'instagram'
 if(host==='facebook.com'||host.endsWith('.facebook.com')||host==='fb.watch')return'facebook'
 if(host==='threads.net'||host.endsWith('.threads.net'))return'threads'
 if(host==='youtube.com'||host.endsWith('.youtube.com')||host==='youtu.be')return'youtube'
 if(host==='lemon8-app.com'||host.endsWith('.lemon8-app.com')||host==='lemon8-app.cn'||host.endsWith('.lemon8-app.cn'))return'lemon8'
 return'web'
}
export function parseSourceInput(input:string):ParsedSourceUrl{
 const text=input.trim();if(!text)return{url:null,platform:null}
 const match=text.match(protocolUrl)??text.match(domainUrl);if(!match)return{url:null,platform:null}
 let candidate=match[0].replace(trailing,'');if(!/^https?:\/\//i.test(candidate))candidate=`https://${candidate}`
 try{const url=new URL(candidate);if(!url.hostname.includes('.'))return{url:null,platform:null};return{url:url.toString(),platform:detectSourcePlatform(url.toString())}}catch{return{url:null,platform:null}}
}