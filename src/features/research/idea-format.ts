export type IdeaContentFormat='q_and_a'|'talking_head'|'skit'|'product_demo'|'podcast'|'voice_over'|'event'
export const ideaContentFormats:IdeaContentFormat[]=['q_and_a','talking_head','skit','product_demo','podcast','voice_over','event']
export const ideaFormatLabels:Record<IdeaContentFormat,[string,string]>={
 q_and_a:['Q&A / 访问型','Q&A / Interview'],talking_head:['讲稿型','Talking Head'],skit:['情景短剧','Skit'],
 product_demo:['产品示范','Product Demo'],podcast:['Podcast','Podcast'],voice_over:['旁白','Voice Over'],event:['活动内容','Event'],
}
export function inferIdeaFormat(value:string|null|undefined):IdeaContentFormat{
 const normalized=(value??'').toLowerCase()
 if(/skit|短剧|情景/u.test(normalized))return'skit'
 if(/talking|讲稿|独白/u.test(normalized))return'talking_head'
 if(/product|demo|产品/u.test(normalized))return'product_demo'
 if(/podcast/u.test(normalized))return'podcast'
 if(/voice|旁白/u.test(normalized))return'voice_over'
 if(/event|活动/u.test(normalized))return'event'
 return'q_and_a'
}
