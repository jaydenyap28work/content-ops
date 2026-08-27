/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type Language = 'zh-CN' | 'en'
const STORAGE_KEY = 'contentos.language'

const messages = {
  'zh-CN': {
    dashboard:'工作台',ideas:'内容计划',content:'制作中心',calendar:'日历',analytics:'数据分析',clients:'客户',team:'团队',references:'灵感库',assets:'素材库',music:'音乐库',playbook:'剪辑规范',settings:'设置',
    dailyWork:'日常工作',results:'成效',management:'管理',resources:'资源库',owner:'负责人',creator:'创建者',language:'语言',profile:'个人资料',timezone:'时区',save:'保存',cancel:'取消',search:'搜索',empty:'暂无资料',open:'打开',today:'今天',thisWeek:'本周',needsAttention:'需要处理',productionOverview:'制作概况',quickActions:'快捷操作',newIdea:'新增选题',newContent:'新增内容',
    new:'新选题',evaluating:'评估中',approved:'已批准',converted:'已转内容',rejected:'已拒绝',archived:'已归档',ready_to_shoot:'待拍摄',shooting:'拍摄中',shot_awaiting_edit:'待剪辑',editing:'剪辑中',first_cut_submitted:'初剪已提交',internal_review:'审核中',revision_required:'需修改',client_review:'客户审核',ready_for_publishing:'待发布',completed:'已完成',
  },
  en: {
    dashboard:'Workspace',ideas:'Content Plan',content:'Production Center',calendar:'Calendar',analytics:'Analytics',clients:'Clients',team:'Team',references:'Inspiration Library',assets:'Assets',music:'Music',playbook:'Editing Playbook',settings:'Settings',
    dailyWork:'Daily Work',results:'Results',management:'Management',resources:'Resources',owner:'Owner',creator:'Creator',language:'Language',profile:'Profile',timezone:'Timezone',save:'Save',cancel:'Cancel',search:'Search',empty:'No data yet',open:'Open',today:'Today',thisWeek:'This Week',needsAttention:'Needs Attention',productionOverview:'Production Overview',quickActions:'Quick Actions',newIdea:'New Idea',newContent:'New Content',
    new:'New',evaluating:'Evaluating',approved:'Approved',converted:'Converted',rejected:'Rejected',archived:'Archived',ready_to_shoot:'Ready to Shoot',shooting:'Shooting',shot_awaiting_edit:'Awaiting Edit',editing:'Editing',first_cut_submitted:'First Cut Submitted',internal_review:'In Review',revision_required:'Revision Required',client_review:'Client Review',ready_for_publishing:'Ready for Publishing',completed:'Completed',
  },
} as const

export type TranslationKey = keyof typeof messages.en
interface I18nValue { language:Language; setLanguage:(language:Language)=>void; t:(key:TranslationKey)=>string }
const I18nContext=createContext<I18nValue|null>(null)

export function I18nProvider({children}:{children:ReactNode}){
  const [language,setLanguageState]=useState<Language>(()=>localStorage.getItem(STORAGE_KEY)==='en'?'en':'zh-CN')
  const value=useMemo<I18nValue>(()=>({language,setLanguage:(next)=>{localStorage.setItem(STORAGE_KEY,next);setLanguageState(next)},t:(key)=>messages[language][key]}),[language])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
export function useI18n(){const value=useContext(I18nContext);if(!value)throw new Error('useI18n requires I18nProvider');return value}
export function LanguageSwitch({compact=false}:{compact?:boolean}){const{language,setLanguage}=useI18n();return <div className="inline-flex rounded-lg border border-line bg-white p-1" aria-label="Language"><button type="button" onClick={()=>setLanguage('zh-CN')} className={`rounded-md px-2.5 py-1.5 text-xs font-bold ${language==='zh-CN'?'bg-ink text-white':'text-ink-muted'}`}>中文</button><button type="button" onClick={()=>setLanguage('en')} className={`rounded-md px-2.5 py-1.5 text-xs font-bold ${language==='en'?'bg-ink text-white':'text-ink-muted'}`}>{compact?'EN':'English'}</button></div>}

export const routeTranslationKeys:Record<string,TranslationKey>={'/':'dashboard','/ideas':'ideas','/content':'content','/calendar':'calendar','/analytics':'analytics','/clients':'clients','/team':'team','/references':'references','/assets':'assets','/music':'music','/editing-playbook':'playbook','/settings':'settings'}
